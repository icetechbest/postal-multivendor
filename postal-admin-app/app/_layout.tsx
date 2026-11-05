import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, I18nManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { LockScreen } from '../components/lock-screen';
import { AuthProvider, useAuth } from '../lib/auth/auth-context';
import { I18nProvider, useI18n } from '../lib/i18n';
import { ThemeProvider, useTheme } from '../lib/theme';
import { configureNotificationHandler } from '../lib/notifications';

configureNotificationHandler();

// Release builds: say what went wrong instead of silently closing the app.
const globalErrorUtils = (globalThis as { ErrorUtils?: { setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void } }).ErrorUtils;
if (!__DEV__ && globalErrorUtils) {
  globalErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('Unhandled JS error', isFatal ? '(fatal)' : '', error?.message);
    Alert.alert('Error / خطأ', `${error?.name ? `${error.name}: ` : ''}${error?.message ?? ''}`);
  });
}

/**
 * Expo Router renders this instead of a blank screen when a screen crashes.
 * It sits outside the providers on purpose, so it is static and bilingual.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const stack = String(error?.stack ?? '').split('\n').slice(0, 8).join('\n');
  return (
    <View style={styles.crash}>
      <Text style={styles.crashTitle}>The app hit an error · حدث خطأ في التطبيق</Text>
      <Text style={styles.crashMessage}>
        {error?.name ? `${error.name}: ` : ''}
        {error?.message}
      </Text>
      <ScrollView style={styles.crashDetails}>
        <Text selectable style={styles.crashMono}>
          {stack}
        </Text>
      </ScrollView>
      <TouchableOpacity onPress={retry} style={styles.crashButton}>
        <Text style={styles.crashButtonText}>Try again · حاول مرة أخرى</Text>
      </TouchableOpacity>
    </View>
  );
}

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
  crash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, backgroundColor: '#fff' },
  crashTitle: { fontSize: 18, fontWeight: '700', color: '#C62828', textAlign: 'center' },
  crashMessage: { fontSize: 14, color: '#333', textAlign: 'center' },
  crashDetails: { maxHeight: 220, alignSelf: 'stretch', backgroundColor: '#F2F2F2', borderRadius: 8, padding: 10 },
  crashMono: { fontSize: 11, color: '#222', fontFamily: 'monospace' },
  crashButton: { backgroundColor: '#1565C0', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  crashButtonText: { color: '#fff', fontWeight: '700' },
});
