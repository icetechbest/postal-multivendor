import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { Food } from '../../models/Food';
import { Addon } from '../../models/Addon';
import { User } from '../../models/User';
import { AuthContext, requireAuth } from '../../middleware/auth';
import { ValidationError, NotFoundError, AuthorizationError } from '../../utils/errors';
import { generateOrderId } from '../../utils/crypto';
import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

const publishOrderUpdate = (order: any) => {
  pubsub.publish('ORDER_STATUS_' + order._id, { subscriptionOrder: order });
  const userId = order.user?._id || order.user;
  pubsub.publish('ORDER_STATUS_USER_' + userId, { orderStatusChanged: order });
};

const populateOrder = (id: any) =>
  Order.findById(id)
    .populate('restaurant')
    .populate('user')
    .populate('rider')
    .populate({ path: 'items.food', model: 'Food' });

const ensureOrderManagementAccess = async (order: any, context: AuthContext) => {
  requireAuth(context);
  if (context.user!.role === 'ADMIN') return;
  if (context.user!.role === 'RIDER' && order.rider?.toString() === context.user!.userId) return;
  if (context.user!.role === 'VENDOR') {
    const restaurant = await Restaurant.findById(order.restaurant);
    if (restaurant?.owner.toString() === context.user!.userId) return;
  }
  throw new AuthorizationError();
};

export interface OrderItemInput {
  food: string;
  variation: string;
  addons?: Array<{ _id: string; options: string[] }>;
  quantity: number;
  specialInstructions?: string;
}

export interface OrderInput {
  restaurant: string;
  items: OrderItemInput[];
  deliveryAddress: {
    label: string;
    deliveryAddress: string;
    details?: string;
    latitude: number;
    longitude: number;
  };
  paymentMethod: string;
  orderAmount: number;
  deliveryCharges: number;
  tipping?: number;
  taxationAmount?: number;
  discount?: number;
  total: number;
}

export const orderResolvers = {
  Query: {
    myOrders: async (
      _: any,
      { page = 1, limit = 10 }: { page?: number; limit?: number },
      context: AuthContext
    ) => {
      requireAuth(context);

      const skip = (page - 1) * limit;

      const [orders, totalCount] = await Promise.all([
        Order.find({ user: context.user!.userId })
          .populate('restaurant')
          .populate('user')
          .populate('rider')
          .populate({
            path: 'items.food',
            model: 'Food',
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments({ user: context.user!.userId }),
      ]);

      return {
        orders,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },

    order: async (_: any, { id }: { id: string }, context: AuthContext) => {
      requireAuth(context);

      const order = await Order.findById(id)
        .populate('restaurant')
        .populate('user')
        .populate('rider')
        .populate({
          path: 'items.food',
          model: 'Food',
        });

      if (!order) {
        throw new NotFoundError('Order');
      }

      // Check if user has access to this order
      const restaurant = await Restaurant.findById(order.restaurant);
      if (
        context.user!.role !== 'ADMIN' &&
        order.user._id.toString() !== context.user!.userId &&
        restaurant && restaurant.owner.toString() !== context.user!.userId &&
        (!order.rider || order.rider._id.toString() !== context.user!.userId)
      ) {
        throw new AuthorizationError();
      }

      return order;
    },

    getActiveOrders: async (
      _: any,
      {
        restaurantId,
        page = 1,
        limit = 10,
        status,
      }: { restaurantId?: string; page?: number; limit?: number; status?: string },
      context: AuthContext
    ) => {
      requireAuth(context);

      const skip = (page - 1) * limit;

      const query: any = {
        orderStatus: { $nin: ['COMPLETED', 'CANCELLED'] },
      };
      if (context.user!.role === 'USER') throw new AuthorizationError();
      if (context.user!.role === 'RIDER') query.rider = context.user!.userId;
      if (context.user!.role === 'VENDOR') {
        const stores = await Restaurant.find({ owner: context.user!.userId, isActive: true }).select('_id');
        const storeIds = stores.map((store) => store._id.toString());
        if (restaurantId && !storeIds.includes(restaurantId)) throw new AuthorizationError();
        query.restaurant = restaurantId || { $in: storeIds };
      } else if (restaurantId) {
        query.restaurant = restaurantId;
      }

      if (status) {
        query.orderStatus = status;
      }

      const [orders, totalCount] = await Promise.all([
        Order.find(query)
          .populate('restaurant')
          .populate('user')
          .populate('rider')
          .populate({
            path: 'items.food',
            model: 'Food',
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments(query),
      ]);

      return {
        orders,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },

    ordersByRestId: async (
      _: any,
      {
        restaurant,
        page = 1,
        limit = 10,
        status,
      }: { restaurant: string; page?: number; limit?: number; status?: string },
      context: AuthContext
    ) => {
      requireAuth(context);

      const skip = (page - 1) * limit;

      const query: any = { restaurant };
      if (!['VENDOR', 'ADMIN'].includes(context.user!.role)) throw new AuthorizationError();
      if (context.user!.role === 'VENDOR') {
        const store = await Restaurant.findOne({ _id: restaurant, owner: context.user!.userId });
        if (!store) throw new AuthorizationError();
      }
      if (status) {
        query.orderStatus = status;
      }

      const [orders, totalCount] = await Promise.all([
        Order.find(query)
          .populate('restaurant')
          .populate('user')
          .populate('rider')
          .populate({
            path: 'items.food',
            model: 'Food',
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments(query),
      ]);

      return {
        orders,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    },
  },

  Mutation: {
    placeOrder: async (
      _: any,
      { orderInput }: { orderInput: OrderInput },
      context: AuthContext
    ) => {
      requireAuth(context);

      // Validate restaurant
      const restaurant = await Restaurant.findById(orderInput.restaurant);
      if (!restaurant || !restaurant.isActive || !restaurant.isAvailable) {
        throw new ValidationError('Restaurant is not available');
      }

      if (!orderInput.items.length) throw new ValidationError('Order must contain at least one item');

      const items: any[] = [];
      let orderAmount = 0;
      for (const item of orderInput.items) {
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          throw new ValidationError('Item quantity must be a positive integer');
        }
        const food = await Food.findById(item.food).populate('variations.addons');
        if (!food || !food.isActive || !food.isAvailable || food.restaurant.toString() !== orderInput.restaurant) {
          throw new ValidationError(`Food item ${item.food} is not available at this restaurant`);
        }
        const variation = food.variations.find((entry) => entry._id?.toString() === item.variation);
        if (!variation) throw new ValidationError(`Invalid variation for ${food.title}`);

        const addons: any[] = [];
        let addonsPrice = 0;
        for (const requestedAddon of item.addons || []) {
          const allowed = variation.addons?.some((addon: any) => addon._id.toString() === requestedAddon._id);
          const addon: any = allowed ? await Addon.findOne({ _id: requestedAddon._id, isActive: true }) : null;
          if (!addon) throw new ValidationError(`Invalid addon for ${food.title}`);
          const options = addon.options.filter((option: any) => requestedAddon.options.includes(option._id.toString()));
          if (options.length !== new Set(requestedAddon.options).size) {
            throw new ValidationError(`Invalid addon option for ${food.title}`);
          }
          if (options.length < addon.quantityMinimum || options.length > addon.quantityMaximum) {
            throw new ValidationError(`Invalid number of options for ${addon.title}`);
          }
          addonsPrice += options.reduce((sum: number, option: any) => sum + option.price, 0);
          addons.push({ _id: addon._id, title: addon.title, options });
        }

        const unitPrice = (variation.discounted > 0 ? variation.discounted : variation.price) + addonsPrice;
        orderAmount += unitPrice * item.quantity;
        items.push({
          food: food._id,
          variation: { _id: variation._id, title: variation.title, price: unitPrice - addonsPrice },
          addons,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
        });
      }

      if (orderAmount < restaurant.minimumOrder) {
        throw new ValidationError(`Minimum order amount is ${restaurant.minimumOrder}`);
      }
      const deliveryCharges = restaurant.deliveryFee;
      const tipping = Math.max(0, orderInput.tipping || 0);
      const taxationAmount = (orderAmount * restaurant.salesTax) / 100;
      const discount = Math.min(Math.max(0, orderInput.discount || 0), orderAmount);
      const total = Math.max(0, orderAmount + deliveryCharges + tipping + taxationAmount - discount);
      const orderId = generateOrderId(restaurant.orderPrefix);

      const order: any = await Order.create({
        orderId,
        restaurant: orderInput.restaurant,
        user: context.user!.userId,
        items,
        deliveryAddress: {
          label: orderInput.deliveryAddress.label,
          deliveryAddress: orderInput.deliveryAddress.deliveryAddress,
          details: orderInput.deliveryAddress.details || '',
          location: {
            latitude: orderInput.deliveryAddress.latitude,
            longitude: orderInput.deliveryAddress.longitude,
          },
        },
        orderAmount,
        deliveryCharges,
        tipping,
        taxationAmount,
        discount,
        total,
        paymentMethod: orderInput.paymentMethod.toUpperCase(),
        orderStatus: 'AWAITING_ADMIN',
        paymentStatus: 'PENDING',
        paidAmount: 0,
        estimatedDeliveryTime: new Date(Date.now() + restaurant.deliveryTime * 60 * 1000),
      } as any);

      const populatedOrder = await populateOrder(order._id);

      // Publish order event
      pubsub.publish('ORDER_PLACED_' + orderInput.restaurant, {
        subscribePlaceOrder: populatedOrder,
      });

      return populatedOrder;
    },

    updateOrderStatus: async (
      _: any,
      { id, status, reason }: { id: string; status: string; reason?: string },
      context: AuthContext
    ) => {
      requireAuth(context);
      status = status.toUpperCase();

      const order = await Order.findById(id);
      if (!order) {
        throw new NotFoundError('Order');
      }
      await ensureOrderManagementAccess(order, context);

      // Update status and relevant timestamps
      order.orderStatus = status as any;
      if (reason) order.reason = reason;

      const now = new Date();
      if (status === 'ACCEPTED') order.acceptedAt = now;
      if (status === 'PICKED') order.pickedAt = now;
      if (status === 'DELIVERED') order.deliveredAt = now;
      if (status === 'COMPLETED') order.completedAt = now;
      if (status === 'CANCELLED') order.cancelledAt = now;
      if ((status === 'DELIVERED' || status === 'COMPLETED') && order.paymentMethod === 'COD') {
        order.paymentStatus = 'PAID';
        order.paidAmount = order.total;
      }

      await order.save();

      const populatedOrder = await populateOrder(order._id);
      publishOrderUpdate(populatedOrder);

      return populatedOrder;
    },

    assignRider: async (
      _: any,
      { orderId, riderId }: { orderId: string; riderId: string },
      context: AuthContext
    ) => {
      requireAuth(context);

      const order = await Order.findById(orderId);
      if (!order) {
        throw new NotFoundError('Order');
      }
      await ensureOrderManagementAccess(order, context);
      if (context.user!.role === 'RIDER') throw new AuthorizationError();

      const rider = await User.findById(riderId);
      if (!rider || rider.role !== 'RIDER') {
        throw new ValidationError('Invalid rider');
      }

      order.rider = rider._id as any;
      order.orderStatus = 'ASSIGNED';
      order.riderAssignedAt = new Date();
      await order.save();

      const populatedOrder = await populateOrder(order._id);
      publishOrderUpdate(populatedOrder);

      return populatedOrder;
    },

    cancelOrder: async (
      _: any,
      { id, reason }: { id: string; reason: string },
      context: AuthContext
    ) => {
      requireAuth(context);

      const order = await Order.findById(id);
      if (!order) {
        throw new NotFoundError('Order');
      }

      // Check if user can cancel
      if (
        context.user!.role !== 'ADMIN' &&
        order.user.toString() !== context.user!.userId
      ) {
        throw new AuthorizationError();
      }

      order.orderStatus = 'CANCELLED';
      order.reason = reason;
      order.cancelledAt = new Date();
      await order.save();

      const populatedOrder = await populateOrder(order._id);
      publishOrderUpdate(populatedOrder);

      return populatedOrder;
    },

    reviewOrder: async (
      _: any,
      { id, rating, description }: { id: string; rating: number; description?: string },
      context: AuthContext
    ) => {
      requireAuth(context);

      const order = await Order.findById(id);
      if (!order) {
        throw new NotFoundError('Order');
      }

      // Check if user is the order owner
      if (order.user.toString() !== context.user!.userId) {
        throw new AuthorizationError();
      }

      // Check if order is completed
      if (order.orderStatus !== 'COMPLETED' && order.orderStatus !== 'DELIVERED') {
        throw new ValidationError('Order must be completed before review');
      }

      // Check if already reviewed
      if (order.isReviewed) {
        throw new ValidationError('Order already reviewed');
      }

      // Add review
      order.review = {
        rating,
        description: description || '',
        createdAt: new Date(),
      };
      order.isReviewed = true;
      await order.save();

      // Update restaurant rating
      const restaurant = await Restaurant.findById(order.restaurant);
      if (restaurant) {
        restaurant.reviewSum += rating;
        restaurant.reviewCount += 1;
        restaurant.rating = restaurant.reviewSum / restaurant.reviewCount;
        await restaurant.save();
      }

      return await Order.findById(order._id)
        .populate('restaurant')
        .populate('user')
        .populate('rider')
        .populate({
          path: 'items.food',
          model: 'Food',
        });
    },
  },

  Subscription: {
    subscribePlaceOrder: {
      subscribe: async (_: any, { restaurant }: { restaurant: string }, context: AuthContext) => {
        requireAuth(context);
        const store = await Restaurant.findById(restaurant);
        if (!store) throw new NotFoundError('Restaurant');
        if (context.user!.role !== 'ADMIN' && store.owner.toString() !== context.user!.userId) {
          throw new AuthorizationError();
        }
        return pubsub.asyncIterableIterator(['ORDER_PLACED_' + restaurant]);
      },
    },
    subscriptionOrder: {
      subscribe: async (_: any, { id }: { id: string }, context: AuthContext) => {
        requireAuth(context);
        const existing = await Order.findById(id).populate('restaurant');
        if (!existing) throw new NotFoundError('Order');
        const ownerId = (existing.restaurant as any).owner?.toString();
        if (
          context.user!.role !== 'ADMIN' &&
          existing.user.toString() !== context.user!.userId &&
          ownerId !== context.user!.userId &&
          existing.rider?.toString() !== context.user!.userId
        ) {
          throw new AuthorizationError();
        }
        return pubsub.asyncIterableIterator(['ORDER_STATUS_' + id]);
      },
    },
    orderStatusChanged: {
      subscribe: (_: any, { userId }: { userId: string }, context: AuthContext) => {
        requireAuth(context);
        if (context.user!.role !== 'ADMIN' && context.user!.userId !== userId) {
          throw new AuthorizationError();
        }
        return pubsub.asyncIterableIterator(['ORDER_STATUS_USER_' + userId]);
      },
    },
  },
};

export { pubsub };
