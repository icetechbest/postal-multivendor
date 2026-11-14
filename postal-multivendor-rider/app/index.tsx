// Expo
import * as Notifications from "expo-notifications";
import { Href, useRouter } from "expo-router";
import { Platform } from "react-native";

// Core
import { useCallback, useEffect } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

// Context
import { useLocationContext } from "@/lib/context/global/location.context";

// API
import { RIDER_ORDERS } from "@/lib/apollo/queries";
import { SYNC_PUSH_TOKEN } from "@/lib/apollo/mutations/rider.mutation";
import { getNotificationToken } from "@/lib/utils/methods/permission";
import { useApolloClient } from "@apollo/client";

// Constant
import { RIDER_TOKEN, ROUTES } from "@/lib/utils/constants";

// Interfaces
import { IOrder } from "@/lib/utils/interfaces/order.interface";
import { useUserContext } from "@/lib/context/global/user.context";

function App() {
  // Reuse the app-wide client (calling setupApollo() here created a second
  // client + WebSocket on every render).
  const client = useApolloClient();
  const router = useRouter();
  const { locationPermission } = useLocationContext();
  const { dataProfile } = useUserContext();
  // Handler

  const init = async () => {
    const token = await AsyncStorage.getItem(RIDER_TOKEN);
    if (token) {
      router.replace(ROUTES.home as Href);
      return;
    }
    router.replace(ROUTES.login as Href);
  };

  // Notification Handler
  const registerForPushNotification = async () => {
    // Android needs a high-importance channel for heads-up banners + sound.
    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Orders",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      } catch (err) {
        console.log("Failed to create notification channel", err);
      }
    }
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus === "granted") {
      Notifications.setNotificationHandler({
        handleNotification: async () => {
          return {
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          };
        },
      });
    }
  };

  const handleNotification = useCallback(
    async (response: Notifications.NotificationResponse) => {
      if (
        response &&
        response.notification &&
        response.notification.request &&
        response.notification.request.content &&
        response.notification.request.content.data
      ) {
        const { _id, type } = response.notification.request.content.data;
        const { data } = await client.query({
          query: RIDER_ORDERS,
          fetchPolicy: "network-only",
        });
        const order = data.riderOrders.find((o: IOrder) => o._id === _id);

        // New chat message: open the conversation of that order (every message, no dedupe).
        if (type === "chat") {
          router.push({
            pathname: "/chat",
            params: {
              id: _id,
              orderId: order?.orderId ?? "",
              phoneNumber: order?.user?.phone ?? "",
            },
          });
          return;
        }
        const lastNotificationHandledId = await AsyncStorage.getItem(
          "@lastNotificationHandledId"
        );
        if (lastNotificationHandledId === _id) return;
        await AsyncStorage.setItem("@lastNotificationHandledId", _id);

        router.navigate("/order-detail");
        router.setParams({ itemId: _id, order });
      }
    },
    []
  );

  // Use Effect
  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleNotification);

    return () => subscription.remove();
  }, [handleNotification]);

  useEffect(() => {
    registerForPushNotification();

    // Register a notification handler that will be called when a notification is received.
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        return {
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
    });
  }, []);

  // Riders who stay logged in never pass through the login screen again, so
  // re-send the push token on every app start. Without it they get no push.
  useEffect(() => {
    if (!dataProfile?._id) return;
    (async () => {
      try {
        const token = await getNotificationToken();
        if (token) {
          await client.mutate({ mutation: SYNC_PUSH_TOKEN, variables: { token } });
        }
      } catch (err) {
        console.log("Failed to sync push token", err);
      }
    })();
  }, [dataProfile?._id]);

  useEffect(() => {
    init();
  }, [locationPermission, router, dataProfile]);

  // return <Redirect href="/(tabs)/home/orders" />;
  // return <Redirect href="/login" />;
  return <></>;
}

export default App;
