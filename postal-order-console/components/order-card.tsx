'use client';

import { useTranslations } from 'next-intl';
import type { IOrder } from '@/lib/interfaces/order';
import { elapsedMinutes, formatMoney, formatTime } from '@/lib/utils/format';
import { waitingClasses, waitingBorderClasses, waitingLevel } from '@/lib/utils/waiting';

interface IOrderCardProps {
  order: IOrder;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onDetails: () => void;
  onConfirm: () => void;
  onReject: () => void;
}

const paymentLabel = (key: string | null | undefined, t: (key: string) => string): string => {
  if (!key) return '—';
  return t(key);
};

export const OrderCard = ({
  order,
  selected,
  busy,
  onSelect,
  onDetails,
  onConfirm,
  onReject,
}: IOrderCardProps) => {
  const t = useTranslations('queue');
  const payment = useTranslations('payment');
  const minutes = elapsedMinutes(order.createdAt);
  const level = waitingLevel(minutes);
  const itemCount = (order.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  const itemPreview = (order.items ?? [])
    .slice(0, 2)
    .map((item) => `${item.quantity ?? 1}× ${item.title ?? '—'}`)
    .join(' · ');

  const paymentText = (key: string | null | undefined): string =>
    key && payment.has(key) ? paymentLabel(key, payment) : (key ?? '—');

  return (
    <article
      className={`card p-4 transition ${waitingBorderClasses[level]} ${
        selected ? 'ring-2 ring-primary-color' : ''
      }`}
      onClick={onSelect}
      data-testid="order-card"
      data-order-id={order._id}
      data-selected={selected}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" data-testid="order-number">
            #{order.orderId ?? order._id.slice(-6)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('created')} {formatTime(order.createdAt)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${waitingClasses[level]}`}
          data-testid="waiting-badge"
        >
          {minutes < 1
            ? t('waitingSeconds', {
                seconds: Math.max(
                  0,
                  Math.floor((Date.now() - new Date(order.createdAt ?? 0).getTime()) / 1000),
                ),
              })
            : t('waitingFor', { minutes })}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <div className="col-span-2 flex items-baseline gap-2">
          <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('customer')}
          </dt>
          <dd className="truncate font-medium">
            {order.user?.name ?? '—'}
            {order.user?.phone ? (
              <span
                className="ms-2 text-xs font-normal"
                style={{ color: 'var(--text-muted)' }}
                dir="ltr"
              >
                {order.user.phone}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="col-span-2 flex items-baseline gap-2">
          <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('store')}
          </dt>
          <dd className="truncate">{order.restaurant?.name ?? '—'}</dd>
        </div>
        <div className="col-span-2 flex items-baseline gap-2">
          <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('items')}
          </dt>
          <dd className="truncate">
            {itemCount} · {itemPreview || '—'}
          </dd>
        </div>
        <div className="col-span-2 flex items-baseline gap-2">
          <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('address')}
          </dt>
          <dd className="truncate">{order.deliveryAddress?.deliveryAddress ?? '—'}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-surface-muted px-2 py-1 font-semibold">
          {formatMoney(order.total ?? order.orderAmount)}
        </span>
        <span className="rounded-md border px-2 py-1" style={{ borderColor: 'var(--border)' }}>
          {paymentText(order.paymentMethod)}
        </span>
        <span
          className={`rounded-md px-2 py-1 ${
            order.paymentStatus === 'PAID'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
              : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
          }`}
        >
          {paymentText(order.paymentStatus)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost flex-1 text-xs"
          onClick={onDetails}
          data-testid="details-button"
        >
          {t('details')}
        </button>
        <button
          type="button"
          className="btn-primary flex-1 text-xs"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onConfirm();
          }}
          data-testid="confirm-button"
        >
          {t('confirm')}
        </button>
        <button
          type="button"
          className="btn-danger flex-1 text-xs"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onReject();
          }}
          data-testid="reject-button"
        >
          {t('reject')}
        </button>
      </div>
    </article>
  );
};
