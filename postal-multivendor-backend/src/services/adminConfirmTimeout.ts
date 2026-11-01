import config from '../config';
import { Order } from '../models/Order';
import { AWAITING_ADMIN, notifyCustomerCancelled } from '../graphql/resolvers/appHelpers';

export const ADMIN_CONFIRM_TIMEOUT_REASON = 'انتهت مهلة التأكيد';
const SWEEP_INTERVAL_MS = 30_000;
const MAX_PER_SWEEP = 200;

/** Cancels orders that stayed in AWAITING_ADMIN longer than ADMIN_CONFIRM_TIMEOUT_MINUTES. Returns how many were cancelled. */
export const cancelExpiredAwaitingOrders = async (timeoutMinutes = config.orders.adminConfirmTimeoutMinutes): Promise<number> => {
  if (timeoutMinutes <= 0) return 0;
  const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);
  let cancelled = 0;
  while (cancelled < MAX_PER_SWEEP) {
    const now = new Date();
    // Atomic per order: an admin confirming at the same moment wins, and the order is no longer matched here.
    const expired = await Order.findOneAndUpdate(
      { orderStatus: AWAITING_ADMIN, createdAt: { $lte: cutoff } },
      { $set: { orderStatus: 'CANCELLED', reason: ADMIN_CONFIRM_TIMEOUT_REASON, cancelledAt: now, adminRejectedAt: now } },
      { new: true, sort: { createdAt: 1 } }
    );
    if (!expired) break;
    cancelled += 1;
    try {
      await notifyCustomerCancelled(expired._id, ADMIN_CONFIRM_TIMEOUT_REASON, 'adminConfirmTimeout');
    } catch (error) {
      console.warn(`Could not notify the customer about order ${expired.orderId}:`, error instanceof Error ? error.message : error);
    }
  }
  return cancelled;
};

/** Starts the periodic sweep; returns undefined when the feature is disabled (timeout = 0). */
export const startAdminConfirmTimeout = (): NodeJS.Timeout | undefined => {
  const minutes = config.orders.adminConfirmTimeoutMinutes;
  if (minutes <= 0) return undefined;
  console.log(`Admin confirmation timeout enabled: ${minutes} minute(s)`);
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    cancelExpiredAwaitingOrders(minutes)
      .catch((error) => console.warn('Admin confirmation timeout sweep failed:', error instanceof Error ? error.message : error))
      .finally(() => { running = false; });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
};
