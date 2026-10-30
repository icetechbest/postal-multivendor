import { Addon } from '../../models/Addon';
import { Category } from '../../models/Category';
import { Food } from '../../models/Food';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { Review } from '../../models/Review';
import { User } from '../../models/User';
import { Zone } from '../../models/Zone';
import { Address } from '../../models/Address';
import { AuthContext } from '../../middleware/auth';
import config from '../../config';
import { getReviewData, idOf } from './appHelpers';

const reference = async (value: any, model: any) => {
  if (!value) return null;
  if (value._id) return value;
  return model.findById(value);
};

const adminValue = (parent: any, field: string, context: AuthContext) =>
  context.user?.role === 'ADMIN' ? parent[field] ?? null : null;

const restaurantShared = {
  orderId: (parent: any) => parent.orderId || idOf(parent._id),
  tax: (parent: any) => parent.tax ?? parent.salesTax ?? 0,
  reviewAverage: (parent: any) => parent.reviewAverage ?? parent.rating ?? 0,
  password: () => null,
  stripeDetailsSubmitted: (parent: any) => Boolean(parent.stripeDetailsSubmitted),
  enableNotification: (parent: any) => parent.enableNotification !== false,
  freeDelivery: (parent: any) => Boolean(parent.freeDelivery),
  acceptVouchers: (parent: any) => Boolean(parent.acceptVouchers),
  distanceWithCurrentLocation: (parent: any) => parent.distanceWithCurrentLocation ?? null,
};

export const appFieldResolvers: Record<string, any> = {
  User: {
    id: (parent: any) => idOf(parent._id || parent.id),
    userType: (parent: any) => parent.socialProvider || (parent.role === 'USER' ? 'email' : parent.role),
    phoneIsVerified: (parent: any) => parent.phoneIsVerified ?? parent.phoneVerified ?? false,
    emailIsVerified: (parent: any) => parent.emailIsVerified ?? parent.emailVerified ?? false,
    available: (parent: any) => parent.available ?? parent.isAvailable ?? false,
    image: (parent: any) => parent.image || parent.avatar || null,
    favourite: (parent: any) => (parent.favouriteRestaurants || parent.favourite || []).map(idOf),
    password: () => null,
    addresses: async (parent: any) => {
      if (!parent.addresses?.length) return [];
      if (parent.addresses[0]?._id) return parent.addresses;
      return Address.find({ _id: { $in: parent.addresses } });
    },
    favouriteRestaurants: async (parent: any) => {
      const values = parent.favouriteRestaurants || [];
      if (!values.length) return [];
      if (values[0]?._id) return values;
      return Restaurant.find({ _id: { $in: values }, isActive: true });
    },
    zone: async (parent: any) => parent.zone?._id ? parent.zone : parent.zone ? Zone.findById(parent.zone) : null,
  },
  Address: {
    id: (parent: any) => idOf(parent._id || parent.id),
    selected: (parent: any) => parent.selected ?? parent.isSelected ?? false,
  },
  Restaurant: {
    ...restaurantShared,
    owner: async (parent: any) => reference(parent.owner, User),
    zone: async (parent: any) => parent.zone?._id ? parent.zone : parent.zone ? Zone.findById(parent.zone) : null,
    categories: async (parent: any) => {
      if (parent.categories?.length && parent.categories[0]?._id) return parent.categories;
      if (parent.categories?.length) return Category.find({ _id: { $in: parent.categories }, isActive: true });
      return Category.find({ restaurant: idOf(parent._id), isActive: true }).sort({ title: 1 });
    },
    addons: async (parent: any) => {
      const foods = await Food.find({ restaurant: idOf(parent._id), isActive: true }).select('variations.addons');
      const ids = Array.from(new Set(foods.flatMap((food) => food.variations.flatMap((variation) => (variation.addons || []).map(idOf)))));
      return ids.length ? Addon.find({ _id: { $in: ids }, isActive: true }) : [];
    },
    options: async (parent: any) => {
      const foods = await Food.find({ restaurant: idOf(parent._id), isActive: true }).select('variations.addons');
      const ids = Array.from(new Set(foods.flatMap((food) => food.variations.flatMap((variation) => (variation.addons || []).map(idOf)))));
      const addons = ids.length ? await Addon.find({ _id: { $in: ids }, isActive: true }) : [];
      const seen = new Set<string>();
      return addons.flatMap((addon) => addon.options).filter((option) => {
        const id = idOf(option._id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    },
    reviewData: (parent: any) => getReviewData(idOf(parent._id)),
  },
  RestaurantPreview: restaurantShared,
  Category: {
    id: (parent: any) => idOf(parent._id || parent.id),
    foods: async (parent: any) => Food.find({ category: idOf(parent._id), isActive: true }).sort({ isPopular: -1, orderCount: -1, title: 1 }),
  },
  Food: {
    id: (parent: any) => idOf(parent._id || parent.id),
    isOutOfStock: (parent: any) => parent.isOutOfStock ?? !parent.isAvailable,
    restaurant: async (parent: any) => reference(parent.restaurant, Restaurant),
    category: async (parent: any) => reference(parent.category, Category),
  },
  Variation: {
    id: (parent: any) => idOf(parent._id || parent.id),
    addons: (parent: any) => (parent.addons || []).map(idOf),
    isOutOfStock: (parent: any) => Boolean(parent.isOutOfStock),
  },
  Order: {
    id: (parent: any) => idOf(parent._id || parent.id),
    status: (parent: any) => parent.status || parent.orderStatus,
    isActive: (parent: any) => parent.isActive !== false,
    restaurant: async (parent: any) => reference(parent.restaurant, Restaurant),
    user: async (parent: any) => reference(parent.user, User),
    rider: async (parent: any) => reference(parent.rider, User),
    review: async (parent: any) => reference(parent.review, Review),
    assignedAt: (parent: any) => parent.assignedAt || parent.riderAssignedAt || null,
    expectedTime: (parent: any) => parent.expectedTime || parent.estimatedDeliveryTime || null,
    completionTime: (parent: any) => parent.completionTime || parent.completedAt || null,
    isRinged: (parent: any) => Boolean(parent.isRinged),
    isRiderRinged: (parent: any) => Boolean(parent.isRiderRinged),
  },
  OrderItem: {
    id: (parent: any) => idOf(parent._id || parent.id),
    food: (parent: any) => idOf(parent.food),
  },
  Review: {
    order: async (parent: any) => reference(parent.order, Order),
    restaurant: async (parent: any) => reference(parent.restaurant, Restaurant),
  },
  Coupon: {
    title: (parent: any) => parent.title || parent.code,
    enabled: (parent: any) => parent.enabled ?? parent.isEnabled ?? false,
  },
  Configuration: {
    password: (parent: any, _args: unknown, context: AuthContext) => adminValue(parent, 'password', context),
    clientSecret: (parent: any, _args: unknown, context: AuthContext) => adminValue(parent, 'clientSecret', context),
    secretKey: (parent: any, _args: unknown, context: AuthContext) => adminValue(parent, 'secretKey', context),
    twilioAuthToken: (parent: any, _args: unknown, context: AuthContext) => adminValue(parent, 'twilioAuthToken', context),
    firebaseKey: (parent: any, _args: unknown, context: AuthContext) => adminValue(parent, 'firebaseKey', context),
    testOtp: (parent: any) => config.env === 'production' ? null : parent.testOtp ?? null,
  },
};
