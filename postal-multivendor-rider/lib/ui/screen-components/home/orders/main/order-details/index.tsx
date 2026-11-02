/* eslint-disable @typescript-eslint/no-require-imports */
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Methods
import { linkToMapsApp } from "@/lib/utils/methods";
import { getRoute } from "@/lib/utils/methods/osm";
import getEnvVars from "@/environment";

// Icons
import Icons from "@expo/vector-icons/MaterialIcons";

// Screen Components
import ItemDetails from "@/lib/ui/screen-components/home/orders/main/item-details";

// Hooks
import useDetails from "@/lib/hooks/useDetail";
import useOrderDetail from "@/lib/hooks/useOrderDetails";

// Context
import { ConfigurationContext } from "@/lib/context/global/configuration.context";

// UI Components
import { RIDER_ORDERS } from "@/lib/apollo/queries";
import { useApptheme } from "@/lib/context/global/theme.context";
import { useUserContext } from "@/lib/context/global/user.context";
import { CustomContinueButton } from "@/lib/ui/useable-components";
import OsmMap, {
  MapLatLng as LatLng,
  MapMarkerKind,
} from "@/lib/ui/useable-components/osm-map";
import AccordionItem from "@/lib/ui/useable-components/accordian";
import SpinnerComponent from "@/lib/ui/useable-components/spinner";
import { HomeIcon } from "@/lib/ui/useable-components/svg";
import WelldoneComponent from "@/lib/ui/useable-components/well-done";
import { map_styles } from "@/lib/utils/constants/order-details";
import { IOrder } from "@/lib/utils/interfaces/order.interface";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

// Helper function to check if coordinates are valid
// Added to prevent array bounds crashes when using invalid coordinates
const isValidCoordinate = (coord?: LatLng): boolean => {
  if (!coord) return false;
  return (
    coord.latitude !== undefined &&
    coord.longitude !== undefined &&
    !isNaN(coord.latitude) &&
    !isNaN(coord.longitude) &&
    Math.abs(coord.latitude) <= 90 &&
    Math.abs(coord.longitude) <= 180 &&
    // (0,0) is the placeholder used while a location is still unknown
    !(coord.latitude === 0 && coord.longitude === 0)
  );
};

export default function OrderDetailScreen() {
  // Ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Context
  const configuration = useContext(ConfigurationContext);
  const { ROUTING_URL, MAP_TILE_URL } = getEnvVars();
  const insets = useSafeAreaInsets();

  // Hooks
  const { appTheme, currentTheme } = useApptheme();
  const { t } = useTranslation();
  const {
    restaurantAddressPin,
    deliveryAddressPin,
    setDistance,
    setDuration,
    order,
    tab,
    locationPin,
  } = useOrderDetail();
  const { userId } = useUserContext();
  const [localOrder, setLocalOrder] = useState<IOrder>({} as IOrder);
  const { mutateAssignOrder, mutateOrderStatus, loadingOrderStatus } =
    useDetails(order);

  // States
  const [orderId, setOrderId] = useState("");
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);

  // Map helpers
  const mapLabels = useMemo(
    () => ({
      rider: t("Rider"),
      restaurant: t("Restaurant"),
      customer: t("Delivery Address"),
    }),
    [t],
  );

  const onMarkerPress = useCallback(
    (kind: MapMarkerKind) => {
      const pin =
        kind === "rider"
          ? locationPin
          : kind === "restaurant"
            ? restaurantAddressPin
            : deliveryAddressPin;
      if (pin?.location && isValidCoordinate(pin.location)) {
        linkToMapsApp(pin.location, pin.label);
      }
    },
    [locationPin, restaurantAddressPin, deliveryAddressPin],
  );

  // Handler
  const openMaps = () => {
    try {
      // Validate all required coordinates to prevent app crashes
      // when trying to construct navigation URLs with invalid data
      if (!isValidCoordinate(locationPin?.location)) {
        console.log("Invalid rider location for maps navigation");
        Alert.alert(t("Navigation Error"), t("Rider location is unavailable."));
        return;
      }

      if (!isValidCoordinate(restaurantAddressPin?.location)) {
        console.log("Invalid store location for maps navigation");
        Alert.alert(
          t("Navigation Error"),
          t("Restaurant location is unavailable."),
        );
        return;
      }

      if (!isValidCoordinate(deliveryAddressPin?.location)) {
        console.log("Invalid customer location for maps navigation");
        Alert.alert(
          t("Navigation Error"),
          t("Delivery location is unavailable."),
        );
        return;
      }

      const rider = `${locationPin.location.latitude},${locationPin.location.longitude}`;
      const store = `${restaurantAddressPin.location.latitude},${restaurantAddressPin.location.longitude}`;
      const customer = `${deliveryAddressPin.location.latitude},${deliveryAddressPin.location.longitude}`;

      if (Platform.OS === "ios") {
        // Apple Maps (Only Rider -> Store -> Customer)
        const appleMapsUrl = `maps://app?saddr=${rider}&daddr=${localOrder?.orderStatus === "PICKED" ? customer : store}`;
        // Added error handling for Linking
        Linking.openURL(appleMapsUrl).catch(() => {
          Alert.alert(
            t("Navigation Error"),
            t("Could not open maps application"),
          );
        });
      } else {
        // OpenStreetMap directions (free, no API key). Supports waypoints:
        // Rider -> Store -> Customer, or Rider -> Customer once picked up.
        const routePoints =
          localOrder?.orderStatus === "PICKED"
            ? [rider, customer]
            : [rider, store, customer];
        const osmMapsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(routePoints.join(";"))}`;
        // Added error handling for Linking
        Linking.openURL(osmMapsUrl).catch(() => {
          Alert.alert(
            t("Navigation Error"),
            t("Could not open maps application"),
          );
        });
      }
    } catch (error) {
      // Added global error handling
      console.log("Error opening maps:", error);
      Alert.alert(
        t("Navigation Error"),
        t("An error occurred when trying to open maps"),
      );
    }
  };

  // Use Effect
  useEffect(() => {
    if (order) {
      setLocalOrder(order);
    }
  }, [order]);

  // Compute the active route with OSRM. Any failure falls back to a straight
  // line between the two points so the map never breaks.
  useEffect(() => {
    const status = localOrder?.orderStatus;

    let origin: LatLng | undefined;
    let destination: LatLng | undefined;

    if (status === "ACCEPTED" || status === "ASSIGNED") {
      origin = locationPin?.location;
      destination = restaurantAddressPin?.location;
    } else if (status === "PICKED") {
      origin = locationPin?.location;
      destination = deliveryAddressPin?.location;
    } else {
      origin = restaurantAddressPin?.location;
      destination = deliveryAddressPin?.location;
    }

    if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
      setRouteCoordinates([]);
      return;
    }

    let cancelled = false;
    const from = origin as LatLng;
    const to = destination as LatLng;

    (async () => {
      const result = await getRoute(ROUTING_URL, from, to);
      if (cancelled) return;

      if (result && result.coordinates.length > 1) {
        setRouteCoordinates(result.coordinates);
        setDistance(result.distance);
        setDuration(result.duration);
      } else {
        // Straight-line fallback
        setRouteCoordinates([from, to]);
        setDistance(null);
        setDuration(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    localOrder?.orderStatus,
    locationPin?.location?.latitude,
    locationPin?.location?.longitude,
    restaurantAddressPin?.location?.latitude,
    restaurantAddressPin?.location?.longitude,
    deliveryAddressPin?.location?.latitude,
    deliveryAddressPin?.location?.longitude,
    ROUTING_URL,
  ]);

  if (!localOrder) return;

  return (
    <>
      <GestureHandlerRootView
        className="flex-1"
        style={{ backgroundColor: appTheme.themeBackground, height: "100%" }}
      >
        <View
          style={{
            height: height * 0.5,
            backgroundColor: "transparent",
          }}
        >
          {/* <Button title="Open in Maps" onPress={openMaps} /> */}
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",

              width: 38,
              backgroundColor: appTheme.themeBackground,
              opacity: 0.75,
              position: "absolute",
              top: 60,
              right: 12,
              zIndex: 1,
            }}
          >
            <TouchableOpacity onPress={openMaps}>
              <Icons
                name="navigation"
                size={30}
                color="#1f2937"
                className={appTheme.fontMainColor}
              />
            </TouchableOpacity>
          </View>
          <OsmMap
            style={{ width: "100%", height: "100%" }}
            dark={currentTheme === "dark"}
            tileUrl={MAP_TILE_URL}
            rider={locationPin?.location}
            restaurant={restaurantAddressPin?.location}
            customer={deliveryAddressPin?.location}
            route={routeCoordinates}
            fitKey={`${localOrder?.orderStatus ?? ""}:${localOrder?._id ?? ""}`}
            labels={mapLabels}
            onMarkerPress={onMarkerPress}
            errorTitle={t("Map not loaded")}
            retryLabel={t("Retry")}
          />
        </View>

        <BottomSheet
          ref={bottomSheetRef}
          index={0} // Initially, the sheet starts at 50% height (snap point 0)
          snapPoints={["50%"]} // Snap points: 50%
          backgroundStyle={map_styles.backgroundStyle} // Optional, to style the background
          animateOnMount={true} // Ensure that the initial animation is applied
          handleIndicatorStyle={{
            backgroundColor: "transparent",
          }}
          enableDynamicSizing
          enableOverDrag={false}
          maxDynamicContentSize={height * 0.8} // Set a maximum dynamic content size (optional)
        >
          <BottomSheetView
            className="flex-1  border p-1.5 rounded-lg"
            style={{
              backgroundColor: appTheme.themeBackground,
              borderColor: appTheme.borderLineColor,
            }}
          >
            <BottomSheetScrollView
              className="p-2"
              showsVerticalScrollIndicator={false}
              style={{ backgroundColor: appTheme.themeBackground }}
            >
              {/* Order ID */}
              <View className="flex-row justify-between mb-4">
                <Text
                  className="font-bold "
                  style={{ color: appTheme.fontSecondColor }}
                >
                  {t("Order ID")}
                </Text>
                <Text style={{ color: appTheme.fontMainColor }}>
                  #{localOrder?.orderId ?? "-"}
                </Text>
              </View>

              <View className="flex-1 flex-row justify-start items-center gap-x-4 mb-4">
                <Image
                  src={localOrder?.restaurant?.image}
                  style={{ width: 32, height: 30, borderRadius: 8 }}
                />

                {localOrder?.restaurant?.name && (
                  <Text
                    className="font-[Inter] text-lg font-bold leading-7 text-left underline-offset-auto decoration-skip-ink "
                    style={{ color: appTheme.fontMainColor }}
                  >
                    {localOrder?.restaurant?.name}
                  </Text>
                )}
              </View>

              {/* Pick Up Order */}
              <View className="w-[90%] flex-row items-center gap-x-2 mb-4">
                <View>
                  <HomeIcon
                    width={30}
                    height={30}
                    color={appTheme.fontMainColor}
                  />
                </View>
                <View>
                  <Text
                    className="font-[Inter] text-base font-semibold leading-6 text-left underline-offset-auto decoration-skip-ink "
                    style={{ color: appTheme.fontSecondColor }}
                  >
                    {t("Pickup Order")}
                  </Text>
                  <Text
                    className="font-[Inter] text-base font-bold leading-6 text-left underline-offset-auto decoration-skip-ink "
                    style={{ color: appTheme.fontMainColor }}
                  >
                    {localOrder?.restaurant?.address ?? "-"}
                  </Text>
                </View>
              </View>

              {/* Payment Method */}
              <View className="flex-1 flex-row justify-between items-center mb-4">
                <Text
                  className="font-[Inter] text-[16px] text-base font-[500]"
                  style={{ color: appTheme.fontSecondColor }}
                >
                  {t("Payment Method")}
                </Text>
                <Text
                  className="font-[Inter] text-base font-semibold  text-left underline-offset-auto decoration-skip-ink   mr-2"
                  style={{ color: appTheme.fontMainColor }}
                >
                  {localOrder?.paymentMethod}
                </Text>
              </View>

              {/* Order Amount */}
              <View className="w-[99%] flex-row justify-between">
                <Text
                  className="flex-1 font-[Inter] text-[16px] text-base font-[500] "
                  style={{ color: appTheme.fontSecondColor }}
                >
                  {t("Order Amount")}
                </Text>

                <Text
                  className="flex-1 font-[Inter] font-semibold text-right "
                  style={{ color: appTheme.fontMainColor }}
                >
                  {configuration?.currencySymbol}
                  {localOrder?.orderAmount}
                  {localOrder.paymentStatus === "PAID"
                    ? t("Paid")
                    : t("(Not paid yet)")}
                </Text>
              </View>

              {/* Divider */}
              <View className="flex-1 h-[1px] mb-4" />

              <AccordionItem title={t("Order Details")}>
                <ItemDetails orderData={localOrder} tab={tab} />
              </AccordionItem>

              {/* Pick up Button */}
              {tab === "processing" &&
                localOrder.orderStatus === "ASSIGNED" && (
                  <TouchableOpacity
                    className="h-14 rounded-3xl py-3 w-full mt-4 mb-10"
                    style={{ backgroundColor: appTheme.primary }}
                    disabled={loadingOrderStatus}
                    onPress={() =>
                      mutateOrderStatus({
                        variables: { id: localOrder?._id, status: "PICKED" },
                      })
                    }
                  >
                    {loadingOrderStatus ? (
                      <SpinnerComponent />
                    ) : (
                      <Text
                        className="text-center  text-lg font-medium"
                        style={{ color: appTheme.black }}
                      >
                        {t("Pick up")}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

              {tab == "processing" && localOrder.orderStatus === "PICKED" && (
                <TouchableOpacity
                  className="h-14 rounded-3xl py-3 w-full mt-4 mb-10"
                  style={{ backgroundColor: appTheme.primary }}
                  disabled={loadingOrderStatus}
                  onPress={async () => {
                    await mutateOrderStatus({
                      variables: { id: localOrder?._id, status: "DELIVERED" },
                      onCompleted: () => {
                        setOrderId(localOrder?.orderId);
                      },
                    });
                    setOrderId(localOrder?.orderId);
                  }}
                >
                  {loadingOrderStatus ? (
                    <SpinnerComponent color="white" />
                  ) : (
                    <Text
                      className="text-center text-lg font-medium"
                      style={{ color: appTheme.black }}
                    >
                      {t("Mark as Delivered")}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {tab === "new_orders" &&
                localOrder.orderStatus === "ACCEPTED" && (
                  <View style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 10 }}>
                    <CustomContinueButton
                      title={t("Assign me")}
                      className="w-[55%] mx-auto"
                      onPress={() =>
                        mutateAssignOrder({
                          variables: { id: localOrder?._id },
                          refetchQueries: [
                            {
                              query: RIDER_ORDERS,
                              variables: { userId: userId },
                            },
                          ],
                        })
                      }
                    />
                  </View>
                )}
            </BottomSheetScrollView>
          </BottomSheetView>
        </BottomSheet>
      </GestureHandlerRootView>
      {
        <WelldoneComponent
          orderId={orderId}
          setOrderId={setOrderId}
          status={localOrder?.orderStatus === "DELIVERED" ? "Delivered" : ""}
        />
      }
    </>
  );
}
