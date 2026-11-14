'use client';

// Core
import { useContext, useMemo, useState } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { useTranslations } from 'next-intl';

// PrimeReact
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';

// Context
import { ToastContext } from '@/lib/context/global/toast.context';

/** Lowest delivery price the admin may set (the backend enforces the same rule). */
const MIN_DELIVERY_PRICE = Number(process.env.NEXT_PUBLIC_MIN_DELIVERY_PRICE) > 0 ? Number(process.env.NEXT_PUBLIC_MIN_DELIVERY_PRICE) : 15;

const PENDING_ORDERS = gql`
  query PendingConfirmationOrders($page: Int, $limit: Int) {
    pendingConfirmationOrders(page: $page, limit: $limit) {
      totalCount
      orders {
        _id
        orderId
        createdAt
        total
        deliveryCharges
        paymentMethod
        isPickedUp
        user {
          _id
          name
          phone
        }
        restaurant {
          _id
          name
        }
        deliveryAddress {
          deliveryAddress
        }
      }
    }
  }
`;

const PENDING_ORDERS_SUBSCRIPTION = gql`
  subscription PendingOrderCreated {
    subscriptionPendingOrders {
      _id
    }
  }
`;

const RIDERS = gql`
  query PendingOrdersRiders {
    riders {
      _id
      name
      phone
      available
    }
  }
`;

const CONFIRM_ORDER = gql`
  mutation AdminConfirmOrder($id: String!, $note: String, $riderId: String, $deliveryCharges: Float) {
    adminConfirmOrder(id: $id, note: $note, riderId: $riderId, deliveryCharges: $deliveryCharges) {
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

interface IPendingOrder {
  _id: string;
  orderId?: string;
  createdAt?: string;
  total?: number;
  deliveryCharges?: number;
  paymentMethod?: string;
  isPickedUp?: boolean;
  user?: { name?: string; phone?: string };
  restaurant?: { name?: string };
  deliveryAddress?: { deliveryAddress?: string };
}

interface IRiderOption {
  _id: string;
  name?: string;
  phone?: string;
  available?: boolean;
}

export default function PendingOrdersScreen() {
  const t = useTranslations();
  const { showToast } = useContext(ToastContext);

  const [confirmTarget, setConfirmTarget] = useState<IPendingOrder | null>(null);
  const [rejectTarget, setRejectTarget] = useState<IPendingOrder | null>(null);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, refetch } = useQuery<{
    pendingConfirmationOrders: { totalCount: number; orders: IPendingOrder[] };
  }>(PENDING_ORDERS, {
    variables: { page: 1, limit: 100 },
    fetchPolicy: 'network-only',
    pollInterval: 10000,
  });
  const { data: ridersData } = useQuery<{ riders: IRiderOption[] }>(RIDERS, { fetchPolicy: 'cache-and-network' });

  // A new order arrived: reload the list right away.
  useSubscription(PENDING_ORDERS_SUBSCRIPTION, { onData: () => void refetch() });

  const [confirmOrder] = useMutation(CONFIRM_ORDER);
  const [rejectOrder] = useMutation(REJECT_ORDER);

  const riderOptions = useMemo(
    () =>
      (ridersData?.riders ?? []).map((rider) => ({
        value: rider._id,
        label: `${rider.name ?? rider._id}${rider.phone ? ` · ${rider.phone}` : ''}${rider.available === false ? ` (${t('Unavailable')})` : ''}`,
      })),
    [ridersData, t]
  );

  const needsDispatch = !!confirmTarget && !confirmTarget.isPickedUp;
  const priceInvalid = needsDispatch && (price === null || price < MIN_DELIVERY_PRICE);
  const canConfirm = !busy && (!needsDispatch || (!!riderId && !priceInvalid));

  const openConfirm = (order: IPendingOrder) => {
    setConfirmTarget(order);
    setRiderId(null);
    setNote('');
    setPrice(Math.max(MIN_DELIVERY_PRICE, Math.round(order.deliveryCharges ?? 0)));
  };

  const errorMessage = (error: unknown) => (error instanceof Error ? error.message : t('Something went wrong'));

  const handleConfirm = async () => {
    if (!confirmTarget || !canConfirm) return;
    setBusy(true);
    try {
      await confirmOrder({
        variables: {
          id: confirmTarget._id,
          note: note.trim() || undefined,
          ...(needsDispatch ? { riderId, deliveryCharges: price } : {}),
        },
      });
      showToast({ type: 'success', title: t('Confirm Order'), message: t('Order confirmed, rider assigned and store notified') });
      setConfirmTarget(null);
    } catch (error) {
      showToast({ type: 'error', title: t('Confirm Order'), message: errorMessage(error) });
    } finally {
      setBusy(false);
      void refetch();
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !reason.trim()) return;
    setBusy(true);
    try {
      await rejectOrder({ variables: { id: rejectTarget._id, reason: reason.trim() } });
      showToast({ type: 'success', title: t('Reject Order'), message: t('Order rejected and the customer notified') });
      setRejectTarget(null);
      setReason('');
    } catch (error) {
      showToast({ type: 'error', title: t('Reject Order'), message: errorMessage(error) });
    } finally {
      setBusy(false);
      void refetch();
    }
  };

  const orders = data?.pendingConfirmationOrders.orders ?? [];

  return (
    <div className="screen-container">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold dark:text-white">{t('Pending Orders')}</h1>
        <Button label={t('Refresh')} icon="pi pi-refresh" outlined loading={loading} onClick={() => void refetch()} />
      </div>

      <DataTable value={orders} loading={loading && orders.length === 0} emptyMessage={t('No orders awaiting confirmation')} dataKey="_id" stripedRows>
        <Column field="orderId" header={t('Order Id')} />
        <Column header={t('Store')} body={(row: IPendingOrder) => row.restaurant?.name ?? '—'} />
        <Column header={t('Customer')} body={(row: IPendingOrder) => `${row.user?.name ?? '—'}${row.user?.phone ? ` · ${row.user.phone}` : ''}`} />
        <Column header={t('Address')} body={(row: IPendingOrder) => row.deliveryAddress?.deliveryAddress ?? '—'} />
        <Column header={t('Delivery Price')} body={(row: IPendingOrder) => (row.isPickedUp ? t('Pick Up') : (row.deliveryCharges ?? 0))} />
        <Column field="total" header={t('Total')} />
        <Column field="paymentMethod" header={t('Payment')} />
        <Column
          header={t('Actions')}
          body={(row: IPendingOrder) => (
            <div className="flex gap-2">
              <Button size="small" label={t('Confirm')} onClick={() => openConfirm(row)} />
              <Button size="small" severity="danger" outlined label={t('Reject')} onClick={() => { setRejectTarget(row); setReason(''); }} />
            </div>
          )}
        />
      </DataTable>

      <Dialog
        visible={!!confirmTarget}
        onHide={() => !busy && setConfirmTarget(null)}
        header={`${t('Confirm Order')} #${confirmTarget?.orderId ?? ''}`}
        style={{ width: '28rem', maxWidth: '95vw' }}
        modal
      >
        <div className="flex flex-col gap-4">
          {needsDispatch ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('Rider')} *</span>
                <Dropdown value={riderId} options={riderOptions} onChange={(e) => setRiderId(e.value)} placeholder={t('Select Rider')} filter disabled={busy} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('Delivery Price')} *</span>
                <InputNumber value={price} onValueChange={(e) => setPrice(e.value ?? null)} min={0} mode="decimal" minFractionDigits={0} maxFractionDigits={2} invalid={priceInvalid} disabled={busy} />
                <small className={priceInvalid ? 'text-red-600' : ''}>{t('Minimum delivery price')}: {MIN_DELIVERY_PRICE}</small>
              </label>
            </>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('Note (optional)')}</span>
            <InputTextarea rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          </label>
          <div className="flex justify-end gap-2">
            <Button label={t('Cancel')} outlined onClick={() => setConfirmTarget(null)} disabled={busy} />
            <Button label={t('Confirm Order')} onClick={() => void handleConfirm()} disabled={!canConfirm} loading={busy} />
          </div>
        </div>
      </Dialog>

      <Dialog visible={!!rejectTarget} onHide={() => !busy && setRejectTarget(null)} header={`${t('Reject Order')} #${rejectTarget?.orderId ?? ''}`} style={{ width: '28rem', maxWidth: '95vw' }} modal>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('Reason (required)')}</span>
            <InputTextarea rows={3} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} disabled={busy} />
          </label>
          <div className="flex justify-end gap-2">
            <Button label={t('Cancel')} outlined onClick={() => setRejectTarget(null)} disabled={busy} />
            <Button label={t('Reject Order')} severity="danger" onClick={() => void handleReject()} disabled={busy || !reason.trim()} loading={busy} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
