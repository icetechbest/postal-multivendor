import { Types } from 'mongoose';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { Review } from '../../models/Review';
import { User } from '../../models/User';
import { WebNotification } from '../../models/Notification';
import { AuthContext, requireAuth } from '../../middleware/auth';
import { AuthorizationError, NotFoundError } from '../../utils/errors';
import { pubsub } from '../../services/pubsub';
import { sendPushNotification } from '../../services/push';
import config from '../../config';

/** pubsub channel that receives every new order waiting for admin/staff confirmation. */
export const ADMIN_PENDING_ORDERS_CHANNEL = 'ADMIN_PENDING_ORDERS';
/** Admin dashboard page that lists orders waiting for confirmation (used by WebNotification.navigateTo). */
export const ADMIN_PENDING_ORDERS_PATH = '/general/pending-orders';
export const AWAITING_ADMIN = 'AWAITING_ADMIN';

export const idOf = (value: any): string => {
  if (!value) return '';
  return (value._id || value.id || value).toString();
};

export const populateOrder = (id: any) =>
  Order.findById(id)
    .populate('restaurant')
    .populate('user')
    .populate('rider')
    .populate('review');

export const getPopulatedOrder = async (id: any) => {
  const order = await populateOrder(id);
  if (!order) throw new NotFoundError('Order');
  return order;
};

export const getUser = (id: string) => User.findById(id).populate('addresses').populate('zone');

export const getReviewData = async (restaurant: string) => {
  const [reviews, aggregate] = await Promise.all([
    Review.find({ restaurant, isActive: true }).sort({ createdAt: -1 }).limit(50),
    Review.aggregate([
      { $match: { restaurant: new Types.ObjectId(restaurant), isActive: true } },
      { $group: { _id: '$restaurant', ratings: { $avg: '$rating' }, total: { $sum: 1 } } },
    ]),
  ]);
  return { reviews, ratings: aggregate[0]?.ratings || 0, total: aggregate[0]?.total || 0 };
};

export const ensureOrderAccess = async (order: any, context: AuthContext, management = false): Promise<void> => {
  requireAuth(context);
  if (context.user!.role === 'ADMIN') return;
  // Orders waiting for admin confirmation are invisible to restaurants and riders; only the customer may read them.
  if (order.orderStatus === AWAITING_ADMIN) {
    if (!management && idOf(order.user) === context.user!.userId) return;
    throw new AuthorizationError();
  }
  if (!management && idOf(order.user) === context.user!.userId) return;
  if (order.rider && idOf(order.rider) === context.user!.userId) return;
  if (['VENDOR', 'ADMIN'].includes(context.user!.role)) {
    const restaurant = await Restaurant.findById(idOf(order.restaurant));
    if (restaurant && idOf(restaurant.owner) === context.user!.userId) return;
  }
  throw new AuthorizationError();
};

export const publishOrderUpdate = async (orderId: any, origin = 'backend', pushBody?: string): Promise<any> => {
  const order = await getPopulatedOrder(orderId);
  const userId = idOf(order.user);
  await Promise.all([
    pubsub.publish(`ORDER_STATUS_${idOf(order._id)}`, { subscriptionOrder: order }),
    pubsub.publish('DISPATCHER_ORDERS', { subscriptionDispatcher: order }),
    pubsub.publish(`ORDER_STATUS_USER_${userId}`, {
      orderStatusChanged: { userId, origin, order },
    }),
  ]);
  const customer = order.user as any;
  if (customer?.notificationToken && customer?.isOrderNotification !== false) {
    await sendPushNotification(customer.notificationToken, `Order ${order.orderId}`, pushBody || (order.orderStatus === AWAITING_ADMIN ? 'بانتظار التأكيد' : `Order status: ${order.orderStatus}`), {
      orderId: idOf(order._id),
      status: order.orderStatus,
    });
  }
  return order;
};

/** Sends the order to its restaurant (pubsub + push). Called once an admin/staff member has confirmed it. */
export const publishOrderToRestaurant = async (orderId: any, origin = 'placeOrder'): Promise<any> => {
  const order = await getPopulatedOrder(orderId);
  await pubsub.publish(`ORDER_PLACED_${idOf(order.restaurant)}`, { subscribePlaceOrder: order });
  await publishOrderUpdate(order._id, origin);
  const restaurant = order.restaurant as any;
  if (restaurant?.notificationToken && restaurant?.enableNotification !== false) {
    await sendPushNotification(restaurant.notificationToken, 'New order', `Order ${order.orderId} has been placed`, {
      orderId: idOf(order._id),
    });
  }
  return order;
};

/** Notifies admins and staff (pubsub, dashboard notification, push) that an order awaits confirmation. */
const notifyAdminsOfPendingOrder = async (order: any): Promise<void> => {
  await pubsub.publish(ADMIN_PENDING_ORDERS_CHANNEL, { subscriptionPendingOrders: order });
  const customer = order.user as any;
  const store = order.restaurant as any;
  const summary = `${order.orderId} - ${customer?.name || ''} - ${store?.name || ''} - ${order.total}`;
  try {
    await WebNotification.create({ title: 'طلب جديد بانتظار التأكيد', body: summary, navigateTo: ADMIN_PENDING_ORDERS_PATH });
  } catch (error) {
    console.warn('Could not create the pending-order dashboard notification:', error instanceof Error ? error.message : error);
  }
  const recipients = await User.find({ role: { $in: ['ADMIN', 'STAFF'] }, isActive: true, notificationToken: { $exists: true, $ne: '' } }).select('notificationToken');
  const tokens = Array.from(new Set(recipients.map((recipient) => recipient.notificationToken).filter((token): token is string => Boolean(token))));
  await Promise.all(tokens.map((token) => sendPushNotification(token, 'طلب جديد بانتظار التأكيد', summary, { orderId: idOf(order._id), navigateTo: ADMIN_PENDING_ORDERS_PATH })));
};

/**
 * Called right after an order is created. New orders wait for admin/staff confirmation, so the restaurant is NOT notified here;
 * the restaurant is notified by publishOrderToRestaurant() after adminConfirmOrder.
 */
export const publishOrderPlaced = async (orderId: any): Promise<any> => {
  const order = await getPopulatedOrder(orderId);
  if (order.orderStatus !== AWAITING_ADMIN) return publishOrderToRestaurant(order._id);
  await notifyAdminsOfPendingOrder(order);
  await publishOrderUpdate(order._id, 'placeOrder');
  return order;
};

/** Tells the customer an order was cancelled by the platform (confirmation rejected or timed out). */
export const notifyCustomerCancelled = (orderId: any, reason: string, origin: string): Promise<any> =>
  publishOrderUpdate(orderId, origin, `تم إلغاء الطلب: ${reason}`);

export const validCoordinates = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

export const distanceKm = (latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = radians(latitudeB - latitudeA);
  const dLon = radians(longitudeB - longitudeA);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const pointInPolygon = (longitude: number, latitude: number, polygon: number[][][]): boolean => {
  const ring = polygon?.[0];
  if (!ring || ring.length < 4) return true;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > latitude !== yj > latitude && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const findNearbyRestaurants = async (
  latitude?: number,
  longitude?: number,
  shopType?: string,
  limit = 50
): Promise<any[]> => {
  if ((latitude === undefined) !== (longitude === undefined)) return [];
  const filter: any = { isActive: true, isAvailable: true };
  if (shopType) filter.shopType = shopType;
  if (latitude !== undefined && longitude !== undefined && validCoordinates(latitude, longitude)) {
    filter.location = {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: config.delivery.maxDistanceKm * 1000,
      },
    };
  }
  return Restaurant.find(filter).populate('owner').populate('categories').populate('zone').limit(limit);
};

export const restaurantList = (restaurants: any[]) => {
  const sections = Array.from(new Set(restaurants.flatMap((restaurant) => restaurant.sections || []))).map((name) => ({
    _id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    restaurants: restaurants.filter((restaurant) => restaurant.sections?.includes(name)).map((restaurant) => idOf(restaurant._id)),
  }));
  return { offers: [], sections, restaurants };
};
