import type { IAuthUser } from './types';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8001/';

interface IGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

export const graphqlRequest = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(`${SERVER_URL.replace(/\/$/, '')}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  const body = (await response.json()) as IGraphQLResponse<T>;
  if (!response.ok || body.errors?.length || !body.data) {
    const message = body.errors?.[0]?.message || 'Authentication failed';
    throw new Error(message);
  }
  return body.data;
};

export const LOGIN_MUTATION = `
  mutation ConsoleLogin($email: String, $password: String, $type: String!) {
    login(email: $email, password: $password, type: $type) {
      userId
      token
      refreshToken
      tokenExpiration
      userType
      user { _id name email role image }
    }
  }
`;

export const REFRESH_MUTATION = `
  mutation ConsoleRefresh($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      token
      refreshToken
      tokenExpiration
      user { _id name email role image }
    }
  }
`;

export interface ILoginResult {
  login: {
    userId?: string | null;
    token: string;
    refreshToken?: string | null;
    tokenExpiration?: number | null;
    userType?: string | null;
    user?: IAuthUser | null;
  };
}

export interface IRefreshResult {
  refreshToken: {
    token: string;
    refreshToken?: string | null;
    tokenExpiration?: number | null;
    user?: IAuthUser | null;
  };
}
