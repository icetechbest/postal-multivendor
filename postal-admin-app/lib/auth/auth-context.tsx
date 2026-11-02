import { ApolloProvider, useApolloClient } from '@apollo/client';
import { LOGIN } from '@postal/graphql-docs';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { createApolloClient } from '../apollo/client';
import { registerPushToken } from '../notifications';
import {
  clearSession,
  getAccessToken,
  getCurrentUser,
  getExpiresAt,
  hydrateSession,
  saveSession,
} from './token-store';
import { isAllowedRole, type IAuthUser, type ILoginPayload } from './types';

export type TAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'forbidden';

interface IAuthContext {
  status: TAuthStatus;
  user: IAuthUser | null;
  locked: boolean;
  biometricEnabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  handleAuthError: (error: unknown) => void;
}

const BIOMETRIC_KEY = 'postal.biometricEnabled';

const AuthContext = createContext<IAuthContext | undefined>(undefined);

const normalizeUser = (payload: ILoginPayload): IAuthUser | null => {
  if (payload.user) return payload.user;
  if (!payload.userId) return null;
  return {
    _id: payload.userId,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    userType: payload.userType,
    image: payload.image,
  };
};

const AuthProviderInner = ({ children }: { children: React.ReactNode }) => {
  const client = useApolloClient();
  const [status, setStatus] = useState<TAuthStatus>('loading');
  const [user, setUser] = useState<IAuthUser | null>(null);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushRegisteredFor = useRef<string | null>(null);

  const logout = useCallback(async () => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    await clearSession();
    await client.clearStore().catch(() => undefined);
    setUser(null);
    setLocked(false);
    setStatus('unauthenticated');
  }, [client]);

  const scheduleExpiry = useCallback(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    const expiresAt = getExpiresAt();
    if (!expiresAt) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      void logout();
      return;
    }
    expiryTimer.current = setTimeout(() => void logout(), delay);
  }, [logout]);

  const applyUser = useCallback((nextUser: IAuthUser | null, biometricLock: boolean) => {
    setUser(nextUser);
    if (!isAllowedRole(nextUser?.role)) {
      setStatus('forbidden');
      return;
    }
    setStatus('authenticated');
    setLocked(biometricLock);
  }, []);

  // Restore a persisted session on cold start.
  useEffect(() => {
    let active = true;

    (async () => {
      const [hasSession, biometric] = await Promise.all([
        hydrateSession(),
        SecureStore.getItemAsync(BIOMETRIC_KEY),
      ]);
      if (!active) return;

      const biometricOn = biometric === 'true';
      setBiometricEnabledState(biometricOn);

      if (!hasSession) {
        setStatus('unauthenticated');
        return;
      }

      applyUser(getCurrentUser(), biometricOn);
      scheduleExpiry();
    })();

    return () => {
      active = false;
    };
  }, [applyUser, scheduleExpiry]);

  // Register the device push token once per signed-in admin so new-order
  // notifications (delivered by the existing firebase-admin backend) arrive.
  useEffect(() => {
    if (status !== 'authenticated' || !user?._id) return;
    if (pushRegisteredFor.current === user._id) return;
    pushRegisteredFor.current = user._id;
    void registerPushToken(client, user._id);
  }, [status, user?._id, client]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await client.mutate<{ login: ILoginPayload }>({
        mutation: LOGIN,
        // Backend accepts only email|google|facebook|apple; admin login is email.
        variables: { email: email.trim(), password, type: 'email' },
        fetchPolicy: 'no-cache',
      });

      const payload = data?.login;
      if (!payload?.token) {
        throw new Error('INVALID_CREDENTIALS');
      }

      const nextUser = normalizeUser(payload);
      if (!isAllowedRole(nextUser?.role)) {
        await clearSession();
        setStatus('forbidden');
        return;
      }

      await saveSession({
        token: payload.token,
        refreshToken: payload.refreshToken,
        tokenExpiration: payload.tokenExpiration,
        user: nextUser,
      });

      applyUser(nextUser, false);
      scheduleExpiry();
    },
    [applyUser, client, scheduleExpiry],
  );

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Postal Admin',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
    });
    if (!result.success) return false;
    if (!getAccessToken()) {
      await logout();
      return false;
    }
    setLocked(false);
    scheduleExpiry();
    return true;
  }, [logout, scheduleExpiry]);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    setBiometricEnabledState(enabled);
    await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
  }, []);

  const handleAuthError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('SESSION_EXPIRED') || message.includes('UNAUTHENTICATED')) {
        void logout();
      }
    },
    [logout],
  );

  const value = useMemo<IAuthContext>(
    () => ({
      status,
      user,
      locked,
      biometricEnabled,
      login,
      logout,
      unlock,
      setBiometricEnabled,
      handleAuthError,
    }),
    [
      status,
      user,
      locked,
      biometricEnabled,
      login,
      logout,
      unlock,
      setBiometricEnabled,
      handleAuthError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Owns the Apollo client and exposes auth state. Mounting this once at the app
 * root means every screen shares the same cache and websocket connection.
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const client = useMemo(() => createApolloClient(), []);

  return (
    <ApolloProvider client={client}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </ApolloProvider>
  );
};

export const useAuth = (): IAuthContext => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
