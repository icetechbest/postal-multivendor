/* eslint-disable @typescript-eslint/no-require-imports */
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import FlashMessage from "react-native-flash-message";

// Service
import setupApollo from "@/lib/apollo";

// Providers
import { AuthProvider } from "@/lib/context/global/auth.context";
import { ConfigurationProvider } from "@/lib/context/global/configuration.context";
import { LocationProvider } from "@/lib/context/global/location.context";
import { SoundProvider } from "@/lib/context/global/sound.context";
import { UserProvider } from "@/lib/context/global/user.context";
import { ApolloProvider } from "@apollo/client";

// Locale
import "@/i18next";

// Style
import InternetProvider from "@/lib/context/global/internet-provider";
import AppThemeProvidor from "@/lib/context/global/theme.context";
import RootStackLayout from "@/lib/ui/layouts/root-layout";
import { LocationPermissionComp } from "@/lib/ui/useable-components";
import AnimatedSplashScreen from "@/lib/ui/useable-components/splash/AnimatedSplashScreen";
import UnavailableStatus from "@/lib/ui/useable-components/unavailable-status";
import { requestMediaLibraryPermissionsAsync } from "expo-image-picker";
import { useEffect, useMemo } from "react";
import AppErrorBoundary from "@/lib/ui/useable-components/error-boundary";

import "../global.css";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen?.preventAutoHideAsync();

// Registered once (not on every render). Errors are logged instead of closing
// the app; render errors are shown by <AppErrorBoundary /> below.
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.log("Global Error Caught:", { error, isFatal });
  // Keep the original errors so <AppErrorBoundary /> can show them. Metro swallows
  // errors thrown while a module loads and returns `undefined`, which later shows
  // up as "Cannot read property 'ErrorBoundary' of undefined".
  try {
    const g = globalThis as any;
    (g.__APP_ERRORS__ = g.__APP_ERRORS__ || []).push(
      String((error as any)?.stack || (error as any)?.message || error),
    );
  } catch {}
});

function RootLayout() {
  // Hooks
  const [loaded, fontError] = useFonts({
    SpaceMono: require("../lib/assets/fonts/SpaceMono-Regular.ttf"),
    Inter: require("../lib/assets/fonts/Inter.ttf"),
  });
  // One Apollo client for the whole app lifetime (it used to be re-created on
  // every render, which also opened a new WebSocket each time).
  const client = useMemo(() => setupApollo(), []);
  // If a font fails to load we still start the app instead of waiting forever.
  const ready = loaded || !!fontError;

  // Permissions
  async function grantCameraAndGalleryPermissions() {
    await requestMediaLibraryPermissionsAsync();
  }

  // Use Effect
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);
  useEffect(() => {
    grantCameraAndGalleryPermissions().catch((e) =>
      console.log("Media library permission error:", e),
    );
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <AppErrorBoundary>
    <AnimatedSplashScreen>
      <AppThemeProvidor>
        <ApolloProvider client={client}>
          <AuthProvider client={client}>
            <UserProvider>
              <InternetProvider>
                <ConfigurationProvider>
                  <LocationProvider>
                    <SoundProvider>
                      <LocationPermissionComp>
                        <RootStackLayout />
                        <UnavailableStatus />
                      </LocationPermissionComp>
                      <StatusBar style="inverted" />
                      <FlashMessage position="bottom" />
                    </SoundProvider>
                  </LocationProvider>
                </ConfigurationProvider>
              </InternetProvider>
            </UserProvider>
          </AuthProvider>
        </ApolloProvider>
      </AppThemeProvidor>
    </AnimatedSplashScreen>
    </AppErrorBoundary>
  );
}

export default RootLayout;
