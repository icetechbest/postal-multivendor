'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { SelectButton } from 'primereact/selectbutton';

import {
  ADJUST_RIDER_WALLET,
  COLLECT_RIDER_CASH,
  SETTLE_RIDER_DEBT,
} from '@/lib/api/graphql';
import useToast from '@/lib/hooks/useToast';
import { IRiderWallet } from '@/lib/utils/interfaces/rider-wallet.interface';
import { formatMoney, round2 } from '@/lib/utils/methods/rider-wallet';

export type WalletActionMode = 'SETTLE' | 'COLLECT' | 'ADJUST';

interface IProps {
  mode: WalletActionMode | null;
  wallet: IRiderWallet;
  currencySymbol?: string;
  onHide: () => void;
}

// Everything that shows rider money is refreshed after any action.
const REFETCH = ['RiderWallet', 'RiderWallets', 'RiderOrderHistory'];

export default function WalletActionDialog({
  mode,
  wallet,
  currencySymbol,
  onHide,
}: IProps) {
  const t = useTranslations();
  const { showToast } = useToast();

  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<'CASH' | 'WALLET'>('CASH');
  const [target, setTarget] = useState<'DEBT' | 'WALLET'>('DEBT');
  const [direction, setDirection] = useState<'ADD' | 'SUBTRACT'>('SUBTRACT');
  const [error, setError] = useState('');

  const opts = { refetchQueries: REFETCH, awaitRefetchQueries: true };
  const [settle, { loading: l1 }] = useMutation(SETTLE_RIDER_DEBT, opts);
  const [collect, { loading: l2 }] = useMutation(COLLECT_RIDER_CASH, opts);
  const [adjust, { loading: l3 }] = useMutation(ADJUST_RIDER_WALLET, opts);
  const loading = l1 || l2 || l3;

  useEffect(() => {
    if (mode) {
      setAmount(null);
      setNote('');
      setMethod('CASH');
      setTarget('DEBT');
      setDirection('SUBTRACT');
      setError('');
    }
  }, [mode]);

  const money = (v: number) => formatMoney(v, currencySymbol);

  /** Upper bound for the amount (null = no cap). */
  const maxAmount = (): number | null => {
    if (mode === 'SETTLE') {
      return method === 'WALLET'
        ? Math.min(wallet.debt, wallet.currentBalance)
        : wallet.debt;
    }
    if (mode === 'COLLECT') return wallet.cashInHand;
    if (mode === 'ADJUST' && direction === 'SUBTRACT') {
      return target === 'DEBT' ? wallet.debt : wallet.currentBalance;
    }
    return null;
  };

  const validate = (): string => {
    const value = round2(amount ?? 0);
    if (!(value > 0)) return t('rw_err_amount_positive');
    const cap = maxAmount();
    if (cap !== null && value > round2(cap)) {
      if (mode === 'SETTLE')
        return method === 'WALLET'
          ? t('rw_err_exceeds_debt_or_balance')
          : t('rw_err_exceeds_debt');
      if (mode === 'COLLECT') return t('rw_err_exceeds_cash');
      return target === 'DEBT'
        ? t('rw_err_exceeds_debt')
        : t('rw_err_exceeds_balance');
    }
    if (mode === 'ADJUST' && !note.trim()) return t('rw_err_note_required');
    return '';
  };

  const submit = async () => {
    const problem = validate();
    setError(problem);
    if (problem) return;

    const value = round2(amount ?? 0);
    const trimmed = note.trim() || undefined;
    try {
      if (mode === 'SETTLE') {
        await settle({
          variables: {
            riderId: wallet.riderId,
            amount: value,
            method,
            note: trimmed,
          },
        });
      } else if (mode === 'COLLECT') {
        await collect({
          variables: { riderId: wallet.riderId, amount: value, note: trimmed },
        });
      } else {
        await adjust({
          variables: {
            riderId: wallet.riderId,
            amount: direction === 'ADD' ? value : -value,
            target,
            note: note.trim(),
          },
        });
      }
      showToast({
        type: 'success',
        title: t('Success'),
        message: t('rw_action_done'),
        duration: 2500,
      });
      onHide();
    } catch (e) {
      // Backend messages (e.g. validation) are shown as they are.
      setError((e as Error).message || t('rw_something_went_wrong'));
    }
  };

  const titles: Record<WalletActionMode, string> = {
    SETTLE: t('rw_record_payment'),
    COLLECT: t('rw_collect_cash'),
    ADJUST: t('rw_adjust'),
  };
  const cap = maxAmount();

  return (
    <Dialog
      visible={!!mode}
      onHide={() => !loading && onHide()}
      header={mode ? titles[mode] : ''}
      style={{ width: '30rem', maxWidth: '95vw' }}
      className="dark:bg-dark-950 dark:text-white"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            label={t('Cancel')}
            className="p-button-text"
            onClick={onHide}
            disabled={loading}
          />
          <Button label={t('Save')} onClick={submit} loading={loading} />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded bg-gray-50 p-3 text-sm dark:bg-dark-900">
          <div>
            {t('rw_debt')}: <b>{money(wallet.debt)}</b>
          </div>
          <div>
            {t('rw_earnings_balance')}: <b>{money(wallet.currentBalance)}</b>
          </div>
          <div>
            {t('rw_cash_in_hand')}: <b>{money(wallet.cashInHand)}</b>
          </div>
        </div>

        {mode === 'SETTLE' && (
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t('rw_payment_method')}
            </label>
            <SelectButton
              value={method}
              onChange={(e) => e.value && setMethod(e.value)}
              options={[
                { label: t('rw_method_cash'), value: 'CASH' },
                { label: t('rw_method_wallet'), value: 'WALLET' },
              ]}
              allowEmpty={false}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
              {method === 'CASH'
                ? t('rw_method_cash_hint')
                : t('rw_method_wallet_hint')}
            </p>
          </div>
        )}

        {mode === 'ADJUST' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t('rw_adjust_target')}
              </label>
              <Dropdown
                value={target}
                onChange={(e) => setTarget(e.value)}
                options={[
                  { label: t('rw_balance_DEBT'), value: 'DEBT' },
                  { label: t('rw_balance_WALLET'), value: 'WALLET' },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t('rw_adjust_direction')}
              </label>
              <SelectButton
                value={direction}
                onChange={(e) => e.value && setDirection(e.value)}
                options={[
                  { label: t('rw_adjust_add'), value: 'ADD' },
                  { label: t('rw_adjust_subtract'), value: 'SUBTRACT' },
                ]}
                allowEmpty={false}
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">
            {t('rw_amount')}
          </label>
          <InputNumber
            value={amount}
            onValueChange={(e) => setAmount(e.value ?? null)}
            min={0}
            maxFractionDigits={2}
            className="w-full"
            inputClassName="w-full"
            autoFocus
          />
          {cap !== null && (
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-300">
              <span>
                {t('rw_max_allowed')}: {money(cap)}
              </span>
              {cap > 0 && (
                <button
                  type="button"
                  className="text-primary-color underline"
                  onClick={() => setAmount(round2(cap))}
                >
                  {t('rw_use_max')}
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            {t('rw_note')}
            {mode === 'ADJUST' ? ' *' : ''}
          </label>
          <InputTextarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full"
            maxLength={500}
          />
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
