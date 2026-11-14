import type { ISessionPayload } from './types';

/**
 * Access tokens live in memory only. The refresh token is kept in an httpOnly
 * cookie by the Next.js route handlers, so XSS cannot read either credential
 * from localStorage.
 */
let accessToken: string | null = null;
let expiresAt = 0;
let refreshPromise: Promise<ISessionPayload | null> | null = null;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

const notify = () => listeners.forEach((listener) => listener(accessToken));

export const getAccessToken = (): string | null => accessToken;

export const getExpiresAt = (): number => expiresAt;

export const subscribeToken = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setSession = (payload: ISessionPayload): void => {
  accessToken = payload.token;
  expiresAt = Date.now() + Math.max(0, payload.tokenExpiration) * 1000;
  notify();
};

export const clearSession = (): void => {
  accessToken = null;
  expiresAt = 0;
  notify();
};

/** Calls the httpOnly-cookie refresh endpoint; de-duplicates concurrent calls. */
export const refreshAccessToken = async (): Promise<ISessionPayload | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        clearSession();
        return null;
      }
      const payload = (await response.json()) as ISessionPayload;
      setSession(payload);
      return payload;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};
