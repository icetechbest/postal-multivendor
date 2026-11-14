/* eslint-disable @typescript-eslint/no-require-imports */
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";



// Service
import setupApollo from "@/lib/apollo";

// Providers
import { AuthProvider } from "@/lib/context/global/auth.context";
import { ConfigurationProvider } from "@/lib/context/global/configuration.context";
import { ApolloProvider } from "@apollo/client";



// Locale
import "@/i18next";

// Style
import "../global.css";

// Hooks
import { UserProvider } from "@/lib/context/global/user.context";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import AppErrorBoundary from "@/lib/ui/useable-components/error-boundary";
import FlashMessage from "react-native-flash-message";

// PRoviders
import InternetProvider from "@/lib/context/global/internet-provider";
// UI
import AppThemeProvidor, { useApptheme } from "@/lib/context/theme.context";
import AnimatedSplashScreen from "@/lib/ui/useable-components/splash/AnimatedSplashScreen";
import UnavailableStatus from "@/lib/ui/useable-components/unavailable-status";


import { Slot } from "expo-router";



// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();


// Clarity.initialize('nq7dea7dt4', {
//   logLevel: Clarity.LogLevel.None, // Note: Use "LogLevel.Verbose" value while testing to debug initialization issues.
// });


// Must live INSIDE <AppThemeProvidor>, otherwise useApptheme() only returns the
// default (light) values and the status bar never follows the real theme.
function ThemedStatusBar() {
  const { currentTheme } = useApptheme();
  // expo-status-bar: "light" = WHITE icons, so dark theme -> "light"
  return <StatusBar style={currentTheme === "dark" ? "light" : "dark"} />;
}

function RootLayout() {
  // Hooks
  const [loaded, fontError] = useFonts({
    SpaceMono: require("../lib/assets/fonts/SpaceMono-Regular.ttf"),
    Inter: require("../lib/assets/fonts/Inter.ttf"),
  });

  // One client for the app lifetime (it was re-created on every render,
  // which also opened a new WebSocket each time).
  const client = useMemo(() => setupApollo(), []);
  const ready = loaded || !!fontError;

  // Use Effect
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <AppErrorBoundary>
      <ApolloProvider client={client}>
        <AppThemeProvidor>
          <AnimatedSplashScreen>
            <InternetProvider>
              <ConfigurationProvider>
                <AuthProvider client={client}>
                  <ThemedStatusBar />
                  <UserProvider>
                    <UnavailableStatus />
                    <Slot />
                  </UserProvider>
                </AuthProvider>
              </ConfigurationProvider>
            </InternetProvider>
          </AnimatedSplashScreen>
          <FlashMessage position="center" />
        </AppThemeProvidor>
      </ApolloProvider>
    </AppErrorBoundary>
  );
}

export default RootLayout;
