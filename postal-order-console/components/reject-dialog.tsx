'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IOrder } from '@/lib/interfaces/order';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';

const QUICK_REASONS = [
  'storeClosed',
  'outOfStock',
  'deliveryUnavailable',
  'highDemand',
  'invalidAddress',
  'other',
] as const;

interface IRejectDialogProps {
  order: IOrder | null;
  busy: boolean;
  onCancel: () => void;
  onReject: (reason: string) => void;
}

export const RejectDialog = ({ order, busy, onCancel, onReject }: IRejectDialogProps) => {
  const t = useTranslations('actions');
  const reasons = useTranslations('reasons');
  const common = useTranslations('common');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setReason('');
      setError(null);
    }
  }, [order]);

  const submit = () => {
    if (!reason.trim()) {
      setError(t('reasonRequired'));
      return;
    }
    onReject(reason.trim());
  };

  return (
    <Modal
      open={!!order}
      title={t('rejectTitle')}
      description={
        order ? t('rejectBody', { order: `#${order.orderId ?? order._id.slice(-6)}` }) : undefined
      }
      onClose={onCancel}
      danger
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            {common('cancel')}
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={submit}
            disabled={busy}
            data-testid="reject-submit"
          >
            {busy ? <Spinner /> : null}
            {t('rejectTitle')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {t('quickReasons')}
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS.map((key) => (
              <button
                key={key}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  reason === reasons(key)
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200'
                    : 'hover:bg-surface-muted'
                }`}
                style={{ borderColor: reason === reasons(key) ? undefined : 'var(--border)' }}
                onClick={() => {
                  setReason(reasons(key));
                  setError(null);
                }}
              >
                {reasons(key)}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t('reasonLabel')}</span>
          <textarea
            className="input min-h-[80px] resize-y"
            placeholder={t('reasonPlaceholder')}
            value={reason}
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            data-testid="reject-reason"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};
