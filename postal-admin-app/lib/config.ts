import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL || extra.serverUrl || 'http://localhost:8001';
export const WS_SERVER_URL =
  process.env.EXPO_PUBLIC_WS_SERVER_URL || extra.wsServerUrl || 'ws://localhost:8001';

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
