import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { getOrderIdFromNotification } from '../../lib/notifications';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

type TIconName = keyof typeof Ionicons.glyphMap;

const icon =
  (name: TIconName, focusedName: TIconName) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) =>
    <Ionicons name={focused ? focusedName : name} color={color} size={size} />;

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  // Deep link from a push notification straight to the order detail screen.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const orderId = getOrderIdFromNotification(response);
      if (orderId) router.push(`/orders/${orderId}`);
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: icon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{ title: t('tabs.orders'), tabBarIcon: icon('receipt-outline', 'receipt') }}
      />
      <Tabs.Screen
        name="stores/index"
        options={{ title: t('tabs.stores'), tabBarIcon: icon('storefront-outline', 'storefront') }}
      />
      <Tabs.Screen
        name="riders/index"
        options={{ title: t('tabs.riders'), tabBarIcon: icon('bicycle-outline', 'bicycle') }}
      />
      <Tabs.Screen
        name="wallet/index"
        options={{ title: t('tabs.wallet'), tabBarIcon: icon('wallet-outline', 'wallet') }}
      />
      <Tabs.Screen
        name="more/index"
        options={{ title: t('tabs.more'), tabBarIcon: icon('ellipsis-horizontal', 'ellipsis-horizontal') }}
      />
    </Tabs>
  );
}
