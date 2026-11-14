import { Types } from 'mongoose';
import { ChatMessage } from '../../models/ChatMessage';
import { Order } from '../../models/Order';
import { User } from '../../models/User';
import { WalletTransaction } from '../../models/WalletTransaction';
import { AuthContext, requireAuth, requireRole } from '../../middleware/auth';
import { Configuration } from '../../models/Configuration';
import { AuthorizationError, NotFoundError, ValidationError } from '../../utils/errors';
import { buildRiderWallets, getRiderCommissionBaseSetting, getRiderCommissionRate, getRiderLimits, round2, settleRiderForOrder, writeLedger } from '../../services/riderWallet';
import { assertObjectId, audit, dateRange, escapeRegex, pageParams, requirePlatformReader, requireSuperAdmin } from './adminHelpers';

const DONE = ['DELIVERED', 'COMPLETED'];

const loadRider = async (riderId: string) => {
  const rider = await User.findOne({ _id: assertObjectId(riderId, 'rider'), role: 'RIDER' }).populate('zone');
  if (!rider) throw new NotFoundError('Rider');
  return rider;
};

/** A rider always sees only their own wallet; admin/staff must name the rider. */
const resolveRiderId = (context: AuthContext, requested?: string | null): string => {
  requireRole(context, ['RIDER', 'ADMIN', 'STAFF']);
  if (context.user!.role === 'RIDER') return context.user!.userId;
  return assertObjectId(requested, 'rider');
};

const transactionsPage = async (filter: Record<string, any>, page?: number | null, limit?: number | null) => {
  const p = pageParams(page, limit, 20);
  const [rows, total] = await Promise.all([
    WalletTransaction.find(filter).populate('order', 'orderId').populate('createdBy', 'name').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    WalletTransaction.countDocuments(filter),
  ]);
  return {
    transactions: rows.map((row: any) => ({
      _id: row._id,
      type: row.type,
      amount: row.amount,
      direction: row.direction,
      balance: row.balance,
      walletAfter: row.walletAfter,
      debtAfter: row.debtAfter,
      note: row.note,
      order: row.order?._id,
      orderId: row.order?.orderId,
      createdAt: row.createdAt,
      createdBy: row.createdBy?.name,
    })),
    total,
    page: p.page,
    totalPages: Math.max(1, Math.ceil(total / p.limit)),
  };
};

const walletOf = async (riderId: string) => {
  const rider = await loadRider(riderId);
  const [wallet] = await buildRiderWallets([rider]);
  return wallet;
};

const settingsView = async () => ({
  commissionRate: await getRiderCommissionRate(),
  commissionBase: await getRiderCommissionBaseSetting(),
  ...(await getRiderLimits()),
});

export const walletResolvers = {
  Query: {
    riderWalletSettings: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requirePlatformReader(context);
      return settingsView();
    },

    riderWallet: async (_parent: unknown, args: { riderId?: string; page?: number; limit?: number; type?: string }, context: AuthContext) => {
      const riderId = resolveRiderId(context, args.riderId);
      const filter: Record<string, any> = { owner: new Types.ObjectId(riderId), ownerType: 'RIDER' };
      if (args.type && args.type !== 'ALL') filter.type = args.type;
      const [wallet, transactions] = await Promise.all([walletOf(riderId), transactionsPage(filter, args.page, args.limit)]);
      return { wallet, transactions };
    },

    riderWallets: async (_parent: unknown, args: { search?: string; onlyDebt?: boolean; page?: number; limit?: number }, context: AuthContext) => {
      requirePlatformReader(context);
      const filter: Record<string, any> = { role: 'RIDER' };
      if (args.onlyDebt) filter.commissionDebt = { $gt: 0 };
      if (args.search?.trim()) {
        const regex = { $regex: escapeRegex(args.search.trim()), $options: 'i' };
        filter.$or = [{ name: regex }, { username: regex }, { phone: regex }];
      }
      const p = pageParams(args.page, args.limit, 20);
      const [riders, total, totals] = await Promise.all([
        User.find(filter).populate('zone').sort({ commissionDebt: -1, name: 1 }).skip(p.skip).limit(p.limit),
        User.countDocuments(filter),
        User.aggregate([{ $match: filter }, { $group: { _id: null, debt: { $sum: '$commissionDebt' }, balance: { $sum: '$currentWalletAmount' } } }]),
      ]);
      return {
        riders: await buildRiderWallets(riders),
        total,
        page: p.page,
        totalPages: Math.max(1, Math.ceil(total / p.limit)),
        totalDebt: round2(totals[0]?.debt || 0),
        totalBalance: round2(totals[0]?.balance || 0),
      };
    },

    riderOrderHistory: async (_parent: unknown, args: { riderId?: string; page?: number; limit?: number; startDate?: string; endDate?: string }, context: AuthContext) => {
      const riderId = resolveRiderId(context, args.riderId);
      const match: Record<string, any> = { rider: new Types.ObjectId(riderId), orderStatus: { $in: DONE } };
      const range = dateRange(null, args.startDate, args.endDate);
      if (range) match.createdAt = range;
      const p = pageParams(args.page, args.limit, 20);
      const rate = await getRiderCommissionRate();
      const [orders, total, sums] = await Promise.all([
        Order.find(match).populate('restaurant', 'name').populate('user', 'name').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
        Order.countDocuments(match),
        Order.aggregate([{ $match: match }, { $group: { _id: null, earning: { $sum: { $ifNull: ['$riderEarning', { $add: ['$deliveryCharges', '$tipping'] }] } }, commission: { $sum: { $ifNull: ['$riderCommission', 0] } } } }]),
      ]);
      return {
        orders: orders.map((order: any) => {
          const earning = round2(order.riderEarning ?? (order.deliveryCharges || 0) + (order.tipping || 0));
          // Orders delivered before wallets existed have no stored commission: show what it would be.
          const commission = round2(order.riderCommission ?? ((order.deliveryCharges || 0) * rate) / 100);
          return {
            _id: order._id,
            orderId: order.orderId,
            orderStatus: order.orderStatus,
            paymentMethod: order.paymentMethod,
            restaurantName: order.restaurant?.name,
            customerName: order.user?.name,
            orderAmount: order.orderAmount || 0,
            total: order.total || 0,
            deliveryCharges: order.deliveryCharges || 0,
            tipping: order.tipping || 0,
            earning,
            commission,
            net: round2(earning - commission),
            changeAmount: order.changeAmount,
            deliveredAt: order.deliveredAt || order.updatedAt,
            createdAt: order.createdAt,
          };
        }),
        total,
        page: p.page,
        totalPages: Math.max(1, Math.ceil(total / p.limit)),
        totalEarnings: round2(sums[0]?.earning || 0),
        totalCommission: round2(sums[0]?.commission || 0),
      };
    },

    myWallet: async (_parent: unknown, args: { page?: number; limit?: number }, context: AuthContext) => {
      requireAuth(context);
      const user = await User.findById(context.user!.userId).select('walletBalance');
      if (!user) throw new NotFoundError('User');
      return {
        balance: round2(user.walletBalance || 0),
        transactions: await transactionsPage({ owner: user._id, ownerType: 'CUSTOMER' }, args.page, args.limit),
      };
    },

    adminChats: async (_parent: unknown, args: { search?: string; page?: number; limit?: number }, context: AuthContext) => {
      requirePlatformReader(context);
      const p = pageParams(args.page, args.limit, 20);
      const match: Record<string, any> = {};
      if (args.search?.trim()) {
        const regex = { $regex: escapeRegex(args.search.trim()), $options: 'i' };
        const people = await User.find({ $or: [{ name: regex }, { phone: regex }] }).select('_id').limit(200);
        const ids = people.map((person) => person._id);
        const orders = await Order.find({ $or: [{ orderId: regex }, { user: { $in: ids } }, { rider: { $in: ids } }] }).select('_id').limit(500);
        match.order = { $in: orders.map((order) => order._id) };
      }
      const grouped = await ChatMessage.aggregate([
        { $match: match },
        { $sort: { createdAt: 1 } },
        { $group: { _id: '$order', count: { $sum: 1 }, lastMessage: { $last: '$message' }, lastSender: { $last: '$user.name' }, lastAt: { $last: '$createdAt' } } },
        { $sort: { lastAt: -1 } },
        { $facet: { rows: [{ $skip: p.skip }, { $limit: p.limit }], total: [{ $count: 'n' }] } },
      ]);
      const rows: any[] = grouped[0]?.rows || [];
      const total: number = grouped[0]?.total?.[0]?.n || 0;
      const orders = await Order.find({ _id: { $in: rows.map((row) => row._id) } })
        .populate('user', 'name phone')
        .populate('rider', 'name phone')
        .populate('restaurant', 'name');
      const byId = new Map<string, any>(orders.map((order) => [String(order._id), order]));
      return {
        chats: rows.map((row) => {
          const order = byId.get(String(row._id));
          return {
            orderId: row._id,
            orderNumber: order?.orderId,
            orderStatus: order?.orderStatus,
            restaurantName: order?.restaurant?.name,
            customerName: order?.user?.name,
            customerPhone: order?.user?.phone,
            riderName: order?.rider?.name,
            riderPhone: order?.rider?.phone,
            messageCount: row.count,
            lastMessage: row.lastMessage,
            lastSender: row.lastSender,
            lastMessageAt: row.lastAt,
          };
        }),
        total,
        page: p.page,
        totalPages: Math.max(1, Math.ceil(total / p.limit)),
      };
    },
  },

  Mutation: {
    settleRiderDebt: async (_parent: unknown, args: { riderId: string; amount: number; method: string; note?: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const amount = round2(args.amount);
      if (!(amount > 0)) throw new ValidationError('Amount must be greater than zero');
      const method = String(args.method || '').toUpperCase();
      if (!['CASH', 'WALLET'].includes(method)) throw new ValidationError('Method must be CASH or WALLET');
      const rider = await loadRider(args.riderId);

      const filter: Record<string, any> = { _id: rider._id, commissionDebt: { $gte: amount } };
      const inc: Record<string, number> = { commissionDebt: -amount, totalDebtPaid: amount };
      if (method === 'WALLET') {
        filter.currentWalletAmount = { $gte: amount };
        inc.currentWalletAmount = -amount;
      }
      const updated = await User.findOneAndUpdate(filter, { $inc: inc }, { new: true });
      if (!updated) {
        throw new ValidationError(method === 'WALLET' ? 'Amount exceeds the rider debt or the rider wallet balance' : 'Amount exceeds the rider debt');
      }
      await writeLedger({
        owner: updated._id,
        ownerType: 'RIDER',
        type: method === 'WALLET' ? 'DEBT_OFFSET' : 'DEBT_PAYMENT',
        amount,
        direction: -1,
        balance: 'DEBT',
        walletAfter: round2(updated.currentWalletAmount),
        debtAfter: round2(updated.commissionDebt),
        note: args.note || (method === 'WALLET' ? 'Debt deducted from wallet earnings' : 'Debt paid in cash'),
        createdBy: context.user!.userId,
      });
      await audit(context, 'settleRiderDebt', 'User', rider._id, { amount, method });
      return walletOf(args.riderId);
    },

    adjustRiderWallet: async (_parent: unknown, args: { riderId: string; amount: number; target: string; note: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const amount = round2(args.amount);
      if (!amount) throw new ValidationError('Amount must not be zero');
      if (!args.note?.trim()) throw new ValidationError('A note is required for manual adjustments');
      const target = String(args.target || '').toUpperCase();
      if (!['DEBT', 'WALLET'].includes(target)) throw new ValidationError('Target must be DEBT or WALLET');
      const rider = await loadRider(args.riderId);

      const field = target === 'DEBT' ? 'commissionDebt' : 'currentWalletAmount';
      const filter: Record<string, any> = { _id: rider._id };
      if (amount < 0) filter[field] = { $gte: Math.abs(amount) };
      const inc: Record<string, number> = { [field]: amount };
      if (target === 'WALLET' && amount > 0) inc.totalWalletAmount = amount;
      const updated = await User.findOneAndUpdate(filter, { $inc: inc }, { new: true });
      if (!updated) throw new ValidationError(`Cannot subtract more than the current ${target === 'DEBT' ? 'debt' : 'wallet balance'}`);
      await writeLedger({
        owner: updated._id,
        ownerType: 'RIDER',
        type: target === 'DEBT' ? 'DEBT_ADJUST' : 'WALLET_ADJUST',
        amount: Math.abs(amount),
        direction: amount > 0 ? 1 : -1,
        balance: target as 'DEBT' | 'WALLET',
        walletAfter: round2(updated.currentWalletAmount),
        debtAfter: round2(updated.commissionDebt),
        note: args.note.trim(),
        createdBy: context.user!.userId,
      });
      await audit(context, 'adjustRiderWallet', 'User', rider._id, { amount, target });
      return walletOf(args.riderId);
    },

    setRiderCommissionRate: async (_parent: unknown, { rate }: { rate: number }, context: AuthContext) => {
      requireSuperAdmin(context);
      if (!(rate >= 0 && rate <= 100)) throw new ValidationError('Commission rate must be between 0 and 100');
      await Configuration.findOneAndUpdate({ key: 'default' }, { $set: { riderCommissionRate: rate } }, { upsert: true, new: true, setDefaultsOnInsert: true });
      await audit(context, 'setRiderCommissionRate', 'Configuration', 'default', { rate });
      return rate;
    },

    setRiderLimits: async (_parent: unknown, args: { debtLimit: number; cashLimit: number }, context: AuthContext) => {
      requireSuperAdmin(context);
      if (!(args.debtLimit >= 0) || !(args.cashLimit >= 0)) throw new ValidationError('Limits cannot be negative (0 turns a limit off)');
      await Configuration.findOneAndUpdate({ key: 'default' }, { $set: { riderDebtLimit: round2(args.debtLimit), riderCashLimit: round2(args.cashLimit) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
      await audit(context, 'setRiderLimits', 'Configuration', 'default', args);
      return settingsView();
    },

    collectRiderCash: async (_parent: unknown, args: { riderId: string; amount: number; note?: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const amount = round2(args.amount);
      if (!(amount > 0)) throw new ValidationError('Amount must be greater than zero');
      const rider = await loadRider(args.riderId);
      const updated = await User.findOneAndUpdate({ _id: rider._id, cashInHand: { $gte: amount } }, { $inc: { cashInHand: -amount } }, { new: true });
      if (!updated) throw new ValidationError('Amount exceeds the cash the rider is holding');
      await writeLedger({ owner: updated._id, ownerType: 'RIDER', type: 'CASH_HANDOVER', amount, direction: -1, balance: 'CASH', walletAfter: round2(updated.currentWalletAmount), debtAfter: round2(updated.commissionDebt), note: args.note || 'Cash handed to the company', createdBy: context.user!.userId });
      await audit(context, 'collectRiderCash', 'User', rider._id, { amount });
      return walletOf(args.riderId);
    },

    /** Rider: the customer paid cash and the rider has no change. The change goes to the customer's wallet. */
    addChangeToCustomerWallet: async (_parent: unknown, args: { orderId: string; receivedAmount: number }, context: AuthContext) => {
      requireRole(context, ['RIDER']);
      const received = round2(args.receivedAmount);
      const order = await Order.findById(assertObjectId(args.orderId, 'order'));
      if (!order) throw new NotFoundError('Order');
      if (!order.rider || String(order.rider) !== context.user!.userId) throw new AuthorizationError();
      if (order.paymentMethod !== 'COD') throw new ValidationError('Only cash-on-delivery orders can have change');
      if (!['PICKED', ...DONE].includes(order.orderStatus)) throw new ValidationError('The order must be picked up first');
      if (order.changeAddedAt) throw new ValidationError('Change was already added for this order');
      const amountDue = round2(Math.max(0, (order.total || 0) - (order.walletUsed || 0)));
      if (!(amountDue > 0)) throw new ValidationError('Nothing to collect on this order: it was paid from the wallet');
      const change = round2(received - amountDue);
      if (!(change > 0)) throw new ValidationError('The received amount must be greater than the amount due');

      const claimed = await Order.findOneAndUpdate({ _id: order._id, rider: order.rider, changeAddedAt: null }, { $set: { changeAmount: change, changeAddedAt: new Date() } }, { new: true });
      if (!claimed) throw new ValidationError('Change was already added for this order');

      const customer = await User.findByIdAndUpdate(order.user, { $inc: { walletBalance: change } }, { new: true });
      if (!customer) {
        await Order.updateOne({ _id: order._id }, { $unset: { changeAmount: 1, changeAddedAt: 1 } });
        throw new NotFoundError('Customer');
      }
      // The rider keeps the cash, so the company now has to collect that money back from the rider.
      const rider = await User.findByIdAndUpdate(order.rider, { $inc: { commissionDebt: change } }, { new: true });
      await writeLedger({ owner: customer._id, ownerType: 'CUSTOMER', type: 'WALLET_CREDIT', amount: change, direction: 1, balance: 'WALLET', walletAfter: round2(customer.walletBalance), order: order._id, note: `Change from order ${order.orderId}` });
      if (rider) {
        await writeLedger({ owner: rider._id, ownerType: 'RIDER', type: 'CUSTOMER_CHANGE', amount: change, direction: 1, balance: 'DEBT', walletAfter: round2(rider.currentWalletAmount), debtAfter: round2(rider.commissionDebt), order: order._id, note: `Cash change kept, credited to customer wallet (order ${order.orderId})` });
      }
      return {
        success: true,
        message: 'Change added to the customer wallet',
        changeAmount: change,
        customerWalletBalance: round2(customer.walletBalance),
        riderDebt: round2(rider?.commissionDebt || 0),
      };
    },

    /** Admin one-off: settle wallets for orders delivered before the wallet feature existed. */
    settlePastDeliveredOrders: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requireSuperAdmin(context);
      // The filter is cast because `orderStatus` is a string-literal union in the schema typings.
      const pending = (await Order.find({ orderStatus: { $in: DONE }, rider: { $ne: null }, riderSettledAt: null } as any)
        .select('_id')
        .limit(5000)) as unknown as Array<{ _id: Types.ObjectId }>;
      for (const order of pending) await settleRiderForOrder(order._id);
      await audit(context, 'settlePastDeliveredOrders', 'Order', undefined, { count: pending.length });
      return pending.length;
    },
  },
};
