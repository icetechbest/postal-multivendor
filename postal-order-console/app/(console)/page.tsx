'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslations } from 'next-intl';
import {
  CONFIRM_ORDER_MUTATION,
  PENDING_ORDERS_QUERY,
  REJECT_ORDER_MUTATION,
  TODAY_STATS_QUERY,
} from '@/lib/graphql/pending-orders';
import type { IOrder, IPendingOrdersData, ITodayStatsData } from '@/lib/interfaces/order';
import { PAGE_SIZE, POLL_INTERVAL_MS } from '@/lib/config';
import { isAlreadyHandledError, isSameLocalDay } from '@/lib/utils/format';
import { usePendingOrderStream, type TConnectionStatus } from '@/lib/hooks/usePendingOrderStream';
import { useSound } from '@/lib/hooks/useSound';
import { useBrowserNotifications } from '@/lib/hooks/useBrowserNotifications';
import { useToast } from '@/components/ui/toast';
import { OrderCard } from '@/components/order-card';
import { OrderDetailsDrawer } from '@/components/order-details-drawer';
import { ConfirmDialog, type IConfirmPayload } from '@/components/confirm-dialog';
import { RejectDialog } from '@/components/reject-dialog';
import { SkeletonCard, Spinner } from '@/components/ui/spinner';

const STATUS_STYLES: Record<TConnectionStatus, string> = {
  live: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  connecting: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  polling: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  offline: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

export default function QueuePage() {
  const t = useTranslations('queue');
  const actions = useTranslations('actions');
  const common = useTranslations('common');
  const { showToast } = useToast();
  const { enabled: soundEnabled, toggle: toggleSound, play: playSound } = useSound();
  const { permission, requestPermission, notify } = useBrowserNotifications();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<IOrder | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<IOrder | null>(null);
  const [rejectTarget, setRejectTarget] = useState<IOrder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [delta, setDelta] = useState({ confirmed: 0, rejected: 0 });
  const [newCount, setNewCount] = useState(0);
  const [connection, setConnection] = useState<TConnectionStatus>('connecting');

  const { data, loading, error, refetch, networkStatus } = useQuery<IPendingOrdersData>(
    PENDING_ORDERS_QUERY,
    {
      variables: { page, limit: PAGE_SIZE, search: search || undefined },
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    },
  );

  const { data: statsData, refetch: refetchStats } = useQuery<ITodayStatsData>(TODAY_STATS_QUERY, {
    fetchPolicy: 'cache-and-network',
  });

  const [confirmOrder] = useMutation(CONFIRM_ORDER_MUTATION);
  const [rejectOrder] = useMutation(REJECT_ORDER_MUTATION);

  // Debounce the search box so we do not hammer the API on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleIncomingOrder = useCallback(
    (order: IOrder) => {
      setNewCount((current) => current + 1);
      playSound();
      notify(
        t('newOrders', { count: 1 }),
        `#${order.orderId ?? order._id.slice(-6)} · ${order.restaurant?.name ?? ''} · ${order.user?.name ?? ''}`,
      );
      void refetch();
      void refetchStats();
    },
    [notify, playSound, refetch, refetchStats, t],
  );

  const handleStatus = useCallback((status: TConnectionStatus) => setConnection(status), []);

  usePendingOrderStream({ enabled: true, onOrder: handleIncomingOrder, onStatus: handleStatus });

  // Polling fallback whenever the socket is not live.
  useEffect(() => {
    if (connection === 'live') return;
    const timer = window.setInterval(() => {
      void refetch();
      void refetchStats();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [connection, refetch, refetchStats]);

  // Title badge for unseen orders.
  useEffect(() => {
    const base = common('appName');
    document.title =
      newCount > 0 ? `(${newCount}) ${t('newOrders', { count: newCount })} · ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [newCount, t, common]);

  const orders = useMemo(
    () =>
      (data?.pendingConfirmationOrders.orders ?? []).filter(
        (order) => !hiddenIds.includes(order._id),
      ),
    [data, hiddenIds],
  );

  const pendingNow = Math.max(0, (data?.pendingConfirmationCount ?? 0) - hiddenIds.length);
  const totalPages = data?.pendingConfirmationOrders.totalPages ?? 1;
  const totalCount = data?.pendingConfirmationOrders.totalCount ?? 0;

  const stats = useMemo(() => {
    const all = statsData?.allOrdersWithoutPagination ?? [];
    const confirmed = all.filter(
      (order) => order.adminConfirmedAt && isSameLocalDay(order.adminConfirmedAt),
    ).length;
    const rejected = all.filter(
      (order) => order.adminRejectedAt && isSameLocalDay(order.adminRejectedAt),
    ).length;
    return { confirmed: confirmed + delta.confirmed, rejected: rejected + delta.rejected };
  }, [statsData, delta]);

  const selectedIndex = orders.findIndex((order) => order._id === selectedId);

  // Keep a valid selection as the list changes.
  useEffect(() => {
    if (orders.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !orders.some((order) => order._id === selectedId)) {
      setSelectedId(orders[0]?.orderId ? orders[0]._id : (orders[0]?._id ?? null));
    }
  }, [orders, selectedId]);

  const removeOrder = (id: string) => {
    setHiddenIds((current) => (current.includes(id) ? current : [...current, id]));
    if (selectedId === id) setSelectedId(null);
    setDetailsOrder((current) => (current?._id === id ? null : current));
  };

  const runConfirm = async (order: IOrder, payload: IConfirmPayload) => {
    setBusyId(order._id);
    try {
      await confirmOrder({
        variables: {
          id: order._id,
          note: payload.note || undefined,
          riderId: payload.riderId,
          deliveryCharges: payload.deliveryCharges,
        },
      });
      removeOrder(order._id);
      setDelta((current) => ({ ...current, confirmed: current.confirmed + 1 }));
      showToast(actions('confirmed'), 'success');
      setConfirmTarget(null);
      void refetchStats();
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : undefined;
      if (isAlreadyHandledError(message)) {
        removeOrder(order._id);
        showToast(actions('alreadyHandled'), 'info');
      } else {
        showToast(message || actions('errorGeneric'), 'error');
      }
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  const runReject = async (order: IOrder, reason: string) => {
    setBusyId(order._id);
    try {
      await rejectOrder({ variables: { id: order._id, reason } });
      removeOrder(order._id);
      setDelta((current) => ({ ...current, rejected: current.rejected + 1 }));
      showToast(actions('rejected'), 'success');
      setRejectTarget(null);
      void refetchStats();
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : undefined;
      if (isAlreadyHandledError(message)) {
        removeOrder(order._id);
        showToast(actions('alreadyHandled'), 'info');
      } else {
        showToast(message || actions('errorGeneric'), 'error');
      }
      setRejectTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  // Keyboard shortcuts: arrows move selection, C confirms, R rejects.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (confirmTarget || rejectTarget || detailsOrder) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (orders.length === 0) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const current = selectedIndex < 0 ? 0 : selectedIndex;
        const next =
          event.key === 'ArrowDown'
            ? Math.min(orders.length - 1, current + 1)
            : Math.max(0, current - 1);
        const nextOrder = orders[next];
        if (nextOrder) setSelectedId(nextOrder._id);
        return;
      }

      const current = selectedIndex >= 0 ? orders[selectedIndex] : orders[0];
      if (!current) return;
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setConfirmTarget(current);
      }
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setRejectTarget(current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orders, selectedIndex, confirmTarget, rejectTarget, detailsOrder]);

  const refreshing = networkStatus === 4 || (loading && !data);

  const refreshAll = () => {
    setNewCount(0);
    void refetch();
    void refetchStats();
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[connection]}`}
            data-testid="connection-status"
            title={connection}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {connection === 'live'
              ? t('connectionLive')
              : connection === 'offline'
                ? t('connectionOffline')
                : t('connectionPolling')}
          </span>
          <button
            type="button"
            className="btn-ghost px-2.5 py-1.5 text-xs"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? `🔔 ${t('soundOn')}` : `🔕 ${t('soundOff')}`}
          </button>
          {permission === 'default' ? (
            <button
              type="button"
              className="btn-ghost px-2.5 py-1.5 text-xs"
              onClick={() => void requestPermission()}
            >
              {t('enableNotifications')}
            </button>
          ) : null}
          {permission === 'denied' ? (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('notificationsBlocked')}
            </span>
          ) : null}
          <button
            type="button"
            className="btn-ghost px-2.5 py-1.5 text-xs"
            onClick={refreshAll}
            disabled={refreshing}
          >
            {refreshing ? <Spinner /> : null}
            {common('refresh')}
          </button>
        </div>
      </div>

      {newCount > 0 ? (
        <button
          type="button"
          className="border-primary-color/40 bg-primary-color/10 w-full rounded-xl border px-4 py-2 text-sm font-medium text-primary-color"
          onClick={refreshAll}
          data-testid="new-orders-banner"
        >
          {t('newOrders', { count: newCount })} — {common('refresh')}
        </button>
      ) : null}

      <section className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center" data-testid="pending-count">
          <p className="text-2xl font-bold">{pendingNow}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('pendingNow')}
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.confirmed}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('confirmedToday')}
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('rejectedToday')}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="input flex-1 sm:max-w-sm"
          placeholder={t('searchPlaceholder')}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          data-testid="search-input"
          aria-label={common('search')}
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('results', { count: totalCount })}
        </span>
      </div>

      {error && !data ? (
        <div className="card space-y-3 p-6 text-center">
          <p className="text-sm text-red-600">{common('error')}</p>
          <button type="button" className="btn-primary mx-auto" onClick={() => void refetch()}>
            {common('retry')}
          </button>
        </div>
      ) : loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card space-y-1 p-10 text-center" data-testid="empty-state">
          <p className="text-3xl">✅</p>
          <p className="font-medium">{t('empty')}</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('emptyHint')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {orders.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              selected={order._id === selectedId}
              busy={busyId === order._id}
              onSelect={() => setSelectedId(order._id)}
              onDetails={() => setDetailsOrder(order)}
              onConfirm={() => setConfirmTarget(order)}
              onReject={() => setRejectTarget(order)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('page', { current: page, total: Math.max(1, totalPages) })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost text-xs"
            disabled={page <= 1 || refreshing}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('prev')}
          </button>
          <button
            type="button"
            className="btn-ghost text-xs"
            disabled={page >= totalPages || refreshing}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('next')}
          </button>
        </div>
      </div>

      <details className="card p-3 text-xs">
        <summary className="cursor-pointer font-medium">{t('shortcuts')}</summary>
        <ul className="mt-2 space-y-1" style={{ color: 'var(--text-muted)' }}>
          <li>{t('shortcutNavigate')}</li>
          <li>{t('shortcutConfirm')}</li>
          <li>{t('shortcutReject')}</li>
        </ul>
      </details>

      <OrderDetailsDrawer
        order={detailsOrder}
        busy={!!busyId}
        onClose={() => setDetailsOrder(null)}
        onConfirm={(order) => {
          setDetailsOrder(null);
          setConfirmTarget(order);
        }}
        onReject={(order) => {
          setDetailsOrder(null);
          setRejectTarget(order);
        }}
      />

      <ConfirmDialog
        order={confirmTarget}
        busy={!!busyId}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={(payload) => {
          if (confirmTarget) void runConfirm(confirmTarget, payload);
        }}
      />

      <RejectDialog
        order={rejectTarget}
        busy={!!busyId}
        onCancel={() => setRejectTarget(null)}
        onReject={(reason) => {
          if (rejectTarget) void runReject(rejectTarget, reason);
        }}
      />
    </main>
  );
}
