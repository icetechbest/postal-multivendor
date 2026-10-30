import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { AuthContext, requireAuth } from '../../middleware/auth';
import { pubsub } from '../../services/pubsub';
import { AuthorizationError, NotFoundError } from '../../utils/errors';
import { ensureOrderAccess, idOf } from './appHelpers';

export const appSubscriptionResolvers = {
  subscribePlaceOrder: {
    subscribe: async (_parent: unknown, { restaurant }: { restaurant: string }, context: AuthContext) => {
      requireAuth(context);
      const store = await Restaurant.findById(restaurant);
      if (!store) throw new NotFoundError('Restaurant');
      if (context.user!.role !== 'ADMIN' && idOf(store.owner) !== context.user!.userId) throw new AuthorizationError();
      return pubsub.asyncIterableIterator([`ORDER_PLACED_${restaurant}`]);
    },
  },
  subscriptionOrder: {
    subscribe: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      const order = await Order.findById(id);
      if (!order) throw new NotFoundError('Order');
      await ensureOrderAccess(order, context);
      return pubsub.asyncIterableIterator([`ORDER_STATUS_${id}`]);
    },
  },
  orderStatusChanged: {
    subscribe: (_parent: unknown, { userId }: { userId: string }, context: AuthContext) => {
      requireAuth(context);
      if (context.user!.role !== 'ADMIN' && context.user!.userId !== userId) throw new AuthorizationError();
      return pubsub.asyncIterableIterator([`ORDER_STATUS_USER_${userId}`]);
    },
  },
  subscriptionRiderLocation: {
    subscribe: (_parent: unknown, { riderId }: { riderId: string }, context: AuthContext) => {
      requireAuth(context);
      return pubsub.asyncIterableIterator([`RIDER_LOCATION_${riderId}`]);
    },
  },
  subscriptionNewMessage: {
    subscribe: async (_parent: unknown, { order }: { order: string }, context: AuthContext) => {
      const existing = await Order.findById(order);
      if (!existing) throw new NotFoundError('Order');
      await ensureOrderAccess(existing, context);
      return pubsub.asyncIterableIterator([`CHAT_${order}`]);
    },
  },
};
