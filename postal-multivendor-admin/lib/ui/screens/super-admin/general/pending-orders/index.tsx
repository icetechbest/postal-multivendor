'use client';

import { gql, useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';

const PENDING_ORDERS = gql`
  query PendingConfirmationOrders($page: Int, $limit: Int, $search: String) {
    pendingConfirmationCount
    pendingConfirmationOrders(page: $page, limit: $limit, search: $search) {
      totalCount
      totalPages
      currentPage
      orders {
        _id
        orderId
        createdAt
        total
        paymentMethod
        instructions
        user {
          name
          phone
        }
        restaurant {
          name
        }
        deliveryAddress {
          deliveryAddress
          details
          location {
            coordinates
          }
        }
        items {
          title
          quantity
        }
      }
    }
  }
`;

const CONFIRM_ORDER = gql`
  mutation AdminConfirmOrder($id: String!, $note: String) {
    adminConfirmOrder(id: $id, note: $note) {
      _id
      orderStatus
    }
  }
`;

const REJECT_ORDER = gql`
  mutation AdminRejectOrder($id: String!, $reason: String!) {
    adminRejectOrder(id: $id, reason: $reason) {
      _id
      orderStatus
    }
  }
`;

export default function PendingOrdersScreen() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const { data, loading, error, refetch } = useQuery(PENDING_ORDERS, {
    variables: { page, limit: 10, search: search.trim() || undefined },
    pollInterval: 15000,
    fetchPolicy: 'network-only',
  });
  const [confirmOrder, { loading: confirming }] = useMutation(CONFIRM_ORDER);
  const [rejectOrder, { loading: rejecting }] = useMutation(REJECT_ORDER);

  const result = data?.pendingConfirmationOrders;
  const busy = confirming || rejecting;

  const run = async (action: () => Promise<unknown>, done: string) => {
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    }
    await refetch();
  };

  const onConfirm = (id: string) => {
    const note = window.prompt('ملاحظة (اختياري)') ?? undefined;
    return run(() => confirmOrder({ variables: { id, note: note || undefined } }), 'تم تأكيد الطلب وإرساله للمطعم');
  };

  const onReject = (id: string) => {
    const reason = window.prompt('سبب الرفض (مطلوب)')?.trim();
    if (!reason) return;
    return run(() => rejectOrder({ variables: { id, reason } }), 'تم رفض الطلب وإشعار العميل');
  };

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          طلبات بانتظار التأكيد ({data?.pendingConfirmationCount ?? 0})
        </h1>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="بحث: رقم الطلب، العميل، الهاتف، العنوان"
          className="border rounded px-3 py-2 w-full sm:w-80 bg-transparent"
        />
      </div>

      {message && <div className="rounded border px-3 py-2 text-sm">{message}</div>}
      {error && <div className="rounded border border-red-500 px-3 py-2 text-sm">{error.message}</div>}
      {loading && !result && <div>...</div>}
      {result && result.orders.length === 0 && <div>لا توجد طلبات بانتظار التأكيد</div>}

      <div className="grid gap-3 md:grid-cols-2">
        {result?.orders.map((order: any) => (
          <div key={order._id} className="border rounded-lg p-4 space-y-2">
            <div className="flex justify-between font-medium">
              <span>#{order.orderId}</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            <div>العميل: {order.user?.name} — {order.user?.phone}</div>
            <div>المطعم: {order.restaurant?.name}</div>
            <div>العنوان: {order.deliveryAddress?.deliveryAddress}{order.deliveryAddress?.details ? ` (${order.deliveryAddress.details})` : ''}</div>
            <div className="text-xs opacity-70" dir="ltr">
              {order.deliveryAddress?.location?.coordinates?.join(', ')}
            </div>
            <div>الأصناف: {order.items?.map((i: any) => `${i.title} ×${i.quantity}`).join('، ')}</div>
            {order.instructions && <div>ملاحظات العميل: {order.instructions}</div>}
            <div>الإجمالي: {order.total} — الدفع: {order.paymentMethod}</div>
            <div className="flex gap-2 pt-2">
              <button disabled={busy} onClick={() => onConfirm(order._id)} className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50">
                تأكيد
              </button>
              <button disabled={busy} onClick={() => onReject(order._id)} className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50">
                رفض
              </button>
            </div>
          </div>
        ))}
      </div>

      {result && result.totalPages > 1 && (
        <div className="flex items-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">السابق</button>
          <span>{result.currentPage} / {result.totalPages}</span>
          <button disabled={page >= result.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">التالي</button>
        </div>
      )}
    </div>
  );
}
