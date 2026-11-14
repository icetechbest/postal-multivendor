import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

// On a real phone `localhost` is the phone itself, so never default to it.
const DEFAULT_SERVER_URL = 'https://postal-multivendor-production-573f.up.railway.app';
const DEFAULT_WS_SERVER_URL = 'wss://postal-multivendor-production-573f.up.railway.app';

export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL || extra.serverUrl || DEFAULT_SERVER_URL;
export const WS_SERVER_URL =
  process.env.EXPO_PUBLIC_WS_SERVER_URL || extra.wsServerUrl || DEFAULT_WS_SERVER_URL;

export const GRAPHQL_HTTP_URL = `${SERVER_URL.replace(/\/$/, '')}/graphql`;
export const GRAPHQL_WS_URL = `${WS_SERVER_URL.replace(/\/$/, '')}/graphql`;

export const WEB_ADMIN_URL =
  process.env.EXPO_PUBLIC_WEB_ADMIN_URL || extra.webAdminUrl || 'http://localhost:3000';

export const PAGE_SIZE = 15;
export const ORDERS_POLL_INTERVAL = 20_000;

export const ORDER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'ASSIGNED',
  'PICKED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type TOrderStatus = (typeof ORDER_STATUSES)[number];
