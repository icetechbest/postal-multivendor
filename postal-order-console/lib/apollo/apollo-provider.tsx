'use client';

import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  Observable,
  split,
  ApolloProvider as BaseApolloProvider,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { useMemo } from 'react';
import { emitSessionExpired } from '@/lib/auth/auth-context';
import { getAccessToken, refreshAccessToken } from '@/lib/auth/token-store';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8001/';
const WS_SERVER_URL = process.env.NEXT_PUBLIC_WS_SERVER_URL || 'ws://localhost:8001/';

const httpUri = `${SERVER_URL.replace(/\/$/, '')}/graphql`;
const wsUri = `${WS_SERVER_URL.replace(/\/$/, '')}/graphql`;

const createApolloClient = (): ApolloClient<unknown> => {
  const httpLink = new HttpLink({ uri: httpUri, credentials: 'include' });

  const authLink = new ApolloLink((operation, forward) => {
    const token = getAccessToken();
    operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
      headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    }));
    return forward(operation);
  });

  const errorLink = onError(({ graphQLErrors, operation, forward }) => {
    const unauthenticated = graphQLErrors?.some(
      (error) => error.extensions?.code === 'UNAUTHENTICATED',
    );
    if (!unauthenticated || !forward) return;

    return new Observable((observer) => {
      void refreshAccessToken().then((payload) => {
        if (!payload) {
          emitSessionExpired();
          observer.error(new Error('Session expired'));
          return;
        }
        const subscription = forward(operation).subscribe(observer);
        return () => subscription.unsubscribe();
      });
    });
  });

  const wsLink =
    typeof window === 'undefined'
      ? null
      : new GraphQLWsLink(
          createClient({
            url: wsUri,
            lazy: true,
            retryAttempts: Infinity,
            shouldRetry: () => true,
            connectionParams: () => {
              const token = getAccessToken();
              return token ? { authorization: `Bearer ${token}` } : {};
            },
          }),
        );

  const link = wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
          );
        },
        wsLink,
        ApolloLink.from([errorLink, authLink, httpLink]),
      )
    : ApolloLink.from([errorLink, authLink, httpLink]);

  return new ApolloClient({
    link,
    cache: new InMemoryCache({
      typePolicies: {
        Order: { keyFields: ['_id'] },
        Query: { fields: { pendingConfirmationOrders: { merge: false } } },
      },
    }),
    ssrMode: typeof window === 'undefined',
    connectToDevTools: process.env.NODE_ENV !== 'production',
  });
};

export const ApolloProvider = ({ children }: { children: React.ReactNode }) => {
  const client = useMemo(createApolloClient, []);
  return <BaseApolloProvider client={client}>{children}</BaseApolloProvider>;
};
