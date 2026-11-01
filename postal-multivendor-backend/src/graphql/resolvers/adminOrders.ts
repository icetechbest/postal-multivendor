import { Types } from 'mongoose';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';
import { AuthContext, requireRole } from '../../middleware/auth';
import { pubsub } from '../../services/pubsub';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { ADMIN_PENDING_ORDERS_CHANNEL, AWAITING_ADMIN, ensureOrderAccess, getPopulatedOrder, idOf, notifyCustomerCancelled, publishOrderToRestaurant, publishOrderUpdate } from './appHelpers';
import { assertObjectId, audit, cleanId, dateRange, escapeRegex, pageParams, requirePlatformReader } from './adminHelpers';

const STATUSES = ['AWAITING_ADMIN', 'PENDING', 'ACCEPTED', 'ASSIGNED', 'PICKED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

/** Orders restaurants/riders must never see: still awaiting confirmation, or rejected/timed out before ever reaching the restaurant. */
const HIDDEN_FROM_FIELD = [{ orderStatus: AWAITING_ADMIN }, { orderStatus: 'CANCELLED', adminRejectedAt: { $exists: true } }];

const populate = (query: any) =>
  query.populate('restaurant').populate('user').populate('rider').populate({ path: 'items.food', model: 'Food' });

/** Base filter limiting what the caller may see: admins/staff all, vendors their stores, riders their orders. */
const scopeFilter = async (context: AuthContext, restaurantId?: string | null): Promise<Record<string, any>> => {
  const filter: Record<string, any> = {};
  const role = context.user!.role;
  // Restaurants and riders never see orders that still wait for admin confirmation.
  if (role === 'RIDER') {
    filter.rider = new Types.ObjectId(context.user!.userId);
    filter.$nor = HIDDEN_FROM_FIELD;
  } else if (role === 'VENDOR') {
    filter.$nor = HIDDEN_FROM_FIELD;
    const ids = (await Restaurant.find({ owner: context.user!.userId }).select('_id')).map((r) => idOf(r._id));
    if (restaurantId && !ids.includes(restaurantId)) throw new AuthorizationError();
    filter.restaurant = restaurantId ? new Types.ObjectId(restaurantId) : { $in: ids.map((id) => new Types.ObjectId(id)) };
  } else if (role === 'ADMIN' || role === 'STAFF') {
    if (restaurantId) filter.restaurant = new Types.ObjectId(assertObjectId(restaurantId, 'restaurant'));
  } else throw new AuthorizationError();
  return filter;
};

const searchFilter = (search?: string | null) => {
  if (!search?.trim()) return null;
  const rx = { $regex: escapeRegex(search.trim()), $options: 'i' };
  return { $or: [{ orderId: rx }, { 'deliveryAddress.deliveryAddress': rx }] };
};

const paged = async (filter: Record<string, any>, page: number, limit: number, sort: Record<string, 1 | -1> = { createdAt: -1 }) => {
  const p = pageParams(page, limit, 10);
  const [orders, totalCount] = await Promise.all([
    populate(Order.find(filter).sort(sort).skip(p.skip).limit(p.limit)),
    Order.countDocuments(filter),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / p.limit));
  return { orders, totalCount, currentPage: p.page, totalPages, nextPage: p.page < totalPages ? p.page + 1 : null, prevPage: p.page > 1 ? p.page - 1 : null };
};

const and = (...parts: Array<Record<string, any> | null | undefined>) => {
  const list = parts.filter((p): p is Record<string, any> => Boolean(p) && Object.keys(p as object).length > 0);
  return list.length ? { $and: list } : {};
};

/** Orders waiting for confirmation, matched by order id, delivery address or the customer's name/phone/email. */
const pendingSearchFilter = async (search?: string | null): Promise<Record<string, any> | null> => {
  if (!search?.trim()) return null;
  const rx = { $regex: escapeRegex(search.trim()), $options: 'i' };
  const users = await User.find({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select('_id').limit(200);
  return { $or: [{ orderId: rx }, { 'deliveryAddress.deliveryAddress': rx }, ...(users.length ? [{ user: { $in: users.map((u) => u._id) } }] : [])] };
};

export const adminOrderResolvers = {
  Query: {
    pendingConfirmationOrders: async (_parent: unknown, args: { page?: number; limit?: number; search?: string | null }, context: AuthContext) => {
      requirePlatformReader(context);
      // Oldest first: the order that has waited longest is handled first.
      return paged(and({ orderStatus: AWAITING_ADMIN }, await pendingSearchFilter(args.search)), args.page ?? 1, args.limit ?? 10, { createdAt: 1 });
    },
    pendingConfirmationCount: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requirePlatformReader(context);
      return Order.countDocuments({ orderStatus: AWAITING_ADMIN });
    },
    getActiveOrders: async (_parent: unknown, args: any, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR', 'RIDER']);
      const scope = await scopeFilter(context, cleanId(args.restaurantId));
      const statuses: string[] = (args.actions?.length ? args.actions : args.status ? [args.status] : []).map((s: string) => s.toUpperCase()).filter((s: string) => STATUSES.includes(s));
      const status = statuses.length ? { orderStatus: { $in: statuses } } : { orderStatus: { $nin: ['COMPLETED', 'CANCELLED'] } };
      return paged(and(scope, status, searchFilter(args.search)), args.page, args.rowsPerPage ?? args.limit);
    },
    ordersByRestId: async (_parent: unknown, args: any, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      const scope = await scopeFilter(context, assertObjectId(args.restaurant, 'restaurant'));
      const status = args.status ? { orderStatus: args.status.toUpperCase() } : null;
      const p = pageParams(args.page, args.rows ?? args.limit, 10);
      return populate(Order.find(and(scope, status, searchFilter(args.search))).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit));
    },
    ordersByRestIdWithoutPagination: async (_parent: unknown, args: { restaurant: string; search?: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      const scope = await scopeFilter(context, assertObjectId(args.restaurant, 'restaurant'));
      return populate(Order.find(and(scope, searchFilter(args.search))).sort({ createdAt: -1 }).limit(5000));
    },
    ordersByUser: async (_parent: unknown, args: { userId: string; page?: number; limit?: number }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'USER']);
      const userId = assertObjectId(args.userId, 'user');
      if (context.user!.role === 'USER' && context.user!.userId !== userId) throw new AuthorizationError();
      return paged({ user: new Types.ObjectId(userId) }, args.page ?? 1, args.limit ?? 10);
    },
    allOrders: async (_parent: unknown, args: { page?: number }, context: AuthContext) => {
      requirePlatformReader(context);
      const p = pageParams(args.page, 50, 50);
      return populate(Order.find().sort({ createdAt: -1 }).skip(p.skip).limit(p.limit));
    },
    allOrdersPaginated: async (_parent: unknown, args: any, context: AuthContext) => {
      requirePlatformReader(context);
      const range = dateRange(args.dateKeyword, args.starting_date, args.ending_date);
      const statuses = (args.orderStatus || []).map((s: string) => s.toUpperCase()).filter((s: string) => STATUSES.includes(s));
      return paged(
        and(range ? { createdAt: range } : null, statuses.length ? { orderStatus: { $in: statuses } } : null, searchFilter(args.search)),
        args.page,
        args.rows
      );
    },
    allOrdersWithoutPagination: async (_parent: unknown, args: any, context: AuthContext) => {
      requirePlatformReader(context);
      const range = dateRange(args.dateKeyword, args.starting_date, args.ending_date);
      return populate(Order.find(range ? { createdAt: range } : {}).sort({ createdAt: -1 }).limit(10000));
    },
  },

  Mutation: {
    adminConfirmOrder: async (_parent: unknown, args: { id: string; note?: string | null }, context: AuthContext) => {
      requirePlatformReader(context);
      const id = assertObjectId(args.id, 'order');
      const note = args.note?.trim() || undefined;
      // Atomic transition: only one caller can move the order out of AWAITING_ADMIN.
      const confirmed = await Order.findOneAndUpdate(
        { _id: id, orderStatus: AWAITING_ADMIN },
        { $set: { orderStatus: 'PENDING', adminConfirmedBy: context.user!.userId, adminConfirmedAt: new Date(), ...(note ? { adminNote: note } : {}) } },
        { new: true }
      );
      if (!confirmed) {
        const current = await Order.findById(id).select('orderStatus');
        if (!current) throw new NotFoundError('Order');
        throw new ConflictError(`Order is no longer awaiting confirmation (current status: ${current.orderStatus}). It may have been confirmed or rejected by someone else.`);
      }
      await audit(context, 'ADMIN_CONFIRM_ORDER', 'Order', id, { note });
      // The restaurant only learns about the order now.
      await publishOrderToRestaurant(confirmed._id, 'adminConfirmOrder');
      return getPopulatedOrder(confirmed._id);
    },
    adminRejectOrder: async (_parent: unknown, args: { id: string; reason: string }, context: AuthContext) => {
      requirePlatformReader(context);
      const id = assertObjectId(args.id, 'order');
      const reason = args.reason?.trim();
      if (!reason) throw new ValidationError('A rejection reason is required');
      const now = new Date();
      const rejected = await Order.findOneAndUpdate(
        { _id: id, orderStatus: AWAITING_ADMIN },
        { $set: { orderStatus: 'CANCELLED', reason, cancelledAt: now, adminRejectedBy: context.user!.userId, adminRejectedAt: now } },
        { new: true }
      );
      if (!rejected) {
        const current = await Order.findById(id).select('orderStatus');
        if (!current) throw new NotFoundError('Order');
        throw new ConflictError(`Order is no longer awaiting confirmation (current status: ${current.orderStatus}). It may have been confirmed or rejected by someone else.`);
      }
      await audit(context, 'ADMIN_REJECT_ORDER', 'Order', id, { reason });
      return notifyCustomerCancelled(rejected._id, reason, 'adminRejectOrder');
    },
    updateStatus: async (_parent: unknown, { id, orderStatus }: { id: string; orderStatus: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR', 'RIDER']);
      const status = orderStatus.toUpperCase();
      if (!STATUSES.includes(status)) throw new ValidationError('Invalid order status');
      const order = await Order.findById(assertObjectId(id, 'order'));
      if (!order) throw new NotFoundError('Order');
      if (context.user!.role === 'STAFF') {
        // Staff operate on behalf of the platform.
      } else await ensureOrderAccess(order, context, true);
      if (status === AWAITING_ADMIN) throw new ValidationError('An order cannot be moved back to AWAITING_ADMIN');
      // Orders waiting for admin confirmation can only leave that state through adminConfirmOrder / adminRejectOrder.
      if (order.orderStatus === AWAITING_ADMIN) {
        if (!['ADMIN', 'STAFF'].includes(context.user!.role)) throw new AuthorizationError();
        throw new ValidationError('This order is waiting for admin confirmation; use adminConfirmOrder or adminRejectOrder');
      }
      const now = new Date();
      order.orderStatus = status as typeof order.orderStatus;
      if (status === 'ACCEPTED') order.acceptedAt = now;
      if (status === 'PICKED') {
        order.pickedAt = now;
        order.isPickedUp = true;
      }
      if (status === 'DELIVERED') {
        order.deliveredAt = now;
        order.completionTime = now;
      }
      if (status === 'COMPLETED') {
        order.completedAt = now;
        order.completionTime = now;
      }
      if (status === 'CANCELLED') order.cancelledAt = now;
      if (['DELIVERED', 'COMPLETED'].includes(status) && order.paymentMethod === 'COD') {
        order.paymentStatus = 'PAID';
        order.paidAmount = order.total;
      }
      await order.save();
      return publishOrderUpdate(order._id, 'updateStatus');
    },
    assignRider: async (_parent: unknown, args: { id?: string; orderId?: string; riderId: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      const orderId = cleanId(args.orderId) || cleanId(args.id);
      if (!orderId) throw new ValidationError('Order id is required');
      const order = await Order.findById(assertObjectId(orderId, 'order'));
      if (!order) throw new NotFoundError('Order');
      if (context.user!.role !== 'STAFF') await ensureOrderAccess(order, context, true);
      if (order.orderStatus === AWAITING_ADMIN) throw new ValidationError('This order is waiting for admin confirmation');
      const rider = await User.findOne({ _id: assertObjectId(args.riderId, 'rider'), role: 'RIDER', isActive: true });
      if (!rider) throw new ValidationError('Invalid rider');
      order.rider = rider._id as any;
      order.orderStatus = 'ASSIGNED';
      order.riderAssignedAt = new Date();
      order.assignedAt = order.riderAssignedAt;
      await order.save();
      return publishOrderUpdate(order._id, 'assignRider');
    },
  },

  Subscription: {
    subscriptionPendingOrders: {
      subscribe: (_parent: unknown, _args: unknown, context: AuthContext) => {
        requirePlatformReader(context);
        return pubsub.asyncIterableIterator([ADMIN_PENDING_ORDERS_CHANNEL]);
      },
    },
    subscribePlaceOrder: {
      subscribe: async (_parent: unknown, { restaurant }: { restaurant: string }, context: AuthContext) => {
        requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
        const store = await Restaurant.findById(assertObjectId(restaurant, 'restaurant'));
        if (!store) throw new NotFoundError('Restaurant');
        if (context.user!.role === 'VENDOR' && idOf(store.owner) !== context.user!.userId) throw new AuthorizationError();
        return pubsub.asyncIterableIterator([`ORDER_PLACED_${restaurant}`]);
      },
      resolve: (payload: any) => {
        const order = payload.subscribePlaceOrder;
        return { userId: idOf(order.user), origin: 'new', order };
      },
    },
    subscriptionDispatcher: {
      subscribe: (_parent: unknown, _args: unknown, context: AuthContext) => {
        requireRole(context, ['ADMIN', 'STAFF']);
        return pubsub.asyncIterableIterator(['DISPATCHER_ORDERS']);
      },
    },
    riderUpdated: {
      subscribe: (_parent: unknown, _args: unknown, context: AuthContext) => {
        requireRole(context, ['ADMIN', 'STAFF']);
        return pubsub.asyncIterableIterator(['RIDER_UPDATED']);
      },
    },
  },
};

export const adminOrderFields = {
  Order: {
    zone: async (parent: any) => {
      const restaurant = await Restaurant.findById(idOf(parent.restaurant)).populate('zone');
      return restaurant?.zone ?? null;
    },
    selectedPrepTime: (parent: any) => parent.preparationTime ?? null,
  },
};
