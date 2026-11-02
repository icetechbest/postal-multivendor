'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, getExpiresAt, refreshAccessToken, setSession } from './token-store';
import { isAllowedRole, type IAuthUser } from './types';

type TAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'forbidden';

interface IAuthContext {
  user: IAuthUser | null;
  status: TAuthStatus;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: (redirect?: boolean) => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);

const SESSION_EXPIRED_EVENT = 'poc:session-expired';

export const emitSessionExpired = (): void => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<IAuthUser | null>(null);
  const [status, setStatus] = useState<TAuthStatus>('loading');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const applyUser = useCallback((nextUser: IAuthUser) => {
    setUser(nextUser);
    setStatus(isAllowedRole(nextUser.role) ? 'authenticated' : 'forbidden');
  }, []);

  const scheduleRefresh = useCallback(() => {
    clearTimer();
    const expiresAt = getExpiresAt();
    if (!expiresAt) return;
    // Refresh one minute before expiry; if that fails, end the session.
    const delay = Math.max(5_000, expiresAt - Date.now() - 60_000);
    timerRef.current = setTimeout(async () => {
      const payload = await refreshAccessToken();
      if (payload) {
        applyUser(payload.user);
        scheduleRefresh();
      } else {
        clearSession();
        setUser(null);
        setStatus('unauthenticated');
      }
    }, delay);
  }, [applyUser]);

  const refresh = useCallback(async (): Promise<boolean> => {
    const payload = await refreshAccessToken();
    if (!payload) {
      setUser(null);
      setStatus('unauthenticated');
      return false;
    }
    applyUser(payload.user);
    scheduleRefresh();
    return true;
  }, [applyUser, scheduleRefresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const body = (await response.json()) as {
          message?: string;
          token?: string;
          tokenExpiration?: number;
          user?: IAuthUser;
        };
        if (!response.ok || !body.token || !body.user) {
          return { ok: false, message: body.message || 'Invalid email or password' };
        }
        setSession({
          token: body.token,
          tokenExpiration: body.tokenExpiration ?? 3600,
          user: body.user,
        });
        applyUser(body.user);
        scheduleRefresh();
        return { ok: true };
      } catch {
        return { ok: false, message: 'Network error. Please try again.' };
      }
    },
    [applyUser, scheduleRefresh],
  );

  const logout = useCallback(
    async (redirect = true) => {
      clearTimer();
      clearSession();
      setUser(null);
      setStatus('unauthenticated');
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch {
        // Clearing the in-memory token is enough to end the UI session.
      }
      if (redirect) router.replace('/login');
    },
    [router],
  );

  useEffect(() => {
    void refresh();
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onExpired = () => {
      void logout(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

  const value = useMemo(
    () => ({ user, status, login, logout, refresh }),
    [user, status, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): IAuthContext => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
