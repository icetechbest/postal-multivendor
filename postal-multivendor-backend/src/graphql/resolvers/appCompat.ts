import { Types } from 'mongoose';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';
import { WithdrawRequest } from '../../models/WithdrawRequest';
import { AuthContext, requireAuth, requireRole } from '../../middleware/auth';
import { pubsub } from '../../services/pubsub';
import { AuthorizationError, NotFoundError, ValidationError } from '../../utils/errors';
import { ensureRestaurantOwner, round2 } from './adminHelpers';
import {
  ensureOrderAccess,
  getPopulatedOrder,
  idOf,
  orderZoneId,
  publishOrderUpdate,
  publishRiderAssignment,
  publishZoneOrder,
} from './appHelpers';

/**
 * Compatibility resolvers for the Store (vendor) and Rider mobile apps.
 *
 * The apps were written against an Enatega-style schema. Everything here is
 * additive and maps onto the existing models; no existing operation changes.
 *
 * Status mapping: both apps use the same status strings as the backend
 * (PENDING / ACCEPTED / ASSIGNED / PICKED / DELIVERED / COMPLETED / CANCELLED),
 * so no translation is required. `AWAITING_ADMIN` is backend-only and is never
 * produced by these resolvers.
 */

const DONE = ['DELIVERED', 'COMPLETED'];
const ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'ASSIGNED', 'PICKED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

const objectId = (value: string, label = 'id'): Types.ObjectId => {
  if (!value || !Types.ObjectId.isValid(value)) throw new ValidationError(`Invalid ${label}`);
  return new Types.ObjectId(value);
};

/** Restaurants owned by the authenticated vendor (empty list for admins). */
const ownedRestaurantIds = async (context: AuthContext): Promise<Types.ObjectId[]> => {
  requireAuth(context);
  if (context.user!.role === 'ADMIN') return [];
  const stores = await Restaurant.find({ owner: context.user!.userId }).select('_id');
  return stores.map((store) => store._id as Types.ObjectId);
};

const ensureStoreAccess = async (storeId: string, context: AuthContext): Promise<any> => {
  requireAuth(context);
  const store = await Restaurant.findById(objectId(storeId, 'storeId'));
  if (!store) throw new NotFoundError('Restaurant');
  ensureRestaurantOwner(store, context);
  return store;
};

/** Riders may only read/write their own record; admins may act on anyone. */
const ensureRiderSelf = (riderId: string, context: AuthContext): void => {
  requireAuth(context);
  if (context.user!.role === 'ADMIN') return;
  if (context.user!.role !== 'RIDER' || context.user!.userId !== riderId) throw new AuthorizationError();
};

const dateWindow = (startDate?: string | null, endDate?: string | null) => {
  const range: Record<string, Date> = {};
  if (startDate) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) throw new ValidationError('Invalid startDate');
    range.$gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) throw new ValidationError('Invalid endDate');
    range.$lte = end;
  }
  return Object.keys(range).length ? range : undefined;
};

const pagination = (page?: number | null, limit?: number | null) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  return { skip: (safePage - 1) * safeLimit, limit: safeLimit };
};

// ---------------------------------------------------------------- earnings graphs
const storeEarningsGraph = async (
  storeId: string,
  page?: number | null,
  limit?: number | null,
  startDate?: string | null,
  endDate?: string | null
) => {
  const p = pagination(page, limit);
  const match: Record<string, any> = { restaurant: objectId(storeId, 'storeId'), orderStatus: { $in: DONE } };
  const createdAt = dateWindow(startDate, endDate);
  if (createdAt) match.createdAt = createdAt;

  const [result] = await Order.aggregate([
    { $match: match },
    { $lookup: { from: 'restaurants', localField: 'restaurant', foreignField: '_id', as: 'store' } },
    { $addFields: { commissionRate: { $ifNull: [{ $arrayElemAt: ['$store.commissionRate', 0] }, 0] } } },
    {
      $addFields: {
        storeEarning: {
          $subtract: ['$orderAmount', { $divide: [{ $multiply: ['$orderAmount', '$commissionRate'] }, 100] }],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        totalEarningsSum: { $sum: '$storeEarning' },
        totalOrderAmount: { $sum: '$orderAmount' },
        totalDeliveries: { $sum: 1 },
        orderCount: { $sum: 1 },
        earningsArray: {
          $push: {
            totalOrderAmount: '$orderAmount',
            totalEarnings: '$storeEarning',
            orderDetails: {
              orderId: '$orderId',
              orderType: { $cond: [{ $gt: ['$deliveryCharges', 0] }, 'DELIVERY', 'PICKUP'] },
              paymentMethod: '$paymentMethod',
            },
            date: '$createdAt',
          },
        },
      },
    },
    { $sort: { _id: -1 } },
    {
      $facet: {
        metadata: [{ $group: { _id: null, orders: { $sum: '$orderCount' } } }],
        data: [{ $skip: p.skip }, { $limit: p.limit }],
      },
    },
  ]);

  const groups = (result?.data || []).map((group: any) => ({
    _id: group._id,
    totalEarningsSum: round2(group.totalEarningsSum),
    totalOrderAmount: round2(group.totalOrderAmount),
    totalDeliveries: group.totalDeliveries,
    earningsArray: group.earningsArray.map((entry: any) => ({
      ...entry,
      totalOrderAmount: round2(entry.totalOrderAmount),
      totalEarnings: round2(entry.totalEarnings),
    })),
  }));

  return {
    totalCount: result?.metadata?.[0]?.orders || 0,
    earnings: groups,
  };
};

const riderEarningsGraph = async (
  riderId: string,
  page?: number | null,
  limit?: number | null,
  startDate?: string | null,
  endDate?: string | null
) => {
  const p = pagination(page, limit);
  const match: Record<string, any> = { rider: objectId(riderId, 'riderId'), orderStatus: { $in: DONE } };
  const createdAt = dateWindow(startDate, endDate);
  if (createdAt) match.createdAt = createdAt;

  const [result] = await Order.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        deliveryFee: { $ifNull: ['$deliveryCharges', 0] },
        tip: { $ifNull: ['$tipping', 0] },
        // Hours spent between pickup and delivery, when both timestamps exist.
        hours: {
          $cond: [
            { $and: [{ $ne: ['$pickedAt', null] }, { $ne: ['$deliveredAt', null] }] },
            { $divide: [{ $subtract: ['$deliveredAt', '$pickedAt'] }, 3600000] },
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        totalEarningsSum: { $sum: { $add: ['$deliveryFee', '$tip'] } },
        totalTipsSum: { $sum: '$tip' },
        totalDeliveries: { $sum: 1 },
        totalHours: { $sum: '$hours' },
        orderCount: { $sum: 1 },
        earningsArray: {
          $push: {
            tip: '$tip',
            deliveryFee: '$deliveryFee',
            totalEarnings: { $add: ['$deliveryFee', '$tip'] },
            orderDetails: {
              orderType: { $cond: [{ $gt: ['$deliveryCharges', 0] }, 'DELIVERY', 'PICKUP'] },
              orderId: '$orderId',
              paymentMethod: '$paymentMethod',
            },
            date: '$createdAt',
          },
        },
      },
    },
    { $sort: { _id: -1 } },
    {
      $facet: {
        metadata: [{ $group: { _id: null, orders: { $sum: '$orderCount' } } }],
        data: [{ $skip: p.skip }, { $limit: p.limit }],
      },
    },
  ]);

  const groups = (result?.data || []).map((group: any) => ({
    _id: group._id,
    totalEarningsSum: round2(group.totalEarningsSum),
    totalTipsSum: round2(group.totalTipsSum),
    totalDeliveries: group.totalDeliveries,
    totalHours: round2(group.totalHours),
    date: group._id ? new Date(group._id) : null,
    earningsArray: group.earningsArray.map((entry: any) => ({
      ...entry,
      tip: round2(entry.tip),
      deliveryFee: round2(entry.deliveryFee),
      totalEarnings: round2(entry.totalEarnings),
    })),
  }));

  return {
    totalCount: result?.metadata?.[0]?.orders || 0,
    earnings: groups,
  };
};

// ---------------------------------------------------------------- mutations
const acceptOrder = async (orderId: string, time: string | undefined, context: AuthContext) => {
  requireRole(context, ['VENDOR', 'ADMIN']);
  const order = await Order.findById(objectId(orderId, 'order id'));
  if (!order) throw new NotFoundError('Order');
  const restaurant = await Restaurant.findById(order.restaurant);
  if (!restaurant) throw new NotFoundError('Restaurant');
  ensureRestaurantOwner(restaurant, context);
  if (order.orderStatus === 'AWAITING_ADMIN') throw new ValidationError('This order is waiting for admin confirmation');
  if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.orderStatus)) throw new ValidationError('This order can no longer be accepted');
  const minutes = Number(time ?? 0);
  if (time !== undefined && time !== null && time !== '' && (!Number.isFinite(minutes) || minutes < 0)) {
    throw new ValidationError('Invalid preparation time');
  }
  order.orderStatus = 'ACCEPTED';
  order.acceptedAt = order.acceptedAt || new Date();
  order.preparationTime = Number.isFinite(minutes) ? Math.round(minutes) : 0;
  await order.save();
  return publishOrderUpdate(order._id, 'acceptOrder');
};

const orderPickedUp = async (orderId: string, context: AuthContext) => {
  requireRole(context, ['VENDOR', 'ADMIN']);
  const order = await Order.findById(objectId(orderId, 'order id'));
  if (!order) throw new NotFoundError('Order');
  const restaurant = await Restaurant.findById(order.restaurant);
  if (!restaurant) throw new NotFoundError('Restaurant');
  ensureRestaurantOwner(restaurant, context);
  if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.orderStatus)) throw new ValidationError('This order can no longer be picked up');
  order.orderStatus = 'PICKED';
  order.pickedAt = new Date();
  order.isPickedUp = true;
  await order.save();
  return publishOrderUpdate(order._id, 'orderPickedUp');
};

const muteRing = async (orderId: string | undefined, context: AuthContext) => {
  requireAuth(context);
  if (!orderId) throw new ValidationError('orderId is required');
  const order = await Order.findById(objectId(orderId, 'order id'));
  if (!order) throw new NotFoundError('Order');
  await ensureOrderAccess(order, context, true);
  order.isRinged = false;
  order.isRiderRinged = false;
  await order.save();
  return true;
};

const toggleAvailability = async (restaurantId: string | undefined, context: AuthContext) => {
  requireRole(context, ['VENDOR', 'ADMIN']);
  if (!restaurantId) throw new ValidationError('restaurantId is required');
  const restaurant = await ensureStoreAccess(restaurantId, context);
  restaurant.isAvailable = !restaurant.isAvailable;
  await restaurant.save();
  return restaurant;
};

const saveRestaurantToken = async (token: string | undefined, isEnabled: boolean | undefined, context: AuthContext) => {
  requireRole(context, ['VENDOR', 'ADMIN']);
  const restaurant = await Restaurant.findOne({ owner: context.user!.userId });
  if (!restaurant) throw new NotFoundError('Restaurant');
  if (token !== undefined) restaurant.notificationToken = token;
  if (isEnabled !== undefined) restaurant.enableNotification = isEnabled;
  await restaurant.save();
  return restaurant;
};

const assignOrder = async (orderId: string, context: AuthContext) => {
  requireRole(context, ['RIDER']);
  const riderId = context.user!.userId;
  const order = await Order.findById(objectId(orderId, 'order id'));
  if (!order) throw new NotFoundError('Order');
  if (order.orderStatus === 'AWAITING_ADMIN') throw new ValidationError('This order is waiting for admin confirmation');
  if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.orderStatus)) throw new ValidationError('This order can no longer be assigned');
  if (order.rider && idOf(order.rider) !== riderId) throw new AuthorizationError('Order is assigned to another rider');
  if (order.rider && idOf(order.rider) === riderId) return getPopulatedOrder(order._id);

  // A rider may only self-assign orders inside their own zone.
  const rider = await User.findById(riderId).select('zone');
  const riderZone = idOf((rider as any)?.zone);
  if (riderZone) {
    const zoneId = await orderZoneId(order);
    if (zoneId && zoneId !== riderZone) throw new AuthorizationError('Order is outside your zone');
  }

  order.rider = new Types.ObjectId(riderId);
  order.orderStatus = 'ASSIGNED';
  order.riderAssignedAt = new Date();
  order.assignedAt = order.riderAssignedAt;
  await order.save();
  const updated = await publishOrderUpdate(order._id, 'assignOrder');
  await publishRiderAssignment(order._id, riderId, 'new');
  await publishZoneOrder(order._id, 'remove');
  return updated;
};

const updateOrderStatusRider = async (orderId: string, status: string, context: AuthContext) => {
  requireRole(context, ['RIDER', 'ADMIN']);
  const order = await Order.findById(objectId(orderId, 'order id'));
  if (!order) throw new NotFoundError('Order');
  if (context.user!.role !== 'ADMIN' && idOf(order.rider) !== context.user!.userId) throw new AuthorizationError();
  const normalized = String(status || '').toUpperCase();
  if (!ORDER_STATUSES.includes(normalized)) throw new ValidationError('Invalid order status');
  if (order.orderStatus === 'AWAITING_ADMIN') throw new ValidationError('This order is waiting for admin confirmation');

  const now = new Date();
  order.orderStatus = normalized as typeof order.orderStatus;
  if (normalized === 'PICKED') {
    order.pickedAt = now;
    order.isPickedUp = true;
  }
  if (normalized === 'DELIVERED') {
    order.deliveredAt = now;
    order.completionTime = now;
  }
  if (normalized === 'COMPLETED') {
    order.completedAt = now;
    order.completionTime = now;
  }
  if (normalized === 'CANCELLED') order.cancelledAt = now;
  if (['DELIVERED', 'COMPLETED'].includes(normalized) && order.paymentMethod === 'COD') {
    order.paymentStatus = 'PAID';
    order.paidAmount = order.total;
  }
  await order.save();
  return publishOrderUpdate(order._id, 'updateOrderStatusRider');
};

const updateRiderDetails = async (
  riderId: string,
  field: 'licenseDetails' | 'vehicleDetails' | 'bussinessDetails',
  value: Record<string, unknown> | null | undefined,
  context: AuthContext
) => {
  ensureRiderSelf(riderId, context);
  const rider = await User.findById(objectId(riderId, 'rider id'));
  if (!rider) throw new NotFoundError('Rider');
  const current = ((rider as any)[field] || {}) as Record<string, unknown>;
  const incoming = Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null));
  (rider as any)[field] = { ...current, ...incoming };
  await rider.save();
  return rider;
};

const updateWorkSchedule = async (
  riderId: string,
  workSchedule: Array<{ day: string; enabled?: boolean; slots?: Array<{ startTime?: string; endTime?: string }> }>,
  timeZone: string,
  context: AuthContext
) => {
  ensureRiderSelf(riderId, context);
  if (!Array.isArray(workSchedule)) throw new ValidationError('workSchedule must be an array');
  if (!timeZone || typeof timeZone !== 'string') throw new ValidationError('timeZone is required');
  const rider = await User.findById(objectId(riderId, 'rider id'));
  if (!rider) throw new NotFoundError('Rider');
  rider.timeZone = timeZone;
  rider.workSchedule = workSchedule.map((day) => ({
    day: String(day.day || ''),
    enabled: Boolean(day.enabled),
    slots: (day.slots || []).map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime })),
  }));
  await rider.save();
  return rider;
};

// ---------------------------------------------------------------- resolvers
export const appCompatResolvers = {
  Query: {
    restaurantOrders: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requireRole(context, ['VENDOR', 'ADMIN']);
      const filter: Record<string, any> = { isActive: { $ne: false } };
      if (context.user!.role !== 'ADMIN') {
        const storeIds = await ownedRestaurantIds(context);
        if (!storeIds.length) return [];
        filter.restaurant = { $in: storeIds };
      }
      return Order.find(filter)
        .populate('restaurant')
        .populate('user')
        .populate('rider')
        .populate('review')
        .sort({ createdAt: -1 })
        .limit(200);
    },

    riderOrders: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requireRole(context, ['RIDER', 'ADMIN']);
      const filter: Record<string, any> = { isActive: { $ne: false } };
      if (context.user!.role !== 'ADMIN') filter.rider = context.user!.userId;
      return Order.find(filter)
        .populate('restaurant')
        .populate('user')
        .populate('rider')
        .populate('review')
        .sort({ createdAt: -1 })
        .limit(200);
    },

    storeCurrentWithdrawRequest: async (_parent: unknown, { storeId }: { storeId?: string }, context: AuthContext) => {
      requireAuth(context);
      let store: any;
      if (storeId) store = await ensureStoreAccess(storeId, context);
      else store = await Restaurant.findOne({ owner: context.user!.userId });
      if (!store) return null;
      return WithdrawRequest.findOne({ userType: 'STORE', store: store._id, status: 'REQUESTED' }).sort({ createdAt: -1 });
    },

    riderCurrentWithdrawRequest: async (_parent: unknown, { riderId }: { riderId?: string }, context: AuthContext) => {
      requireAuth(context);
      const targetId = riderId || context.user!.userId;
      ensureRiderSelf(targetId, context);
      return WithdrawRequest.findOne({ userType: 'RIDER', rider: targetId, status: 'REQUESTED' }).sort({ createdAt: -1 });
    },

    storeEarningsGraph: async (
      _parent: unknown,
      { storeId, page, limit, startDate, endDate }: { storeId: string; page?: number; limit?: number; startDate?: string; endDate?: string },
      context: AuthContext
    ) => {
      requireRole(context, ['VENDOR', 'ADMIN']);
      await ensureStoreAccess(storeId, context);
      return storeEarningsGraph(storeId, page, limit, startDate, endDate);
    },

    riderEarningsGraph: async (
      _parent: unknown,
      { riderId, page, limit, startDate, endDate }: { riderId: string; page?: number; limit?: number; startDate?: string; endDate?: string },
      context: AuthContext
    ) => {
      requireRole(context, ['RIDER', 'ADMIN']);
      ensureRiderSelf(riderId, context);
      return riderEarningsGraph(riderId, page, limit, startDate, endDate);
    },
  },

  Mutation: {
    acceptOrder: (_parent: unknown, { _id, time }: { _id: string; time?: string }, context: AuthContext) => acceptOrder(_id, time, context),
    orderPickedUp: (_parent: unknown, { _id }: { _id: string }, context: AuthContext) => orderPickedUp(_id, context),
    muteRing: (_parent: unknown, { orderId }: { orderId?: string }, context: AuthContext) => muteRing(orderId, context),
    toggleAvailability: (_parent: unknown, { restaurantId }: { restaurantId?: string }, context: AuthContext) => toggleAvailability(restaurantId, context),
    toggleStoreAvailability: (_parent: unknown, { restaurantId }: { restaurantId: string }, context: AuthContext) => toggleAvailability(restaurantId, context),
    saveRestaurantToken: (_parent: unknown, { token, isEnabled }: { token?: string; isEnabled?: boolean }, context: AuthContext) =>
      saveRestaurantToken(token, isEnabled, context),

    assignOrder: (_parent: unknown, { id }: { id: string }, context: AuthContext) => assignOrder(id, context),
    updateOrderStatusRider: (_parent: unknown, { id, status }: { id: string; status: string }, context: AuthContext) =>
      updateOrderStatusRider(id, status, context),
    updateRiderLicenseDetails: (_parent: unknown, { id, licenseDetails }: { id: string; licenseDetails?: any }, context: AuthContext) =>
      updateRiderDetails(id, 'licenseDetails', licenseDetails, context),
    updateRiderVehicleDetails: (_parent: unknown, { id, vehicleDetails }: { id: string; vehicleDetails?: any }, context: AuthContext) =>
      updateRiderDetails(id, 'vehicleDetails', vehicleDetails, context),
    updateRiderBussinessDetails: (_parent: unknown, { id, bussinessDetails }: { id: string; bussinessDetails?: any }, context: AuthContext) =>
      updateRiderDetails(id, 'bussinessDetails', bussinessDetails, context),
    updateWorkSchedule: (
      _parent: unknown,
      { riderId, workSchedule, timeZone }: { riderId: string; workSchedule: any[]; timeZone: string },
      context: AuthContext
    ) => updateWorkSchedule(riderId, workSchedule, timeZone, context),
  },

  Subscription: {
    subscriptionAssignRider: {
      subscribe: async (_parent: unknown, { riderId }: { riderId: string }, context: AuthContext) => {
        requireAuth(context);
        if (context.user!.role !== 'ADMIN' && context.user!.userId !== riderId) throw new AuthorizationError();
        return pubsub.asyncIterableIterator([`RIDER_ASSIGN_${riderId}`]);
      },
    },
    subscriptionZoneOrders: {
      subscribe: async (_parent: unknown, { zoneId }: { zoneId: string }, context: AuthContext) => {
        requireRole(context, ['RIDER', 'ADMIN']);
        return pubsub.asyncIterableIterator([`ZONE_ORDERS_${zoneId}`]);
      },
    },
  },
};
