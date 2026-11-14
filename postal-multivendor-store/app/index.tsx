import { Href, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef } from "react";

// Constant
import useNotification from "@/lib/hooks/useNotification";
import SpinnerComponent from "@/lib/ui/useable-components/spinner";
import { ROUTES, STORE_TOKEN } from "@/lib/utils/constants";

// If something in the startup chain never answers (offline, server error,
// notifications disabled...) we still leave this screen after this delay.
const INIT_TIMEOUT_MS = 6000;

function App() {
  const notificationRef = useRef(true);
  const initializedRef = useRef(false);
  const router = useRouter();
  const {
    restaurantData,
    getPermission,
    getDevicePushToken,
    sendTokenToBackend,
  } = useNotification();

  // Navigate exactly once: home when a token exists, login otherwise.
  const init = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const token = await SecureStore.getItemAsync(STORE_TOKEN);
      router.replace((token ? ROUTES.home : ROUTES.login) as Href);
    } catch (err) {
      console.log("init error:", err);
      router.replace(ROUTES.login as Href);
    }
  }, [router]);

  // 1) Not logged in -> go to login immediately; 2) otherwise never wait forever.
  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(STORE_TOKEN)
      .then((token) => {
        if (!cancelled && !token) init();
      })
      .catch(() => init());
    const timer = setTimeout(init, INIT_TIMEOUT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [init]);

  // Register the push token (when enabled), then continue in ALL cases.
  useEffect(() => {
    const checkToken = async () => {
      try {
        if (!restaurantData || !notificationRef.current) return;
        notificationRef.current = false;

        if (restaurantData?.restaurant?.enableNotification) {
          const permissionStatus = await getPermission();
          if (permissionStatus.granted) {
            const token = (await getDevicePushToken()).data;
            sendTokenToBackend({
              variables: { token, isEnabled: true },
              onCompleted: () => init(),
              onError: () => init(),
            });
            return;
          }
        }
        init();
      } catch (err) {
        console.log("checkToken error:", err);
        init();
      }
    };
    checkToken();
  }, [restaurantData]);

  return <SpinnerComponent />;
}

export default App;
