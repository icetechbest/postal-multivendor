'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';

import { SETTLE_PAST_DELIVERED_ORDERS } from '@/lib/api/graphql';
import useToast from '@/lib/hooks/useToast';

export default function SettlePastOrdersButton({
  onDone,
}: {
  onDone?: () => void;
}) {
  const t = useTranslations();
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);

  const [run, { loading }] = useMutation<{ settlePastDeliveredOrders: number }>(
    SETTLE_PAST_DELIVERED_ORDERS
  );

  const confirm = async () => {
    try {
      const res = await run();
      const count = res.data?.settlePastDeliveredOrders ?? 0;
      showToast({
        type: 'success',
        title: t('Success'),
        message: `${t('rw_settle_past_done')}: ${count}`,
        duration: 4000,
      });
      setVisible(false);
      onDone?.();
    } catch (e) {
      showToast({
        type: 'error',
        title: t('Error'),
        message: (e as Error).message || t('rw_something_went_wrong'),
        duration: 3500,
      });
    }
  };

  return (
    <>
      <Button
        label={t('rw_settle_past')}
        icon="pi pi-history"
        severity="warning"
        outlined
        onClick={() => setVisible(true)}
      />
      <Dialog
        visible={visible}
        onHide={() => !loading && setVisible(false)}
        header={t('rw_settle_past')}
        style={{ width: '32rem', maxWidth: '95vw' }}
        className="dark:bg-dark-950 dark:text-white"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label={t('Cancel')}
              className="p-button-text"
              onClick={() => setVisible(false)}
              disabled={loading}
            />
            <Button
              label={t('rw_settle_past_confirm')}
              severity="warning"
              onClick={confirm}
              loading={loading}
            />
          </div>
        }
      >
        <p className="mb-2">{t('rw_settle_past_warning')}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('rw_settle_past_note')}
        </p>
      </Dialog>
    </>
  );
}
