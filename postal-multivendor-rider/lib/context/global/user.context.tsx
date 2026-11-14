import { QueryResult, useQuery } from "@apollo/client";
import {
  LocationAccuracy,
  LocationObject,
  LocationSubscription,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  watchPositionAsync,
} from "expo-location";
import { createContext, useContext, useEffect, useRef, useState } from "react";
// Interface
import {
  IRiderProfileResponse,
  IUserContextProps,
  IUserProviderProps,
} from "@/lib/utils/interfaces";
// Context
// import { useLocationContext } from "./location.context";
// API
import { UPDATE_LOCATION } from "@/lib/apollo/mutations/rider.mutation";
import { RIDER_ORDERS, RIDER_PROFILE } from "@/lib/apollo/queries";
import {
  SUBSCRIPTION_ASSIGNED_RIDER,
  SUBSCRIPTION_ZONE_ORDERS,
} from "@/lib/apollo/subscriptions";
import { asyncStorageEmitter } from "@/lib/services/async-storage";
import { RIDER_TOKEN } from "@/lib/utils/constants";
import { IOrder } from "@/lib/utils/interfaces/order.interface";
import {
  IRiderEarnings,
  IRiderEarningsArray,
} from "@/lib/utils/interfaces/rider-earnings.interface";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UserContext = createContext<IUserContextProps>({} as IUserContextProps);

export const UserProvider = ({ children }: IUserProviderProps) => {
  // States
  const [modalVisible, setModalVisible] = useState<
    IRiderEarnings & { bool: boolean }
  >({
    bool: false,
    _id: "",
    date: "",
    earningsArray: [] as IRiderEarningsArray[],
    totalEarningsSum: 0,
    totalTipsSum: 0,
    totalDeliveries: 0,
  });
  const [riderOrderEarnings, setRiderOrderEarnings] = useState<
    IRiderEarningsArray[]
  >([] as IRiderEarningsArray[]);
  const [userId, setUserId] = useState("");
  const [zoneId, setZoneId] = useState("");

  // Refs
  const locationListener = useRef<LocationSubscription>();
  const coordinatesRef = useRef<LocationObject>({} as LocationObject);

  // Context
  // const { locationPermission } = useLocationContext()

  const {
    loading: loadingProfile,
    error: errorProfile,
    data: dataProfile,
    refetch: refetchProfile,
  } = useQuery(RIDER_PROFILE, {
    fetchPolicy: "cache-first",
    skip: !userId,
    variables: {
      id: userId,
    },
  }) as QueryResult<IRiderProfileResponse | undefined, { id: string }>;

  const {
    client,
    loading: loadingAssigned,
    error: errorAssigned,
    data: dataAssigned,
    networkStatus: networkStatusAssigned,
    subscribeToMore,
   refetch: refetchAssigned
  } = useQuery(RIDER_ORDERS, {
    // onCompleted,
    // onError: error2,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    pollInterval: 5000,
    skip: !userId,
    variables: {
      userId,
    },
  });

  async function getUserId() {
    const id = await AsyncStorage.getItem("rider-id");

    if (id) {
      setUserId(id);
    }
  }

  const trackRiderLocation = async () => {
    // Already tracking
    if (locationListener.current) return true;
    try {
      // Without permission watchPositionAsync throws (unhandled rejection) and
      // tracking would never start later; the caller retries until it works.
      const { status } = await getForegroundPermissionsAsync();
      if (status !== "granted") return false;

      locationListener.current = await watchPositionAsync(
        {
          accuracy: LocationAccuracy.BestForNavigation,
          timeInterval: 60000,
          distanceInterval: 10,
        },
        async (location) => {
          try {
            const token = await AsyncStorage.getItem(RIDER_TOKEN);
            if (!token) return;
            if (
              coordinatesRef.current?.coords?.latitude ===
                location.coords?.latitude &&
              coordinatesRef.current?.coords?.longitude ===
                location.coords?.longitude
            )
              return;
            coordinatesRef.current = location;
            client.mutate({
              mutation: UPDATE_LOCATION,
              variables: {
                latitude: location.coords.latitude.toString(),
                longitude: location.coords.longitude.toString(),
              },
            });
          } catch (error) {
            console.log(error);
          }
        }
      );
      return true;
    } catch (error) {
      console.log("trackRiderLocation error:", error);
      return false;
    }
  };

  // UseEffects
  useEffect(() => {
    // Only the rider id is required for the "assigned to me" subscription; a rider
    // without a zone must still receive orders the admin assigns to them.
    if (!dataProfile?.rider?._id) return;

    const subscribeNewOrders = {
      unsubAssignOrder: subscribeToMore({
        document: SUBSCRIPTION_ASSIGNED_RIDER,
        variables: { riderId: dataProfile?.rider?._id ?? userId },
        updateQuery: (prev, { subscriptionData }) => {
          if (!subscriptionData.data) return prev;
          if (subscriptionData.data.subscriptionAssignRider.origin === "new") {
            const incoming = subscriptionData.data.subscriptionAssignRider.order;
            // Replace instead of duplicating: the order may already be in the
            // list from the zone feed before it was assigned to this rider.
            return {
              riderOrders: [
                incoming,
                ...prev.riderOrders.filter((o: IOrder) => o._id !== incoming._id),
              ],
            };
          } else if (
            subscriptionData.data.subscriptionAssignRider.origin === "remove"
          ) {
            return {
              riderOrders: [
                ...prev.riderOrders.filter(
                  (o: IOrder) =>
                    o._id !==
                    subscriptionData.data.subscriptionAssignRider.order._id
                ),
              ],
            };
          }
          return prev;
        },
      }),

      unsubZoneOrder: !dataProfile?.rider?.zone?._id ? undefined : subscribeToMore({
        document: SUBSCRIPTION_ZONE_ORDERS, // Previously known as SUBSCRIPTION_UNASSIGNED_ORDER
        variables: { zoneId: dataProfile?.rider?.zone?._id ?? zoneId },
        updateQuery: (prev, { subscriptionData }) => {
          if (!subscriptionData.data) return prev;

          const zoneEvent = subscriptionData.data.subscriptionZoneOrders;
          if (zoneEvent.origin === "new") {
            return {
              riderOrders: [
                zoneEvent.order,
                ...prev.riderOrders.filter((o: IOrder) => o._id !== zoneEvent.order._id),
              ],
            };
          }
          if (zoneEvent.origin === "remove") {
            // Another rider took the order: drop it unless it is mine.
            return {
              riderOrders: prev.riderOrders.filter(
                (o: IOrder) =>
                  o._id !== zoneEvent.order._id ||
                  o.rider?._id === dataProfile?.rider?._id,
              ),
            };
          }
          return prev;
        },
      }),
    };

    const { unsubZoneOrder, unsubAssignOrder } = subscribeNewOrders;
    return () => {
      if (dataProfile?.rider?.zone?._id) {
        setZoneId(dataProfile?.rider?.zone?._id);
        try {
          unsubZoneOrder?.();
        } catch (err) {
          console.log("err in unsubZoneOrder", err);
        }
      }

      if (unsubAssignOrder) {
        try {
          unsubAssignOrder();
        } catch (err) {
          console.log("err in unsubAssignOrder", err);
        }
      }
    };
  }, [dataProfile]);

  useEffect(() => {
    if (!userId) return;

    refetchProfile({ id: userId });
  }, [userId]);

  useEffect(() => {
    const listener = asyncStorageEmitter.addListener("rider-id", (data) => {
      setUserId(data?.value ?? "");
    });

    getUserId();

    // Start tracking now, or as soon as the rider grants the permission.
    let retryTimer: ReturnType<typeof setInterval> | undefined;
    trackRiderLocation().then((started) => {
      if (started) return;
      retryTimer = setInterval(async () => {
        if (await trackRiderLocation()) {
          if (retryTimer) clearInterval(retryTimer);
        }
      }, 10000);
    });

    return () => {
      if (retryTimer) clearInterval(retryTimer);
      if (locationListener.current) {
        locationListener?.current?.remove();
        locationListener.current = undefined;
      }

      if (listener) {
        listener.removeListener("rider-id", () => {
          console.log("Rider Id listerener removed");
        });
      }
    };
  }, []);

  return (
    <UserContext.Provider
      value={{
        modalVisible,
        riderOrderEarnings,
        setModalVisible,
        setRiderOrderEarnings,
        userId,
        loadingProfile,
        errorProfile,
        dataProfile: dataProfile?.rider ?? null,
        loadingAssigned,
        errorAssigned,
        assignedOrders:
          loadingAssigned || errorAssigned ? [] : dataAssigned?.riderOrders,
        refetchAssigned,
        refetchProfile,
        networkStatusAssigned,
        requestForegroundPermissionsAsync,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
export const UserConsumer = UserContext.Consumer;
export const useUserContext = () => useContext(UserContext);
export default UserContext;
