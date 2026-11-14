'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslations } from 'next-intl';
import type { IOrder, IRidersData } from '@/lib/interfaces/order';
import { RIDERS_QUERY } from '@/lib/graphql/pending-orders';
import { MIN_DELIVERY_PRICE } from '@/lib/config';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';

export interface IConfirmPayload {
  note: string;
  riderId?: string;
  deliveryCharges?: number;
}

interface IConfirmDialogProps {
  order: IOrder | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (payload: IConfirmPayload) => void;
}

export const ConfirmDialog = ({ order, busy, onCancel, onConfirm }: IConfirmDialogProps) => {
  const t = useTranslations('actions');
  const common = useTranslations('common');
  const [note, setNote] = useState('');
  const [riderId, setRiderId] = useState('');
  const [price, setPrice] = useState('');

  // Customer pick-up orders have no delivery, so they need neither a rider nor a price.
  const needsDispatch = !!order && !order.isPickedUp;

  const { data: ridersData, loading: ridersLoading } = useQuery<IRidersData>(RIDERS_QUERY, {
    skip: !needsDispatch,
    fetchPolicy: 'cache-and-network',
  });
  const riders = useMemo(() => ridersData?.riders ?? [], [ridersData]);

  useEffect(() => {
    if (!order) return;
    setNote('');
    setRiderId('');
    setPrice(String(Math.max(MIN_DELIVERY_PRICE, Math.round(order.deliveryCharges ?? 0))));
  }, [order]);

  const priceNumber = Number(price);
  const priceInvalid = needsDispatch && (!price.trim() || !Number.isFinite(priceNumber) || priceNumber < MIN_DELIVERY_PRICE);
  const canSubmit = !busy && (!needsDispatch || (!!riderId && !priceInvalid));

  return (
    <Modal
      open={!!order}
      title={t('confirmTitle')}
      description={
        order ? t('confirmBody', { order: `#${order.orderId ?? order._id.slice(-6)}` }) : undefined
      }
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            {common('cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              onConfirm({
                note: note.trim(),
                ...(needsDispatch ? { riderId, deliveryCharges: priceNumber } : {}),
              })
            }
            disabled={!canSubmit}
            data-testid="confirm-submit"
          >
            {busy ? <Spinner /> : null}
            {t('confirmTitle')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {needsDispatch ? (
          <>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{t('riderLabel')}</span>
              <select
                className="input"
                value={riderId}
                disabled={busy || ridersLoading}
                onChange={(event) => setRiderId(event.target.value)}
                data-testid="confirm-rider"
              >
                <option value="">{ridersLoading ? common('loading') : t('riderPlaceholder')}</option>
                {riders.map((rider) => (
                  <option key={rider._id} value={rider._id}>
                    {rider.name ?? rider._id}
                    {rider.phone ? ` · ${rider.phone}` : ''}
                    {rider.available === false ? ` (${t('riderOffline')})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{t('priceLabel')}</span>
              <input
                type="number"
                inputMode="decimal"
                className="input"
                min={MIN_DELIVERY_PRICE}
                step="1"
                value={price}
                disabled={busy}
                onChange={(event) => setPrice(event.target.value)}
                aria-invalid={priceInvalid}
                data-testid="confirm-price"
              />
              <span
                className={`text-xs ${priceInvalid ? 'text-red-600' : ''}`}
                style={priceInvalid ? undefined : { color: 'var(--text-muted)' }}
              >
                {t('priceHint', { min: MIN_DELIVERY_PRICE })}
              </span>
            </label>
          </>
        ) : null}
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t('noteLabel')}</span>
          <textarea
            className="input min-h-[80px] resize-y"
            placeholder={t('notePlaceholder')}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            data-testid="confirm-note"
          />
        </label>
      </div>
    </Modal>
  );
};
