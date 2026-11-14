'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { useTranslations } from 'next-intl';
import { DataTable, DataTablePageEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { InputSwitch } from 'primereact/inputswitch';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';

import { GET_RIDER_WALLETS } from '@/lib/api/graphql';
import useDebounce from '@/lib/hooks/useDebounce';
import { useUserContext } from '@/lib/hooks/useUser';
import { useConfiguration } from '@/lib/hooks/useConfiguration';
import HeaderText from '@/lib/ui/useable-components/header-text';
import WalletStatCard from '@/lib/ui/screen-components/protected/super-admin/rider-wallets/wallet-stat-card';
import RiderWalletSettingsPanel from '@/lib/ui/screen-components/protected/super-admin/rider-wallets/settings-panel';
import SettlePastOrdersButton from '@/lib/ui/screen-components/protected/super-admin/rider-wallets/settle-past-button';
import {
  IRiderWallet,
  IRiderWalletsPage,
} from '@/lib/utils/interfaces/rider-wallet.interface';
import { formatMoney } from '@/lib/utils/methods/rider-wallet';

export default function RiderWalletsScreen() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useUserContext();
  const { CURRENCY_SYMBOL } = useConfiguration();
  const isAdmin = user?.userType === 'ADMIN';

  const [search, setSearch] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const debouncedSearch = useDebounce(search, 500);

  const { data, loading, error, refetch } = useQuery<{
    riderWallets: IRiderWalletsPage;
  }>(GET_RIDER_WALLETS, {
    variables: {
      search: debouncedSearch.trim() || undefined,
      onlyDebt,
      page,
      limit,
    },
    fetchPolicy: 'cache-and-network',
  });

  const result = data?.riderWallets;
  const money = (v?: number | null) => formatMoney(v, CURRENCY_SYMBOL);

  const onPage = (e: DataTablePageEvent) => {
    setPage(Math.floor(e.first / e.rows) + 1);
    setLimit(e.rows);
  };

  const open = (rider: IRiderWallet) =>
    router.push(`/wallet/rider-wallets/${rider.riderId}`);

  return (
    <div className="screen-container p-3">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <HeaderText text={t('Rider Wallets')} />
        {isAdmin && <SettlePastOrdersButton onDone={() => refetch()} />}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WalletStatCard
          label={t('rw_total_debts')}
          value={money(result?.totalDebt)}
          tone="danger"
          loading={loading && !result}
        />
        <WalletStatCard
          label={t('rw_total_balances')}
          value={money(result?.totalBalance)}
          tone="success"
          loading={loading && !result}
        />
      </div>

      <RiderWalletSettingsPanel canEdit={isAdmin} onSaved={() => refetch()} />

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

      <DataTable
        value={result?.riders ?? []}
        loading={loading}
        lazy
        paginator
        first={(page - 1) * limit}
        rows={limit}
        rowsPerPageOptions={[10, 20, 50]}
        totalRecords={result?.total ?? 0}
        onPage={onPage}
        onRowClick={(e) => open(e.data as IRiderWallet)}
        rowClassName={() => 'hover-clickable-row'}
        dataKey="riderId"
        scrollable
        scrollHeight="460px"
        emptyMessage={t('rw_no_riders')}
        className="dark:bg-dark-950 dark:text-white"
        header={
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <span className="p-input-icon-left w-full md:w-80">
              <i className="pi pi-search" />
              <InputText
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('rw_search_riders')}
                className="w-full"
              />
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <InputSwitch
                checked={onlyDebt}
                onChange={(e) => {
                  setOnlyDebt(!!e.value);
                  setPage(1);
                }}
              />
              {t('rw_only_debt')}
            </label>
          </div>
        }
      >
        <Column
          header={t('Name')}
          style={{ minWidth: '10rem' }}
          body={(r: IRiderWallet) => (
            <div className="flex flex-col">
              <span className="font-medium">{r.name || '—'}</span>
              {r.blocked && (
                <Tag
                  severity="danger"
                  value={t('rw_blocked')}
                  className="mt-1 w-fit"
                />
              )}
            </div>
          )}
        />
        <Column
          header={t('Phone')}
          style={{ minWidth: '8rem' }}
          body={(r: IRiderWallet) => (
            <span dir="ltr">{r.phone || '—'}</span>
          )}
        />
        <Column
          header={t('Zone')}
          style={{ minWidth: '7rem' }}
          body={(r: IRiderWallet) => r.zone || '—'}
        />
        <Column
          header={t('rw_available')}
          style={{ minWidth: '6rem' }}
          body={(r: IRiderWallet) => (
            <Tag
              severity={r.available ? 'success' : 'secondary'}
              value={r.available ? t('rw_yes') : t('rw_no')}
            />
          )}
        />
        <Column
          header={t('rw_delivered_orders')}
          style={{ minWidth: '7rem' }}
          body={(r: IRiderWallet) => r.deliveredOrders}
        />
        <Column
          header={t('rw_earnings_balance')}
          style={{ minWidth: '8rem' }}
          body={(r: IRiderWallet) => money(r.currentBalance)}
        />
        <Column
          header={t('rw_debt')}
          style={{ minWidth: '8rem' }}
          body={(r: IRiderWallet) => (
            <span className={r.debt > 0 ? 'font-semibold text-red-600' : ''}>
              {money(r.debt)}
            </span>
          )}
        />
        <Column
          header={t('rw_cash_in_hand')}
          style={{ minWidth: '8rem' }}
          body={(r: IRiderWallet) => money(r.cashInHand)}
        />
        <Column
          header={t('rw_net')}
          style={{ minWidth: '8rem' }}
          body={(r: IRiderWallet) => (
            <span
              className={
                r.netBalance < 0
                  ? 'font-semibold text-red-600'
                  : 'font-semibold text-green-600'
              }
            >
              {money(r.netBalance)}
            </span>
          )}
        />
        <Column
          header={t('rw_total_commission')}
          style={{ minWidth: '8rem' }}
          body={(r: IRiderWallet) => money(r.totalCommission)}
        />
      </DataTable>
    </div>
  );
}
