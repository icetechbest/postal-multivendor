'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslations } from 'next-intl';
import { DataTable, DataTablePageEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';

import { GET_ADMIN_CHATS } from '@/lib/api/graphql';
import useDebounce from '@/lib/hooks/useDebounce';
import HeaderText from '@/lib/ui/useable-components/header-text';
import ChatConversation from '@/lib/ui/screen-components/protected/super-admin/chats/chat-conversation';
import { IAdminChatSummary } from '@/lib/utils/interfaces/rider-wallet.interface';
import { formatDateTime } from '@/lib/utils/methods/rider-wallet';

export default function ChatsScreen() {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<IAdminChatSummary | null>(null);
  const debounced = useDebounce(search, 500);

  const { data, loading, error, refetch } = useQuery<{
    adminChats: {
      chats: IAdminChatSummary[];
      total: number;
      page: number;
      totalPages: number;
    };
  }>(GET_ADMIN_CHATS, {
    variables: { search: debounced.trim() || undefined, page, limit },
    fetchPolicy: 'cache-and-network',
  });

  const result = data?.adminChats;

  const onPage = (e: DataTablePageEvent) => {
    setPage(Math.floor(e.first / e.rows) + 1);
    setLimit(e.rows);
  };

  const person = (name?: string | null, phone?: string | null) => (
    <div className="flex flex-col">
      <span>{name || '—'}</span>
      {phone && (
        <span className="text-xs text-gray-500" dir="ltr">
          {phone}
        </span>
      )}
    </div>
  );

  return (
    <div className="screen-container p-3">
      <div className="mb-4">
        <HeaderText text={t('Chats')} />
        <p className="mt-1 text-gray-500 dark:text-white">
          {t('rw_chats_desc')}
        </p>
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

      <DataTable
        value={result?.chats ?? []}
        loading={loading}
        lazy
        paginator
        first={(page - 1) * limit}
        rows={limit}
        rowsPerPageOptions={[10, 20, 50]}
        totalRecords={result?.total ?? 0}
        onPage={onPage}
        onRowClick={(e) => setSelected(e.data as IAdminChatSummary)}
        rowClassName={() => 'hover-clickable-row'}
        dataKey="orderId"
        scrollable
        scrollHeight="520px"
        emptyMessage={t('rw_no_chats')}
        className="dark:bg-dark-950 dark:text-white"
        header={
          <span className="p-input-icon-left w-full md:w-96">
            <i className="pi pi-search" />
            <InputText
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('rw_search_chats')}
              className="w-full"
            />
          </span>
        }
      >
        <Column
          header={t('rw_order')}
          style={{ minWidth: '7rem' }}
          body={(r: IAdminChatSummary) => r.orderNumber || '—'}
        />
        <Column
          header={t('rw_customer')}
          style={{ minWidth: '10rem' }}
          body={(r: IAdminChatSummary) =>
            person(r.customerName, r.customerPhone)
          }
        />
        <Column
          header={t('rw_rider')}
          style={{ minWidth: '10rem' }}
          body={(r: IAdminChatSummary) => person(r.riderName, r.riderPhone)}
        />
        <Column
          header={t('rw_restaurant')}
          style={{ minWidth: '9rem' }}
          body={(r: IAdminChatSummary) => r.restaurantName || '—'}
        />
        <Column
          header={t('rw_messages')}
          style={{ minWidth: '6rem' }}
          body={(r: IAdminChatSummary) => r.messageCount}
        />
        <Column
          header={t('rw_last_message')}
          style={{ minWidth: '14rem' }}
          body={(r: IAdminChatSummary) => (
            <div className="flex flex-col">
              <span className="max-w-xs truncate">
                {r.lastSender ? `${r.lastSender}: ` : ''}
                {r.lastMessage || '—'}
              </span>
              <span className="text-xs text-gray-500">
                {formatDateTime(r.lastMessageAt)}
              </span>
            </div>
          )}
        />
      </DataTable>

      <Dialog
        visible={!!selected}
        onHide={() => setSelected(null)}
        header={
          selected
            ? `${t('rw_order')} ${selected.orderNumber || ''} — ${selected.customerName || ''} / ${selected.riderName || ''}`
            : ''
        }
        style={{ width: '38rem', maxWidth: '95vw' }}
        className="dark:bg-dark-950 dark:text-white"
      >
        {selected && (
          <>
            <p className="mb-2 text-xs text-gray-500">{t('rw_chat_readonly')}</p>
            <ChatConversation orderId={selected.orderId} />
          </>
        )}
      </Dialog>
    </div>
  );
}
