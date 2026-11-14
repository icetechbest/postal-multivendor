import { GRAPHQL_HTTP_URL } from '../config';
import { clearSession, getRefreshToken, saveSession } from './token-store';
import type { IAuthUser } from './types';

interface IGraphQLResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
}

const REFRESH_MUTATION = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      token
      refreshToken
      tokenExpiration
      user { _id name email phone role userType isActive image }
    }
  }
`;

interface IRefreshResult {
  refreshToken: {
    token: string;
    refreshToken?: string | null;
    user?: IAuthUser | null;
  };
}

let inFlight: Promise<string | null> | null = null;

/**
 * Exchanges the stored refresh token for a new access token. Concurrent callers
 * share one request so a burst of 401s cannot rotate the token twice.
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const token = getRefreshToken();
    if (!token) return null;

    try {
      const response = await fetch(GRAPHQL_HTTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: REFRESH_MUTATION,
          variables: { refreshToken: token },
        }),
      });

      const body = (await response.json()) as IGraphQLResponse<IRefreshResult>;
      const payload = body.data?.refreshToken;
      if (!response.ok || body.errors?.length || !payload?.token) {
        await clearSession();
        return null;
      }

      await saveSession({
        token: payload.token,
        refreshToken: payload.refreshToken ?? token,
        user: payload.user ?? undefined,
      });
      return payload.token;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};
