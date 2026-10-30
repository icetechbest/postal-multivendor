import { Types } from 'mongoose';
import { Banner } from '../../models/Banner';
import { Category } from '../../models/Category';
import { ChatMessage } from '../../models/ChatMessage';
import { Configuration } from '../../models/Configuration';
import { Country } from '../../models/Country';
import { Cuisine } from '../../models/Cuisine';
import { Food } from '../../models/Food';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { SubCategory } from '../../models/SubCategory';
import { Taxation } from '../../models/Taxation';
import { Tipping } from '../../models/Tipping';
import { User } from '../../models/User';
import { Version } from '../../models/Version';
import { Zone } from '../../models/Zone';
import { AuthContext, requireAuth } from '../../middleware/auth';
import { NotFoundError } from '../../utils/errors';
import { ensureOrderAccess, findNearbyRestaurants, getReviewData, getUser, idOf, restaurantList } from './appHelpers';

const configuration = async () => Configuration.findOne({ key: 'default' });
const sortedByRating = (restaurants: any[]) => restaurants.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));

export const appQueryResolvers: Record<string, (...args: any[]) => any> = {
  profile: async (_parent: unknown, _args: unknown, context: AuthContext) => {
    requireAuth(context);
    return getUser(context.user!.userId);
  },
  configuration,
  getConfiguration: configuration,
  taxes: async () => Taxation.find().sort({ createdAt: 1 }),
  getTaxation: async () => Taxation.findOne().sort({ createdAt: 1 }),
  tips: async () => Tipping.find().sort({ createdAt: 1 }),
  getTipping: async () => Tipping.findOne().sort({ createdAt: 1 }),
  zones: async () => Zone.find({ isActive: true }).sort({ title: 1 }),
  restaurant: async (_parent: unknown, { id }: { id?: string }) => {
    if (!id) return null;
    const restaurant = await Restaurant.findOne({ _id: id, isActive: true }).populate('owner').populate('categories').populate('zone');
    if (!restaurant) throw new NotFoundError('Restaurant');
    return restaurant;
  },
  nearByRestaurants: async (_parent: unknown, args: { latitude?: number; longitude?: number; shopType?: string; limit?: number }) => {
    const restaurants = await findNearbyRestaurants(args.latitude, args.longitude, args.shopType, args.limit);
    return restaurantList(restaurants);
  },
  nearByRestaurantsPreview: async (_parent: unknown, args: { latitude?: number; longitude?: number; shopType?: string }) => {
    const restaurants = await findNearbyRestaurants(args.latitude, args.longitude, args.shopType);
    return restaurantList(restaurants);
  },
  topRatedVendors: async (_parent: unknown, args: { latitude?: number; longitude?: number; limit?: number }) =>
    sortedByRating(await findNearbyRestaurants(args.latitude, args.longitude)).slice(0, args.limit || 10),
  topRatedVendorsPreview: async (_parent: unknown, args: { latitude: number; longitude: number }) =>
    sortedByRating(await findNearbyRestaurants(args.latitude, args.longitude)).slice(0, 10),
  recentOrderRestaurants: async (_parent: unknown, args: { latitude: number; longitude: number }, context: AuthContext) => {
    if (!context.user) return [];
    const orders = await Order.find({ user: context.user.userId }).sort({ createdAt: -1 }).limit(50).select('restaurant');
    const ids = Array.from(new Set(orders.map((order) => idOf(order.restaurant))));
    const nearby = await findNearbyRestaurants(args.latitude, args.longitude);
    return ids.map((id) => nearby.find((restaurant) => idOf(restaurant._id) === id)).filter(Boolean).slice(0, 10);
  },
  recentOrderRestaurantsPreview: async (_parent: unknown, args: { latitude: number; longitude: number }, context: AuthContext) =>
    appQueryResolvers.recentOrderRestaurants(_parent, args, context),
  mostOrderedRestaurants: async (_parent: unknown, args: { latitude: number; longitude: number; shopType?: string }) => {
    const grouped = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'CANCELLED' } } },
      { $group: { _id: '$restaurant', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]);
    const nearby = await findNearbyRestaurants(args.latitude, args.longitude, args.shopType);
    return grouped.map((entry) => nearby.find((restaurant) => idOf(restaurant._id) === idOf(entry._id))).filter(Boolean).slice(0, 10);
  },
  mostOrderedRestaurantsPreview: async (_parent: unknown, args: { latitude: number; longitude: number; shopType?: string }) =>
    appQueryResolvers.mostOrderedRestaurants(_parent, args),
  userFavourite: async (_parent: unknown, _args: unknown, context: AuthContext) => {
    requireAuth(context);
    const user = await User.findById(context.user!.userId).populate('favouriteRestaurants');
    return (user?.favouriteRestaurants || []).filter((restaurant: any) => restaurant.isActive);
  },
  orders: async (_parent: unknown, { offset = 0 }: { offset?: number }, context: AuthContext) => {
    requireAuth(context);
    return Order.find({ user: context.user!.userId, isActive: { $ne: false } })
      .populate('restaurant').populate('user').populate('rider').populate('review')
      .sort({ createdAt: -1 }).skip(Math.max(0, offset)).limit(10);
  },
  order: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
    const order = await Order.findById(id).populate('restaurant').populate('user').populate('rider').populate('review');
    if (!order) throw new NotFoundError('Order');
    await ensureOrderAccess(order, context);
    return order;
  },
  rider: async (_parent: unknown, { id }: { id?: string }, context: AuthContext) => {
    requireAuth(context);
    if (!id) return null;
    return User.findOne({ _id: id, role: 'RIDER', isActive: true });
  },
  cuisines: async () => Cuisine.find({ isActive: true }).sort({ name: 1 }),
  banners: async () => Banner.find({ isActive: true }).sort({ createdAt: -1 }),
  getVersions: async () => Version.findOne({ key: 'default' }),
  subCategories: async () => SubCategory.find({ isActive: true }).sort({ title: 1 }),
  subCategoriesByParentId: async (_parent: unknown, { parentCategoryId }: { parentCategoryId: string }) =>
    SubCategory.find({ parentCategoryId, isActive: true }).sort({ title: 1 }),
  reviewsByRestaurant: async (_parent: unknown, { restaurant }: { restaurant: string }) => getReviewData(restaurant),
  getCountryByIso: async (_parent: unknown, { iso }: { iso: string }) => Country.findOne({ iso: iso.toUpperCase() }),
  chat: async (_parent: unknown, { order }: { order: string }, context: AuthContext) => {
    const existing = await Order.findById(order);
    if (!existing) throw new NotFoundError('Order');
    await ensureOrderAccess(existing, context);
    return ChatMessage.find({ order }).sort({ createdAt: 1 }).limit(500);
  },
  fetchCategoryDetailsByStoreIdForMobile: async (_parent: unknown, { storeId }: { storeId: string }) => {
    const categories = await Category.find({ restaurant: storeId, isActive: true }).sort({ title: 1 });
    const result: Array<{ id: string; category_name: string; url: string | null; food_id: string }> = [];
    for (const category of categories) {
      const foods = await Food.find({ category: category._id, isActive: true }).sort({ title: 1 });
      for (const food of foods) result.push({ id: idOf(category._id), category_name: category.title, url: category.image || food.image || null, food_id: idOf(food._id) });
    }
    return result;
  },
  popularFoodItems: async (_parent: unknown, { restaurantId }: { restaurantId: string }) =>
    Food.find({ restaurant: restaurantId, isActive: true, isAvailable: true }).sort({ isPopular: -1, orderCount: -1, createdAt: -1 }).limit(30),
  relatedItems: async (_parent: unknown, { itemId, restaurantId }: { itemId: string; restaurantId: string }) => {
    const food = await Food.findOne({ _id: itemId, restaurant: restaurantId, isActive: true });
    if (!food) return [];
    const related = await Food.find({ _id: { $ne: itemId }, restaurant: restaurantId, category: food.category, isActive: true, isAvailable: true })
      .sort({ isPopular: -1, orderCount: -1 }).limit(10).select('_id');
    return related.map((item) => idOf(item._id));
  },
  popularItems: async (_parent: unknown, { restaurantId }: { restaurantId: string }) => {
    const items = await Order.aggregate([
      { $match: { restaurant: new Types.ObjectId(restaurantId), orderStatus: { $ne: 'CANCELLED' } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.food', count: { $sum: '$items.quantity' } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    return items.map((item) => ({ id: idOf(item._id), count: item.count }));
  },
};
