import firebaseAdmin from 'firebase-admin';
import config from '../config';

let firebaseReady = false;

const initializeFirebase = (): boolean => {
  if (firebaseReady) return true;
  if (!config.firebase.projectId || !config.firebase.clientEmail || !config.firebase.privateKey) return false;
  try {
    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      });
    }
    firebaseReady = true;
    return true;
  } catch (error) {
    console.warn('Firebase push initialization failed:', error instanceof Error ? error.message : error);
    return false;
  }
};

export const sendPushNotification = async (token: string | undefined, title: string, body: string, data: Record<string, string> = {}): Promise<void> => {
  if (!token) return;
  try {
    if (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: token, sound: 'default', title, body, data, channelId: 'default', priority: 'high' }),
      });
      if (!response.ok) console.warn(`Expo push returned HTTP ${response.status}`);
      else {
        // Expo answers 200 even when delivery fails (e.g. missing FCM credentials, DeviceNotRegistered).
        const result: any = await response.json().catch(() => null);
        const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
        if (ticket?.status === 'error') console.warn('Expo push error:', ticket.message, JSON.stringify(ticket.details || {}));
      }
      return;
    }
    if (initializeFirebase()) {
      await firebaseAdmin.messaging().send({ token, notification: { title, body }, data });
    }
  } catch (error) {
    console.warn('Push notification failed:', error instanceof Error ? error.message : error);
  }
};
