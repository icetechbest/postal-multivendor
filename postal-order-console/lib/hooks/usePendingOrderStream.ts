'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, type Client } from 'graphql-ws';
import { print } from 'graphql';
import { PENDING_ORDER_SUBSCRIPTION } from '@/lib/graphql/pending-orders';
import { getAccessToken } from '@/lib/auth/token-store';
import type { IOrder } from '@/lib/interfaces/order';

export type TConnectionStatus = 'connecting' | 'live' | 'polling' | 'offline';

interface IStreamOptions {
  enabled: boolean;
  onOrder: (order: IOrder) => void;
  onStatus: (status: TConnectionStatus) => void;
}

const WS_SERVER_URL = process.env.NEXT_PUBLIC_WS_SERVER_URL || 'ws://localhost:8001/';
const wsUri = `${WS_SERVER_URL.replace(/\/$/, '')}/graphql`;

/**
 * Dedicated graphql-ws connection for the pending-orders channel. Keeping it
 * separate from Apollo lets us surface the connection state and drive the
 * polling fallback precisely.
 */
export const usePendingOrderStream = ({ enabled, onOrder, onStatus }: IStreamOptions) => {
  const [status, setStatus] = useState<TConnectionStatus>('connecting');
  const onOrderRef = useRef(onOrder);
  const onStatusRef = useRef(onStatus);

  onOrderRef.current = onOrder;
  onStatusRef.current = onStatus;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setStatus('offline');
      onStatusRef.current('offline');
      return;
    }

    let disposed = false;
    const client: Client = createClient({
      url: wsUri,
      lazy: false,
      retryAttempts: Infinity,
      shouldRetry: () => true,
      retryWait: async (attempt) => {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 15000)));
      },
      connectionParams: () => {
        const token = getAccessToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      on: {
        connecting: () => {
          if (!disposed) {
            setStatus('connecting');
            onStatusRef.current('connecting');
          }
        },
        connected: () => {
          if (!disposed) {
            setStatus('live');
            onStatusRef.current('live');
          }
        },
        closed: () => {
          if (!disposed) {
            setStatus('polling');
            onStatusRef.current('polling');
          }
        },
        error: () => {
          if (!disposed) {
            setStatus('polling');
            onStatusRef.current('polling');
          }
        },
      },
    });

    const unsubscribe = client.subscribe(
      { query: print(PENDING_ORDER_SUBSCRIPTION) },
      {
        next: (payload) => {
          const order = (payload.data as { subscriptionPendingOrders?: IOrder } | undefined)
            ?.subscriptionPendingOrders;
          if (order?._id) onOrderRef.current(order);
        },
        error: () => {
          if (!disposed) {
            setStatus('polling');
            onStatusRef.current('polling');
          }
        },
        complete: () => {
          if (!disposed) {
            setStatus('polling');
            onStatusRef.current('polling');
          }
        },
      },
    );

    return () => {
      disposed = true;
      unsubscribe();
      void client.dispose();
    };
  }, [enabled]);

  return { status };
};
