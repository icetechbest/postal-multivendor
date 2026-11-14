import { Types } from 'mongoose';
import { Configuration } from '../models/Configuration';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { WalletTransaction, WalletTxType } from '../models/WalletTransaction';
import { ValidationError } from '../utils/errors';

export const DEFAULT_RIDER_COMMISSION_RATE = 20;
const DONE = ['DELIVERED', 'COMPLETED'];

export const round2 = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

/** Platform commission (percent) charged to riders on every delivered order. Admin-controlled, default 20. */
export const getRiderCommissionRate = async (): Promise<number> => {
  const configuration = await Configuration.findOne({ key: 'default' });
  const value = Number(configuration ? configuration.get('riderCommissionRate') : undefined);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : DEFAULT_RIDER_COMMISSION_RATE;
};

/** What the commission percentage is applied to: the delivery fee (default) or the order subtotal. */
const getCommissionBase = async (): Promise<'deliveryFee' | 'orderAmount'> => {
  const configuration = await Configuration.findOne({ key: 'default' });
  return configuration && configuration.get('riderCommissionBase') === 'orderAmount' ? 'orderAmount' : 'deliveryFee';
};

export interface RiderLimits {
  debtLimit: number;
  cashLimit: number;
}

/** Admin-controlled limits (0 = disabled). A rider at/over a limit cannot take new orders until he settles. */
export const getRiderLimits = async (): Promise<RiderLimits> => {
  const configuration = await Configuration.findOne({ key: 'default' });
  const read = (field: string): number => {
    const value = Number(configuration ? configuration.get(field) : undefined);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  return { debtLimit: read('riderDebtLimit'), cashLimit: read('riderCashLimit') };
};

export const getRiderCommissionBaseSetting = getCommissionBase;

/** Returns why a rider is blocked from taking orders, or undefined when he is free to work. */
export const riderBlockReason = (rider: { commissionDebt?: number; cashInHand?: number }, limits: RiderLimits): string | undefined => {
  if (limits.debtLimit > 0 && (rider.commissionDebt || 0) >= limits.debtLimit) {
    return `Debt limit reached (${round2(rider.commissionDebt || 0)} / ${limits.debtLimit}). Pay the company to receive orders again.`;
  }
  if (limits.cashLimit > 0 && (rider.cashInHand || 0) >= limits.cashLimit) {
    return `Cash limit reached (${round2(rider.cashInHand || 0)} / ${limits.cashLimit}). Hand the cash to the company to receive orders again.`;
  }
  return undefined;
};

/** Throws when the rider may not take (or be given) new orders. */
export const assertRiderCanTakeOrders = async (riderId: unknown, who: 'rider' | 'admin'): Promise<void> => {
  const [rider, limits] = await Promise.all([User.findById(String(riderId)).select('commissionDebt cashInHand name'), getRiderLimits()]);
  const reason = rider ? riderBlockReason(rider as any, limits) : undefined;
  if (reason) throw new ValidationError(who === 'admin' ? `Cannot assign: ${(rider as any)?.name || 'rider'} is blocked. ${reason}` : reason);
};

interface LedgerEntry {
  owner: unknown;
  ownerType: 'RIDER' | 'CUSTOMER';
  type: WalletTxType;
  amount: number;
  direction: 1 | -1;
  balance: 'WALLET' | 'DEBT' | 'CASH';
  walletAfter?: number;
  debtAfter?: number;
  order?: unknown;
  note?: string;
  createdBy?: unknown;
}

export const writeLedger = async (entry: LedgerEntry): Promise<void> => {
  if (!(entry.amount > 0)) return;
  try {
    await WalletTransaction.create({
      ...entry,
      amount: round2(entry.amount),
      owner: new Types.ObjectId(String(entry.owner)),
      order: entry.order ? new Types.ObjectId(String(entry.order)) : undefined,
      createdBy: entry.createdBy ? new Types.ObjectId(String(entry.createdBy)) : undefined,
    });
  } catch (error) {
    // Duplicate (order, owner, type) = already recorded by another code path: that is the idempotency guard.
    if ((error as { code?: number }).code !== 11000) console.warn('Wallet ledger write failed:', error instanceof Error ? error.message : error);
  }
};

/**
 * Called whenever an order becomes DELIVERED/COMPLETED (rider app, admin, vendor).
 * Credits the rider with delivery fee + tip and charges the platform commission as debt.
 * Idempotent (claimed atomically on `riderSettledAt`) and never throws.
 */
export const settleRiderForOrder = async (orderId: unknown): Promise<void> => {
  try {
    const order = await Order.findById(orderId);
    if (!order || !order.rider || order.riderSettledAt || !DONE.includes(order.orderStatus)) return;

    const rate = await getRiderCommissionRate();
    const base = (await getCommissionBase()) === 'orderAmount' ? order.orderAmount || 0 : order.deliveryCharges || 0;
    const earning = round2((order.deliveryCharges || 0) + (order.tipping || 0));
    const commission = round2((base * rate) / 100);

    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, riderSettledAt: null, rider: { $ne: null } },
      { $set: { riderSettledAt: new Date(), riderEarning: earning, riderCommission: commission } },
      { new: true }
    );
    if (!claimed) return; // another request settled it first

    // Cash-on-delivery: the rider is holding the money the customer paid (minus what the wallet covered).
    const cashCollected = order.paymentMethod === 'COD' ? round2(Math.max(0, (order.total || 0) - (order.walletUsed || 0))) : 0;
    const rider = await User.findByIdAndUpdate(
      order.rider,
      { $inc: { currentWalletAmount: earning, totalWalletAmount: earning, commissionDebt: commission, totalCommission: commission, cashInHand: cashCollected } },
      { new: true }
    );
    if (!rider) {
      await Order.updateOne({ _id: order._id }, { $unset: { riderSettledAt: 1, riderEarning: 1, riderCommission: 1 } });
      return;
    }
    await writeLedger({ owner: rider._id, ownerType: 'RIDER', type: 'EARNING', amount: earning, direction: 1, balance: 'WALLET', walletAfter: round2(rider.currentWalletAmount), debtAfter: round2(rider.commissionDebt), order: order._id, note: 'Delivery fee + tip' });
    await writeLedger({ owner: rider._id, ownerType: 'RIDER', type: 'CASH_IN', amount: cashCollected, direction: 1, balance: 'CASH', walletAfter: round2(rider.currentWalletAmount), debtAfter: round2(rider.commissionDebt), order: order._id, note: 'Cash collected from the customer' });
    await writeLedger({ owner: rider._id, ownerType: 'RIDER', type: 'COMMISSION', amount: commission, direction: 1, balance: 'DEBT', walletAfter: round2(rider.currentWalletAmount), debtAfter: round2(rider.commissionDebt), order: order._id, note: `Platform commission ${rate}%` });
  } catch (error) {
    console.warn('Rider wallet settlement failed:', error instanceof Error ? error.message : error);
  }
};

export interface RiderWalletView {
  riderId: string;
  name?: string;
  username?: string;
  phone?: string;
  available?: boolean;
  isActive?: boolean;
  zone?: string;
  vehicleType?: string;
  commissionRate: number;
  currentBalance: number;
  totalEarnings: number;
  withdrawn: number;
  debt: number;
  cashInHand: number;
  debtLimit: number;
  cashLimit: number;
  blocked: boolean;
  blockedReason?: string;
  totalCommission: number;
  totalPaid: number;
  netBalance: number;
  deliveredOrders: number;
  totalCashCollected: number;
  lastDeliveryAt?: Date;
}

/** Builds the wallet summary for a set of rider documents with a single aggregate over their orders. */
export const buildRiderWallets = async (riders: any[]): Promise<RiderWalletView[]> => {
  if (!riders.length) return [];
  const rate = await getRiderCommissionRate();
  const limits = await getRiderLimits();
  const stats = await Order.aggregate([
    { $match: { rider: { $in: riders.map((rider) => rider._id) }, orderStatus: { $in: DONE } } },
    {
      $group: {
        _id: '$rider',
        delivered: { $sum: 1 },
        cash: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'COD'] }, { $max: [0, { $subtract: ['$total', { $ifNull: ['$walletUsed', 0] }] }] }, 0] } },
        last: { $max: { $ifNull: ['$deliveredAt', '$updatedAt'] } },
      },
    },
  ]);
  const byRider = new Map<string, { delivered: number; cash: number; last?: Date }>(stats.map((row: any) => [String(row._id), row]));
  return riders.map((rider) => {
    const stat = byRider.get(String(rider._id));
    const debt = round2(rider.commissionDebt || 0);
    const balance = round2(rider.currentWalletAmount || 0);
    return {
      riderId: String(rider._id),
      name: rider.name,
      username: rider.username,
      phone: rider.phone,
      available: rider.available,
      isActive: rider.isActive,
      zone: rider.zone && typeof rider.zone === 'object' ? (rider.zone as any).title : undefined,
      vehicleType: rider.vehicleType,
      commissionRate: rate,
      currentBalance: balance,
      totalEarnings: round2(rider.totalWalletAmount || 0),
      withdrawn: round2(rider.withdrawnWalletAmount || 0),
      debt,
      cashInHand: round2(rider.cashInHand || 0),
      debtLimit: limits.debtLimit,
      cashLimit: limits.cashLimit,
      blocked: !!riderBlockReason(rider, limits),
      blockedReason: riderBlockReason(rider, limits),
      totalCommission: round2(rider.totalCommission || 0),
      totalPaid: round2(rider.totalDebtPaid || 0),
      netBalance: round2(balance - debt),
      deliveredOrders: stat?.delivered || 0,
      totalCashCollected: round2(stat?.cash || 0),
      lastDeliveryAt: stat?.last,
    };
  });
};
