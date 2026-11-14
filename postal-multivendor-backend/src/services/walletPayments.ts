import { Types } from 'mongoose';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { round2, writeLedger } from './riderWallet';

/**
 * Customer wallet payments (money wallet, see addChangeToCustomerWallet).
 *
 * takeWalletForOrder: atomically removes min(balance, total) from the wallet. Returns the amount taken (0 = nothing).
 * returnWallet: puts it back (used when creating the order fails or the order is cancelled).
 */
export const takeWalletForOrder = async (userId: unknown, total: number): Promise<number> => {
  const user = await User.findById(String(userId)).select('walletBalance');
  const balance = round2(user?.walletBalance || 0);
  const amount = round2(Math.min(balance, total));
  if (!(amount > 0)) return 0;
  const updated = await User.findOneAndUpdate({ _id: new Types.ObjectId(String(userId)), walletBalance: { $gte: amount } }, { $inc: { walletBalance: -amount } }, { new: true });
  return updated ? amount : -1; // -1: balance changed under us
};

export const returnWallet = async (userId: unknown, amount: number): Promise<void> => {
  if (!(amount > 0)) return;
  await User.updateOne({ _id: new Types.ObjectId(String(userId)) }, { $inc: { walletBalance: round2(amount) } });
};

export const recordWalletDebit = async (order: { _id: unknown; user: unknown; orderId?: string }, amount: number): Promise<void> => {
  const user = await User.findById(String(order.user)).select('walletBalance');
  await writeLedger({ owner: order.user, ownerType: 'CUSTOMER', type: 'WALLET_DEBIT', amount, direction: -1, balance: 'WALLET', walletAfter: round2(user?.walletBalance || 0), order: order._id, note: `Paid order ${order.orderId || ''} from wallet` });
};

/** Gives the wallet part of a cancelled order back to the customer, once. Never throws. */
export const refundWalletForOrder = async (orderId: unknown): Promise<void> => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: new Types.ObjectId(String(orderId)), orderStatus: 'CANCELLED', walletUsed: { $gt: 0 }, walletRefunded: { $ne: true } },
      { $set: { walletRefunded: true } },
      { new: true }
    );
    if (!order) return;
    const customer = await User.findByIdAndUpdate(order.user, { $inc: { walletBalance: order.walletUsed } }, { new: true });
    await writeLedger({ owner: order.user, ownerType: 'CUSTOMER', type: 'WALLET_REFUND', amount: order.walletUsed || 0, direction: 1, balance: 'WALLET', walletAfter: round2(customer?.walletBalance || 0), order: order._id, note: `Refund for cancelled order ${order.orderId}` });
  } catch (error) {
    console.warn('Wallet refund failed:', error instanceof Error ? error.message : error);
  }
};
