import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  Observable,
  split,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { print } from 'graphql';
import { createClient } from 'graphql-ws';

import { GRAPHQL_HTTP_URL, GRAPHQL_WS_URL } from '../config';
import { refreshAccessToken } from '../auth/session';
import { getAccessToken } from '../auth/token-store';

const httpLink = new HttpLink({ uri: GRAPHQL_HTTP_URL });

/** Attaches the in-memory access token to every HTTP operation. */
const authLink = new ApolloLink((operation, forward) => {
  const token = getAccessToken();
  operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
    headers: token ? { ...headers, authorization: `Bearer ${token}` } : headers,
  }));
  return forward(operation);
});

/**
 * On UNAUTHENTICATED, refresh once and replay the operation. If the refresh
 * fails the error is passed through so the auth provider can log the user out.
 */
const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  const unauthenticated = graphQLErrors?.some(
    (error) => error.extensions?.code === 'UNAUTHENTICATED',
  );
  if (!unauthenticated) return;

  return new Observable((observer) => {
    let subscription: { unsubscribe: () => void } | undefined;

    refreshAccessToken()
      .then((token) => {
        if (!token) {
          observer.error(new Error('SESSION_EXPIRED'));
          return;
        }
        operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
          headers: { ...headers, authorization: `Bearer ${token}` },
        }));
        subscription = forward(operation).subscribe(observer);
      })
      .catch((error: unknown) => observer.error(error));

    return () => subscription?.unsubscribe();
  });
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: GRAPHQL_WS_URL,
    lazy: true,
    retryAttempts: Infinity,
    shouldRetry: () => true,
    retryWait: async (attempt) =>
      new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 15_000))),
    connectionParams: () => {
      const token = getAccessToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  }),
);

const isSubscription = ({ query }: { query: unknown }): boolean => {
  const definition = getMainDefinition(query as Parameters<typeof getMainDefinition>[0]);
  return (
    definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
  );
};

const link = split(isSubscription, wsLink, ApolloLink.from([errorLink, authLink, httpLink]));

export const createApolloClient = (): ApolloClient<unknown> =>
  new ApolloClient({
    link,
    cache: new InMemoryCache({
      typePolicies: {
        Order: { keyFields: ['_id'] },
        Query: {
          fields: {
            allOrdersPaginated: { merge: false },
            restaurantsPaginated: { merge: false },
            earnings: { merge: false },
            transactionHistory: { merge: false },
            withdrawRequests: { merge: false },
            getTicketUsers: { merge: false },
            getSingleUserSupportTickets: { merge: false },
            riders: { merge: false },
            users: { merge: false },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' },
      query: { fetchPolicy: 'network-only' },
    },
  });

/** Re-exported so callers can print documents for the raw graphql-ws client. */
export { print };
