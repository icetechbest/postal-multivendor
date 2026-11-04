import { Types } from 'mongoose';
import { Configuration } from '../models/Configuration';
import { CoinTransaction } from '../models/CoinTransaction';
import { Order } from '../models/Order';
import { User } from '../models/User';

export interface CoinSettings {
  enabled: boolean;
  /** Coins earned for every 1 unit of currency spent on the order subtotal. */
  perCurrencyUnit: number;
  /** Currency value of a single coin. */
  coinValue: number;
}

export const DEFAULT_COIN_SETTINGS: CoinSettings = {
  enabled: true,
  perCurrencyUnit: 0.1,
  coinValue: 0.5,
};

/** Normalises an id (ObjectId | string | unknown) into a typed ObjectId for Mongoose filters. */
const toObjectId = (value: unknown): Types.ObjectId => new Types.ObjectId(String(value));

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/** Reads the admin-controlled coin settings, falling back to safe defaults. */
export const getCoinSettings = async (): Promise<CoinSettings> => {
  const configuration = await Configuration.findOne({ key: 'default' });
  const get = (field: string): unknown => (configuration ? configuration.get(field) : undefined);
  const enabled = get('coinsEnabled');
  return {
    enabled: typeof enabled === 'boolean' ? enabled : DEFAULT_COIN_SETTINGS.enabled,
    perCurrencyUnit: toNumber(get('coinsPerCurrencyUnit'), DEFAULT_COIN_SETTINGS.perCurrencyUnit),
    coinValue: toNumber(get('coinValue'), DEFAULT_COIN_SETTINGS.coinValue),
  };
};

/** Whole coins earned for an order subtotal. */
export const calculateCoins = (orderAmount: number, settings: CoinSettings): number => {
  if (!settings.enabled) return 0;
  const amount = Number(orderAmount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  // Tiny epsilon so binary float error (e.g. 0.1 * 30 = 2.9999999999999996) never costs the customer a coin.
  return Math.floor(amount * settings.perCurrencyUnit + 1e-9);
};

/**
 * Credits the customer with coins for a delivered order.
 *
 * Safe to call from every place that can mark an order DELIVERED/COMPLETED:
 * the ledger's unique (order, EARN) index guarantees the coins are granted once.
 * Never throws — coin problems must not break the delivery flow.
 */
export const awardCoinsForOrder = async (orderId: unknown): Promise<number> => {
  try {
    const order = await Order.findById(toObjectId(orderId));
    if (!order || !['DELIVERED', 'COMPLETED'].includes(order.orderStatus)) return 0;
    if (order.coinsEarned > 0) return 0;

    const settings = await getCoinSettings();
    const coins = calculateCoins(order.orderAmount, settings);
    if (coins <= 0) return 0;

    try {
      await CoinTransaction.create({
        user: order.user,
        order: order._id,
        type: 'EARN',
        coins,
        orderAmount: order.orderAmount,
        rate: settings.perCurrencyUnit,
        coinValue: settings.coinValue,
        note: `Order ${order.orderId}`,
      });
    } catch (error: any) {
      // Duplicate key: another code path already granted the coins for this order.
      if (error?.code === 11000) return 0;
      throw error;
    }

    await User.updateOne({ _id: order.user }, { $inc: { coins } });
    await Order.updateOne({ _id: order._id }, { $set: { coinsEarned: coins } });
    return coins;
  } catch (error) {
    console.error('Awarding coins failed:', error instanceof Error ? error.message : error);
    return 0;
  }
};

/**
 * Atomically takes `coins` from the customer's balance. Returns false when the
 * balance is too low (nothing is deducted in that case).
 */
export const deductCoins = async (userId: unknown, coins: number): Promise<boolean> => {
  const updated = await User.findOneAndUpdate({ _id: toObjectId(userId), coins: { $gte: coins } }, { $inc: { coins: -coins } }, { new: true });
  return Boolean(updated);
};

/** Puts coins back (used when placing the order fails after they were deducted). */
export const returnCoins = async (userId: unknown, coins: number): Promise<void> => {
  await User.updateOne({ _id: toObjectId(userId) }, { $inc: { coins } });
};

/**
 * Gives the customer back the coins they paid with when an order is cancelled/rejected.
 * Idempotent (guarded by the order's coinsRefunded flag) and never throws.
 */
export const refundCoinsForOrder = async (orderId: unknown): Promise<number> => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: toObjectId(orderId), orderStatus: 'CANCELLED', coinsUsed: { $gt: 0 }, coinsRefunded: { $ne: true } },
      { $set: { coinsRefunded: true } },
      { new: true }
    );
    if (!order) return 0;
    await returnCoins(order.user, order.coinsUsed);
    await CoinTransaction.create({ user: order.user, order: order._id, type: 'REFUND', coins: order.coinsUsed, note: `Refund ${order.orderId}` });
    return order.coinsUsed;
  } catch (error) {
    console.error('Refunding coins failed:', error instanceof Error ? error.message : error);
    return 0;
  }
};
