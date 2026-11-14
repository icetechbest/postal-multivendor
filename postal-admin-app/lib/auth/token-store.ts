import * as SecureStore from 'expo-secure-store';

import type { IAuthUser } from './types';

const ACCESS_KEY = 'postal.accessToken';
const REFRESH_KEY = 'postal.refreshToken';
const USER_KEY = 'postal.authUser';
const EXPIRES_KEY = 'postal.expiresAt';

/**
 * Tokens are persisted with expo-secure-store (Keychain / Keystore) and mirrored
 * in memory so the Apollo auth link can read them synchronously on every request.
 */
let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentUser: IAuthUser | null = null;
let expiresAt = 0;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

const notify = (): void => {
  listeners.forEach((listener) => listener(accessToken));
};

export const getAccessToken = (): string | null => accessToken;
export const getRefreshToken = (): string | null => refreshToken;
export const getCurrentUser = (): IAuthUser | null => currentUser;
export const getExpiresAt = (): number => expiresAt;

export const subscribeToken = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export interface ISessionTokens {
  token: string;
  refreshToken?: string | null;
  tokenExpiration?: number | null;
  user?: IAuthUser | null;
}

export const saveSession = async (session: ISessionTokens): Promise<void> => {
  accessToken = session.token;
  refreshToken = session.refreshToken ?? refreshToken;
  currentUser = session.user ?? currentUser;
  if (typeof session.tokenExpiration === 'number' && session.tokenExpiration > 0) {
    expiresAt = Date.now() + session.tokenExpiration * 1000;
  }

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    refreshToken ? SecureStore.setItemAsync(REFRESH_KEY, refreshToken) : Promise.resolve(),
    currentUser
      ? SecureStore.setItemAsync(USER_KEY, JSON.stringify(currentUser))
      : Promise.resolve(),
    SecureStore.setItemAsync(EXPIRES_KEY, String(expiresAt)),
  ]);
  notify();
};

export const hydrateSession = async (): Promise<boolean> => {
  try {
    const [storedAccess, storedRefresh, storedUser, storedExpires] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
      SecureStore.getItemAsync(USER_KEY),
      SecureStore.getItemAsync(EXPIRES_KEY),
    ]);

    accessToken = storedAccess;
    refreshToken = storedRefresh;
    currentUser = storedUser ? (JSON.parse(storedUser) as IAuthUser) : null;
    expiresAt = storedExpires ? Number(storedExpires) : 0;
    notify();
    return Boolean(accessToken || refreshToken);
  } catch {
    return false;
  }
};

export const clearSession = async (): Promise<void> => {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  expiresAt = 0;
  notify();
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
    SecureStore.deleteItemAsync(EXPIRES_KEY),
  ]);
};
