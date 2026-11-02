'use client';

import { useTranslations } from 'next-intl';
import type { IOrder } from '@/lib/interfaces/order';
import { formatDateTime, formatMoney } from '@/lib/utils/format';
import { Drawer } from '@/components/ui/drawer';

interface IOrderDetailsDrawerProps {
  order: IOrder | null;
  onClose: () => void;
  onConfirm: (order: IOrder) => void;
  onReject: (order: IOrder) => void;
  busy: boolean;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span className="text-end font-medium">{value}</span>
  </div>
);

export const OrderDetailsDrawer = ({
  order,
  onClose,
  onConfirm,
  onReject,
  busy,
}: IOrderDetailsDrawerProps) => {
  const t = useTranslations('drawer');
  const queue = useTranslations('queue');
  const common = useTranslations('common');
  const payment = useTranslations('payment');

  const paymentText = (key: string | null | undefined): string =>
    key && payment.has(key) ? payment(key) : (key ?? '—');

  const subtotal = (order?.items ?? []).reduce((sum, item) => {
    const unit = item.variation?.discounted ?? item.variation?.price ?? 0;
    return sum + unit * (item.quantity ?? 1);
  }, 0);

  return (
    <Drawer
      open={!!order}
      title={t('title')}
      onClose={onClose}
      footer={
        order ? (
          <>
            <button type="button" className="btn-ghost" onClick={onClose}>
              {common('close')}
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => onReject(order)}
            >
              {queue('reject')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => onConfirm(order)}
            >
              {queue('confirm')}
            </button>
          </>
        ) : null
      }
    >
      {order ? (
        <div className="space-y-5">
          <div>
            <p className="text-lg font-semibold">#{order.orderId ?? order._id.slice(-6)}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('orderTime')}: {formatDateTime(order.createdAt)}
            </p>
          </div>

          <section className="space-y-1">
            <Row label={t('customer')} value={order.user?.name ?? '—'} />
            {order.user?.phone ? (
              <Row label="Phone" value={<span dir="ltr">{order.user.phone}</span>} />
            ) : null}
            {order.user?.email ? (
              <Row label="Email" value={<span dir="ltr">{order.user.email}</span>} />
            ) : null}
            <Row label={t('store')} value={order.restaurant?.name ?? '—'} />
            <Row label={t('paymentMethod')} value={paymentText(order.paymentMethod)} />
            <Row label={t('paymentStatus')} value={paymentText(order.paymentStatus)} />
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">{t('items')}</h3>
            <ul className="space-y-3">
              {(order.items ?? []).map((item, index) => (
                <li
                  key={item._id ?? index}
                  className="rounded-xl border p-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      {item.quantity ?? 1}× {item.title ?? '—'}
                    </p>
                    <span className="text-sm font-semibold">
                      {formatMoney(
                        (item.variation?.discounted ?? item.variation?.price ?? 0) *
                          (item.quantity ?? 1),
                      )}
                    </span>
                  </div>
                  {item.variation?.title ? (
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.variation.title}
                    </p>
                  ) : null}
                  {item.addons && item.addons.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium">{t('addons')}</p>
                      {item.addons.map((addon, addonIndex) => (
                        <p
                          key={addon._id ?? addonIndex}
                          className="text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {addon.title}
                          {addon.options && addon.options.length > 0
                            ? ` — ${addon.options.map((option) => `${option.title}${option.price ? ` (${formatMoney(option.price)})` : ''}`).join(', ')}`
                            : ''}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {item.specialInstructions ? (
                    <p className="mt-2 rounded-lg bg-surface-muted px-2 py-1 text-xs">
                      {t('notes')}: {item.specialInstructions}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">{t('address')}</h3>
            <p className="text-sm">{order.deliveryAddress?.deliveryAddress ?? '—'}</p>
            {order.deliveryAddress?.details ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {order.deliveryAddress.details}
              </p>
            ) : null}
            {order.deliveryAddress?.location?.coordinates ? (
              <a
                className="mt-1 inline-block text-xs text-primary-color underline"
                href={`https://www.google.com/maps/search/?api=1&query=${order.deliveryAddress.location.coordinates[1]},${order.deliveryAddress.location.coordinates[0]}`}
                target="_blank"
                rel="noreferrer"
              >
                {t('coordinates')}: {order.deliveryAddress.location.coordinates.join(', ')}
              </a>
            ) : null}
          </section>

          {order.instructions ? (
            <section>
              <h3 className="mb-1 text-sm font-semibold">{t('notes')}</h3>
              <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm">{order.instructions}</p>
            </section>
          ) : null}

          <section className="space-y-1 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <Row label={t('subtotal')} value={formatMoney(subtotal)} />
            <Row label={t('deliveryFee')} value={formatMoney(order.deliveryCharges)} />
            <Row label={t('taxes')} value={formatMoney(order.taxationAmount)} />
            <Row label={t('tips')} value={formatMoney(order.tipping)} />
            <Row label={t('coupon')} value={`- ${formatMoney(order.discount)}`} />
            <div
              className="mt-2 flex items-baseline justify-between border-t pt-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-sm font-semibold">{t('total')}</span>
              <span className="text-lg font-bold">
                {formatMoney(order.total ?? order.orderAmount)}
              </span>
            </div>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
};
