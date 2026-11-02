'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IOrder } from '@/lib/interfaces/order';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';

interface IConfirmDialogProps {
  order: IOrder | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

export const ConfirmDialog = ({ order, busy, onCancel, onConfirm }: IConfirmDialogProps) => {
  const t = useTranslations('actions');
  const common = useTranslations('common');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (order) setNote('');
  }, [order]);

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
            onClick={() => onConfirm(note.trim())}
            disabled={busy}
            data-testid="confirm-submit"
          >
            {busy ? <Spinner /> : null}
            {t('confirmTitle')}
          </button>
        </>
      }
    >
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
    </Modal>
  );
};
