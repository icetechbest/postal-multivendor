'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslations } from 'next-intl';
import { DataTable, DataTablePageEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';

import { GET_RIDER_ORDER_HISTORY } from '@/lib/api/graphql';
import { PAYMENT_METHOD_LABEL_KEYS } from '@/lib/utils/constants/rider-wallet';
import { IRiderHistoryOrder } from '@/lib/utils/interfaces/rider-wallet.interface';
import { formatDateTime, formatMoney } from '@/lib/utils/methods/rider-wallet';
import WalletStatCard from './wallet-stat-card';

interface IProps {
  riderId: string;
  currencySymbol?: string;
}

export default function RiderOrdersTab({ riderId, currencySymbol }: IProps) {
  const t = useTranslations();
  const [range, setRange] = useState<(Date | null)[] | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const start = range?.[0] ?? null;
  const end = range?.[1] ?? null;

  // Only send the range once both ends are picked; the end covers the whole day.
  let startDate: string | undefined;
  let endDate: string | undefined;
  if (start && end) {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    startDate = s.toISOString();
    endDate = e.toISOString();
  }

  const { data, loading, error } = useQuery<{
    riderOrderHistory: {
      orders: IRiderHistoryOrder[];
      total: number;
      totalEarnings: number;
      totalCommission: number;
    };
  }>(GET_RIDER_ORDER_HISTORY, {
    variables: { riderId, page, limit, startDate, endDate },
    fetchPolicy: 'cache-and-network',
  });

  const h = data?.riderOrderHistory;
  const money = (v?: number | null) => formatMoney(v, currencySymbol);

  const onPage = (e: DataTablePageEvent) => {
    setPage(Math.floor(e.first / e.rows) + 1);
    setLimit(e.rows);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Calendar
          value={range as Date[] | null}
          onChange={(e) => {
            setRange((e.value as Date[] | null) ?? null);
            setPage(1);
          }}
          selectionMode="range"
          readOnlyInput
          showIcon
          showButtonBar
          placeholder={t('rw_date_range')}
          className="w-72"
        />
        {range && (
          <Button
            label={t('rw_clear')}
            text
            size="small"
            onClick={() => {
              setRange(null);
              setPage(1);
            }}
          />
        )}
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <WalletStatCard
          label={t('rw_orders_count')}
          value={String(h?.total ?? 0)}
          loading={loading && !h}
        />
        <WalletStatCard
          label={t('rw_sum_earnings')}
          value={money(h?.totalEarnings)}
          tone="success"
          loading={loading && !h}
        />
        <WalletStatCard
          label={t('rw_sum_commission')}
          value={money(h?.totalCommission)}
          tone="danger"
          loading={loading && !h}
        />
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {error.message}
        </div>
      )}

      <DataTable
        value={h?.orders ?? []}
        loading={loading}
        lazy
        paginator
        first={(page - 1) * limit}
        rows={limit}
        rowsPerPageOptions={[10, 20, 50]}
        totalRecords={h?.total ?? 0}
        onPage={onPage}
        dataKey="_id"
        scrollable
        scrollHeight="460px"
        emptyMessage={t('rw_no_orders')}
        className="dark:bg-dark-950 dark:text-white"
      >
        <Column
          header={t('rw_order')}
          style={{ minWidth: '7rem' }}
          body={(r: IRiderHistoryOrder) => r.orderId}
        />
        <Column
          header={t('rw_date')}
          style={{ minWidth: '10rem' }}
          body={(r: IRiderHistoryOrder) =>
            formatDateTime(r.deliveredAt || r.createdAt)
          }
        />
        <Column
          header={t('rw_payment_type')}
          style={{ minWidth: '7rem' }}
          body={(r: IRiderHistoryOrder) =>
            r.paymentMethod
              ? PAYMENT_METHOD_LABEL_KEYS[r.paymentMethod.toUpperCase()]
                ? t(PAYMENT_METHOD_LABEL_KEYS[r.paymentMethod.toUpperCase()])
                : r.paymentMethod
              : '—'
          }
        />
        <Column
          header={t('rw_order_total')}
          style={{ minWidth: '7rem' }}
          body={(r: IRiderHistoryOrder) => money(r.total)}
        />
        <Column
          header={t('rw_earning')}
          style={{ minWidth: '7rem' }}
          body={(r: IRiderHistoryOrder) => (
            <span className="text-green-600">{money(r.earning)}</span>
          )}
        />
        <Column
          header={t('rw_commission')}
          style={{ minWidth: '7rem' }}
          body={(r: IRiderHistoryOrder) => (
            <span className="text-red-600">{money(r.commission)}</span>
          )}
        />
        <Column
          header={t('rw_net')}
          style={{ minWidth: '7rem' }}
          body={(r: IRiderHistoryOrder) => (
            <span className="font-semibold">{money(r.net)}</span>
          )}
        />
        <Column
          header={t('rw_change')}
          style={{ minWidth: '7rem' }}
          body={(r: IRiderHistoryOrder) =>
            r.changeAmount ? money(r.changeAmount) : '—'
          }
        />
      </DataTable>
    </div>
  );
}
