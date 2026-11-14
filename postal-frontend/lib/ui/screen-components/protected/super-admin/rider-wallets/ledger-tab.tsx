'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslations } from 'next-intl';
import { DataTable, DataTablePageEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';

import { GET_RIDER_WALLET } from '@/lib/api/graphql';
import {
  WALLET_BALANCE_LABEL_KEYS,
  WALLET_TX_LABEL_KEYS,
  WALLET_TX_TYPES,
} from '@/lib/utils/constants/rider-wallet';
import {
  IRiderWallet,
  IWalletTransaction,
} from '@/lib/utils/interfaces/rider-wallet.interface';
import { formatDateTime, formatMoney } from '@/lib/utils/methods/rider-wallet';

interface IProps {
  riderId: string;
  currencySymbol?: string;
}

export default function RiderLedgerTab({ riderId, currencySymbol }: IProps) {
  const t = useTranslations();
  const [type, setType] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, loading, error } = useQuery<{
    riderWallet: {
      wallet: IRiderWallet;
      transactions: {
        transactions: IWalletTransaction[];
        total: number;
        page: number;
        totalPages: number;
      };
    };
  }>(GET_RIDER_WALLET, {
    variables: { riderId, page, limit, type },
    fetchPolicy: 'cache-and-network',
  });

  const tx = data?.riderWallet?.transactions;
  const label = (key: string, map: Record<string, string>) =>
    map[key] ? t(map[key]) : key;

  const onPage = (e: DataTablePageEvent) => {
    setPage(Math.floor(e.first / e.rows) + 1);
    setLimit(e.rows);
  };

  const typeOptions = [
    { label: t('rw_all_types'), value: 'ALL' },
    ...WALLET_TX_TYPES.map((v) => ({
      label: label(v, WALLET_TX_LABEL_KEYS),
      value: v,
    })),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">{t('rw_filter_type')}:</span>
        <Dropdown
          value={type}
          options={typeOptions}
          onChange={(e) => {
            setType(e.value);
            setPage(1);
          }}
          className="w-64"
        />
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {error.message}
        </div>
      )}

      <DataTable
        value={tx?.transactions ?? []}
        loading={loading}
        lazy
        paginator
        first={(page - 1) * limit}
        rows={limit}
        rowsPerPageOptions={[10, 20, 50]}
        totalRecords={tx?.total ?? 0}
        onPage={onPage}
        dataKey="_id"
        scrollable
        scrollHeight="460px"
        emptyMessage={t('rw_no_transactions')}
        className="dark:bg-dark-950 dark:text-white"
      >
        <Column
          header={t('rw_date')}
          style={{ minWidth: '10rem' }}
          body={(r: IWalletTransaction) => formatDateTime(r.createdAt)}
        />
        <Column
          header={t('rw_type')}
          style={{ minWidth: '11rem' }}
          body={(r: IWalletTransaction) => (
            <div className="flex flex-col gap-1">
              <span>{label(r.type, WALLET_TX_LABEL_KEYS)}</span>
              <Tag
                severity="info"
                className="w-fit"
                value={label(r.balance, WALLET_BALANCE_LABEL_KEYS)}
              />
            </div>
          )}
        />
        <Column
          header={t('rw_amount')}
          style={{ minWidth: '8rem' }}
          body={(r: IWalletTransaction) => {
            const plus = r.direction >= 0;
            return (
              <span
                dir="ltr"
                className={`font-semibold ${plus ? 'text-green-600' : 'text-red-600'}`}
              >
                {plus ? '+' : '−'}
                {formatMoney(Math.abs(r.amount), currencySymbol)}
              </span>
            );
          }}
        />
        <Column
          header={t('rw_order')}
          style={{ minWidth: '7rem' }}
          body={(r: IWalletTransaction) => r.orderId || '—'}
        />
        <Column
          header={t('rw_balance_after')}
          style={{ minWidth: '12rem' }}
          body={(r: IWalletTransaction) => (
            <div className="flex flex-col text-xs">
              {r.walletAfter != null && (
                <span>
                  {t('rw_balance_WALLET')}:{' '}
                  {formatMoney(r.walletAfter, currencySymbol)}
                </span>
              )}
              {r.debtAfter != null && (
                <span>
                  {t('rw_balance_DEBT')}:{' '}
                  {formatMoney(r.debtAfter, currencySymbol)}
                </span>
              )}
              {r.walletAfter == null && r.debtAfter == null && '—'}
            </div>
          )}
        />
        <Column
          header={t('rw_note')}
          style={{ minWidth: '12rem' }}
          body={(r: IWalletTransaction) => r.note || '—'}
        />
        <Column
          header={t('rw_created_by')}
          style={{ minWidth: '8rem' }}
          body={(r: IWalletTransaction) => r.createdBy || t('rw_system')}
        />
      </DataTable>
    </div>
  );
}
