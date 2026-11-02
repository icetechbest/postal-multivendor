import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, I18nManager, StyleSheet, View } from 'react-native';

import { LockScreen } from '../components/lock-screen';
import { AuthProvider, useAuth } from '../lib/auth/auth-context';
import { I18nProvider, useI18n } from '../lib/i18n';
import { ThemeProvider, useTheme } from '../lib/theme';
import { configureNotificationHandler } from '../lib/notifications';

configureNotificationHandler();

const RootNavigator = () => {
  const { status, locked } = useAuth();
  const { isRtl } = useI18n();
  const { colors, mode } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== isRtl) {
      I18nManager.forceRTL(isRtl);
    }
  }, [isRtl]);

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === 'login';

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/login');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (status === 'forbidden') {
      router.replace('/login');
    }
  }, [status, segments, router]);

  if (status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === 'authenticated' && locked) {
    return <LockScreen />;
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="orders/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="stores/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
};

export default function RootLayout() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
