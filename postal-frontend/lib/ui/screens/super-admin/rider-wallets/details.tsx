'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { TabPanel, TabView } from 'primereact/tabview';

import { GET_RIDER_WALLET } from '@/lib/api/graphql';
import { useUserContext } from '@/lib/hooks/useUser';
import { useConfiguration } from '@/lib/hooks/useConfiguration';
import HeaderText from '@/lib/ui/useable-components/header-text';
import WalletStatCard from '@/lib/ui/screen-components/protected/super-admin/rider-wallets/wallet-stat-card';
import WalletActionDialog, {
  WalletActionMode,
} from '@/lib/ui/screen-components/protected/super-admin/rider-wallets/wallet-action-dialog';
import RiderLedgerTab from '@/lib/ui/screen-components/protected/super-admin/rider-wallets/ledger-tab';
import RiderOrdersTab from '@/lib/ui/screen-components/protected/super-admin/rider-wallets/orders-tab';
import { IRiderWallet } from '@/lib/utils/interfaces/rider-wallet.interface';
import { formatDateTime, formatMoney } from '@/lib/utils/methods/rider-wallet';

export default function RiderWalletDetailsScreen() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const riderId = String(params?.id ?? '');
  const { user } = useUserContext();
  const { CURRENCY_SYMBOL } = useConfiguration();
  const isAdmin = user?.userType === 'ADMIN';

  const [mode, setMode] = useState<WalletActionMode | null>(null);

  // limit: 1 — the summary only needs `wallet`; the ledger tab loads its own page.
  const { data, loading, error, refetch } = useQuery<{
    riderWallet: { wallet: IRiderWallet };
  }>(GET_RIDER_WALLET, {
    variables: { riderId, page: 1, limit: 1, type: 'ALL' },
    fetchPolicy: 'cache-and-network',
    skip: !riderId,
  });

  const w = data?.riderWallet?.wallet;
  const money = (v?: number | null) => formatMoney(v, CURRENCY_SYMBOL);
  const dash = (v?: string | null) => v || '—';

  return (
    <div className="screen-container p-3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            icon="pi pi-arrow-left rtl:rotate-180"
            text
            rounded
            aria-label={t('rw_back')}
            onClick={() => router.push('/wallet/rider-wallets')}
          />
          <HeaderText text={w?.name || t('Rider Wallets')} />
          {w?.blocked && <Tag severity="danger" value={t('rw_blocked')} />}
        </div>
        {isAdmin && w && (
          <div className="flex flex-wrap gap-2">
            <Button
              label={t('rw_record_payment')}
              icon="pi pi-money-bill"
              onClick={() => setMode('SETTLE')}
              disabled={w.debt <= 0}
            />
            <Button
              label={t('rw_collect_cash')}
              icon="pi pi-download"
              severity="success"
              onClick={() => setMode('COLLECT')}
              disabled={w.cashInHand <= 0}
            />
            <Button
              label={t('rw_adjust')}
              icon="pi pi-pencil"
              severity="secondary"
              onClick={() => setMode('ADJUST')}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {error.message}
          <Button
            label={t('rw_retry')}
            className="ml-3"
            size="small"
            text
            onClick={() => refetch()}
          />
        </div>
      )}

      {w?.blocked && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          <b>{t('rw_blocked')}</b>
          {w.blockedReason ? `: ${w.blockedReason}` : ''}
        </div>
      )}

      {/* Rider info */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-dark-600 dark:bg-dark-900 dark:text-white">
        <h3 className="mb-3 text-base font-semibold">{t('rw_rider_info')}</h3>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label={t('Name')} value={dash(w?.name)} />
          <Info label={t('rw_username')} value={dash(w?.username)} />
          <Info label={t('Phone')} value={dash(w?.phone)} ltr />
          <Info label={t('rw_vehicle')} value={dash(w?.vehicleType)} />
          <Info label={t('Zone')} value={dash(w?.zone)} />
          <Info
            label={t('rw_available')}
            value={w ? (w.available ? t('rw_yes') : t('rw_no')) : '—'}
          />
          <Info
            label={t('rw_active')}
            value={w ? (w.isActive ? t('rw_yes') : t('rw_no')) : '—'}
          />
          <Info
            label={t('rw_commission_rate')}
            value={w ? `${w.commissionRate}%` : '—'}
          />
        </div>
      </div>

      {/* Wallet summary */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WalletStatCard label={t('rw_earnings_balance')} value={money(w?.currentBalance)} tone="success" loading={loading && !w} />
        <WalletStatCard label={t('rw_total_earnings')} value={money(w?.totalEarnings)} loading={loading && !w} />
        <WalletStatCard label={t('rw_withdrawn')} value={money(w?.withdrawn)} loading={loading && !w} />
        <WalletStatCard label={t('rw_debt')} value={money(w?.debt)} tone={w && w.debt > 0 ? 'danger' : 'default'} hint={w && w.debtLimit > 0 ? `${t('rw_debt_limit')}: ${money(w.debtLimit)}` : undefined} loading={loading && !w} />
        <WalletStatCard label={t('rw_cash_in_hand')} value={money(w?.cashInHand)} tone={w && w.cashInHand > 0 ? 'warn' : 'default'} hint={w && w.cashLimit > 0 ? `${t('rw_cash_limit')}: ${money(w.cashLimit)}` : undefined} loading={loading && !w} />
        <WalletStatCard label={t('rw_total_commission')} value={money(w?.totalCommission)} loading={loading && !w} />
        <WalletStatCard label={t('rw_total_paid')} value={money(w?.totalPaid)} loading={loading && !w} />
        <WalletStatCard label={t('rw_net')} value={money(w?.netBalance)} tone={w && w.netBalance < 0 ? 'danger' : 'success'} hint={t('rw_net_hint')} loading={loading && !w} />
        <WalletStatCard label={t('rw_delivered_orders')} value={String(w?.deliveredOrders ?? 0)} loading={loading && !w} />
        <WalletStatCard label={t('rw_total_cash_collected')} value={money(w?.totalCashCollected)} loading={loading && !w} />
        <WalletStatCard label={t('rw_last_delivery')} value={formatDateTime(w?.lastDeliveryAt)} loading={loading && !w} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-dark-600 dark:bg-dark-900">
        <TabView>
          <TabPanel header={t('rw_tab_ledger')}>
            {riderId && (
              <RiderLedgerTab riderId={riderId} currencySymbol={CURRENCY_SYMBOL} />
            )}
          </TabPanel>
          <TabPanel header={t('rw_tab_orders')}>
            {riderId && (
              <RiderOrdersTab riderId={riderId} currencySymbol={CURRENCY_SYMBOL} />
            )}
          </TabPanel>
        </TabView>
      </div>

      {w && (
        <WalletActionDialog
          mode={mode}
          wallet={w}
          currencySymbol={CURRENCY_SYMBOL}
          onHide={() => setMode(null)}
        />
      )}
    </div>
  );
}

function Info({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-300">{label}</div>
      <div className="font-medium" dir={ltr ? 'ltr' : undefined}>
        {value}
      </div>
    </div>
  );
}
