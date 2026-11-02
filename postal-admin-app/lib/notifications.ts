import type { ApolloClient } from '@apollo/client';
import { UPLOAD_TOKEN } from '@/lib/graphql-docs';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'orders';

/** Foreground presentation: show a banner and play the default sound. */
export const configureNotificationHandler = (): void => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
};

const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'New orders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0f766e',
    sound: 'default',
  });
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!Device.isDevice) return false;
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

/**
 * Returns the native device token (FCM on Android, APNs on iOS) that the
 * existing firebase-admin backend can deliver to.
 */
export const getDevicePushToken = async (): Promise<string | null> => {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  await ensureAndroidChannel();

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === 'string' ? token.data : null;
  } catch {
    // Simulators and devices without Play Services cannot obtain a token.
    return null;
  }
};

/** Registers the device token against the signed-in admin user. */
export const registerPushToken = async (
  client: ApolloClient<unknown>,
  userId: string,
): Promise<string | null> => {
  const token = await getDevicePushToken();
  if (!token) return null;

  try {
    await client.mutate({
      mutation: UPLOAD_TOKEN,
      variables: { id: userId, pushToken: token },
      fetchPolicy: 'no-cache',
    });
  } catch {
    // Token registration is best-effort; the app still works without push.
  }
  return token;
};

/** Extracts an order id from a notification payload, if present. */
export const getOrderIdFromNotification = (
  response: Notifications.NotificationResponse,
): string | null => {
  const data = response.notification.request.content.data as Record<string, unknown> | null;
  const orderId = data?.orderId ?? data?.order_id ?? data?.id;
  return typeof orderId === 'string' ? orderId : null;
};

export const getExpoProjectId = (): string | undefined => {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const eas = extra?.eas as Record<string, unknown> | undefined;
  return typeof eas?.projectId === 'string' ? eas.projectId : undefined;
};
