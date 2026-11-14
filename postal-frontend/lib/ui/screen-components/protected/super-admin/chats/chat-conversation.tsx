'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';

import {
  GET_ORDER_CHAT,
  SUBSCRIBE_NEW_CHAT_MESSAGE,
} from '@/lib/api/graphql';
import { IChatMessageItem } from '@/lib/utils/interfaces/rider-wallet.interface';

interface IProps {
  /** Mongo _id of the order (AdminChatSummary.orderId). */
  orderId: string;
}

const timeOf = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
};

/** Read-only conversation with live updates (websocket subscription). */
export default function ChatConversation({ orderId }: IProps) {
  const t = useTranslations();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, loading, error, subscribeToMore, refetch } = useQuery<{
    chat: IChatMessageItem[];
  }>(GET_ORDER_CHAT, {
    variables: { order: orderId },
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    const unsubscribe = subscribeToMore<{
      subscriptionNewMessage: IChatMessageItem;
    }>({
      document: SUBSCRIBE_NEW_CHAT_MESSAGE,
      variables: { order: orderId },
      updateQuery: (prev, { subscriptionData }) => {
        const incoming = subscriptionData.data?.subscriptionNewMessage;
        if (!incoming) return prev;
        const list = prev?.chat ?? [];
        // Ignore duplicates (reconnects can redeliver).
        if (list.some((m) => m.id === incoming.id)) return prev;
        return { ...prev, chat: [...list, incoming] };
      },
      onError: (e) => console.error('Chat subscription error:', e),
    });
    return () => unsubscribe();
  }, [orderId, subscribeToMore]);

  const messages = useMemo(
    () =>
      [...(data?.chat ?? [])].sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime()
      ),
    [data]
  );

  // The first sender is shown on one side and the other participant on the opposite side.
  const firstSenderId = messages[0]?.user?.id ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <ProgressSpinner style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
        {error.message}
        <Button
          label={t('rw_retry')}
          className="ml-3"
          size="small"
          text
          onClick={() => refetch()}
        />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-gray-500">
        {t('rw_chat_empty')}
      </div>
    );
  }

  return (
    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto rounded bg-gray-50 p-3 dark:bg-dark-900">
      {messages.map((m) => {
        const isFirst = (m.user?.id ?? null) === firstSenderId;
        return (
          <div
            key={m.id}
            className={`flex ${isFirst ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                isFirst
                  ? 'bg-white text-gray-800 shadow-sm dark:bg-dark-950 dark:text-white'
                  : 'bg-primary-dark text-white'
              }`}
            >
              <div className="mb-1 text-xs font-semibold opacity-80">
                {m.user?.name || '—'}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">
                {m.message}
              </p>
              <div className="mt-1 text-end text-[11px] opacity-70">
                {timeOf(m.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
