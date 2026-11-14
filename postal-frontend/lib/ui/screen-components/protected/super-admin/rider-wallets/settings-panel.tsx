'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';

import {
  GET_RIDER_WALLET_SETTINGS,
  SET_RIDER_COMMISSION_RATE,
  SET_RIDER_LIMITS,
} from '@/lib/api/graphql';
import useToast from '@/lib/hooks/useToast';
import { IRiderWalletSettings } from '@/lib/utils/interfaces/rider-wallet.interface';

interface ISettingsPanelProps {
  canEdit: boolean;
  /** Called after a successful save so the list can refresh (limits change `blocked`). */
  onSaved?: () => void;
}

export default function RiderWalletSettingsPanel({
  canEdit,
  onSaved,
}: ISettingsPanelProps) {
  const t = useTranslations();
  const { showToast } = useToast();

  const { data, loading } = useQuery<{
    riderWalletSettings: IRiderWalletSettings;
  }>(GET_RIDER_WALLET_SETTINGS, { fetchPolicy: 'cache-and-network' });

  const [rate, setRate] = useState<number | null>(null);
  const [debtLimit, setDebtLimit] = useState<number | null>(null);
  const [cashLimit, setCashLimit] = useState<number | null>(null);

  useEffect(() => {
    const s = data?.riderWalletSettings;
    if (!s) return;
    setRate(s.commissionRate);
    setDebtLimit(s.debtLimit);
    setCashLimit(s.cashLimit);
  }, [data]);

  const [saveRate, { loading: savingRate }] = useMutation(
    SET_RIDER_COMMISSION_RATE,
    { refetchQueries: [{ query: GET_RIDER_WALLET_SETTINGS }] }
  );
  const [saveLimits, { loading: savingLimits }] = useMutation(
    SET_RIDER_LIMITS,
    { refetchQueries: [{ query: GET_RIDER_WALLET_SETTINGS }] }
  );

  const showError = (message?: string) =>
    showToast({
      type: 'error',
      title: t('Error'),
      message: message || t('rw_something_went_wrong'),
      duration: 3500,
    });

  const onSaveRate = async () => {
    if (rate === null || !(rate >= 0 && rate <= 100)) {
      return showError(t('rw_rate_range_error'));
    }
    try {
      await saveRate({ variables: { rate } });
      showToast({
        type: 'success',
        title: t('Success'),
        message: t('rw_rate_saved'),
        duration: 2500,
      });
      onSaved?.();
    } catch (e) {
      showError((e as Error).message);
    }
  };

  const onSaveLimits = async () => {
    if (debtLimit === null || cashLimit === null || debtLimit < 0 || cashLimit < 0) {
      return showError(t('rw_limits_error'));
    }
    try {
      await saveLimits({ variables: { debtLimit, cashLimit } });
      showToast({
        type: 'success',
        title: t('Success'),
        message: t('rw_limits_saved'),
        duration: 2500,
      });
      onSaved?.();
    } catch (e) {
      showError((e as Error).message);
    }
  };

  const fieldClass = 'w-full';
  const labelClass = 'mb-1 block text-sm font-medium';

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-dark-600 dark:bg-dark-900 dark:text-white">
      <h3 className="mb-3 text-base font-semibold">{t('rw_settings_title')}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>{t('rw_commission_rate')} (%)</label>
          <div className="flex items-center gap-2">
            <InputNumber
              value={rate}
              onValueChange={(e) => setRate(e.value ?? null)}
              min={0}
              max={100}
              maxFractionDigits={2}
              suffix="%"
              disabled={!canEdit || loading}
              className={fieldClass}
              inputClassName="w-full"
            />
            {canEdit && (
              <Button
                label={t('Save')}
                onClick={onSaveRate}
                loading={savingRate}
                disabled={loading}
                size="small"
              />
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
            {t('rw_commission_hint')}
          </p>
        </div>

        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t('rw_debt_limit')}</label>
              <InputNumber
                value={debtLimit}
                onValueChange={(e) => setDebtLimit(e.value ?? null)}
                min={0}
                maxFractionDigits={2}
                disabled={!canEdit || loading}
                className={fieldClass}
                inputClassName="w-full"
              />
            </div>
            <div>
              <label className={labelClass}>{t('rw_cash_limit')}</label>
              <InputNumber
                value={cashLimit}
                onValueChange={(e) => setCashLimit(e.value ?? null)}
                min={0}
                maxFractionDigits={2}
                disabled={!canEdit || loading}
                className={fieldClass}
                inputClassName="w-full"
              />
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-300">
              {t('rw_limits_hint')}
            </p>
            {canEdit && (
              <Button
                label={t('Save')}
                onClick={onSaveLimits}
                loading={savingLimits}
                disabled={loading}
                size="small"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
