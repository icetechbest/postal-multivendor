import { Addon } from '../../models/Addon';
import { Category } from '../../models/Category';
import { Coupon } from '../../models/Coupon';
import { Food } from '../../models/Food';
import { Restaurant } from '../../models/Restaurant';
import { Zone } from '../../models/Zone';
import { AuthContext, requireAdmin, requireAuth, requireVendor } from '../../middleware/auth';
import { AuthorizationError, NotFoundError, ValidationError } from '../../utils/errors';

const ensureRestaurantAccess = async (restaurantId: string, context: AuthContext) => {
  requireVendor(context);
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant || !restaurant.isActive) throw new NotFoundError('Restaurant');
  if (context.user!.role !== 'ADMIN' && restaurant.owner.toString() !== context.user!.userId) {
    throw new AuthorizationError();
  }
  return restaurant;
};

const activeOnly = { isActive: true };

export const catalogResolvers = {
  Query: {
    food: async (_: unknown, { restaurant }: { restaurant: string }) =>
      Food.find({ restaurant, ...activeOnly })
        .populate('restaurant')
        .populate('category')
        .populate('variations.addons')
        .sort({ createdAt: -1 }),

    categories: async () => Category.find(activeOnly).sort({ title: 1 }),

    popularFoodItems: async (
      _: unknown,
      { latitude, longitude }: { latitude: number; longitude: number }
    ) => {
      const restaurants = await Restaurant.find({
        ...activeOnly,
        isAvailable: true,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: 50000,
          },
        },
      }).select('_id');
      return Food.find({
        restaurant: { $in: restaurants.map((restaurant) => restaurant._id) },
        ...activeOnly,
        isAvailable: true,
      })
        .populate('restaurant')
        .populate('category')
        .populate('variations.addons')
        .sort({ isPopular: -1, orderCount: -1 })
        .limit(30);
    },

    addons: async () => Addon.find(activeOnly).sort({ title: 1 }),
    zones: async () => Zone.find(activeOnly).sort({ title: 1 }),
    zone: async (_: unknown, { id }: { id: string }) => Zone.findOne({ _id: id, ...activeOnly }),
    coupons: async () => Coupon.find(activeOnly).populate('restaurant').sort({ createdAt: -1 }),
  },

  Mutation: {
    createFood: async (_: unknown, { foodInput }: any, context: AuthContext) => {
      await ensureRestaurantAccess(foodInput.restaurant, context);
      if (!foodInput.variations?.length) throw new ValidationError('At least one variation is required');
      return (await Food.create(foodInput)).populate('restaurant category variations.addons');
    },

    editFood: async (_: unknown, { foodInput }: any, context: AuthContext) => {
      const food = await Food.findById(foodInput._id);
      if (!food || !food.isActive) throw new NotFoundError('Food');
      await ensureRestaurantAccess(food.restaurant.toString(), context);
      const { _id, ...updates } = foodInput;
      return Food.findByIdAndUpdate(_id, { $set: updates }, { new: true, runValidators: true }).populate(
        'restaurant category variations.addons'
      );
    },

    deleteFood: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      const food = await Food.findById(id);
      if (!food || !food.isActive) throw new NotFoundError('Food');
      await ensureRestaurantAccess(food.restaurant.toString(), context);
      food.isActive = false;
      food.isAvailable = false;
      await food.save();
      return { message: 'Food deleted successfully' };
    },

    updateFoodOutOfStock: async (
      _: unknown,
      { id, isAvailable }: { id: string; isAvailable: boolean },
      context: AuthContext
    ) => {
      const food = await Food.findById(id);
      if (!food || !food.isActive) throw new NotFoundError('Food');
      await ensureRestaurantAccess(food.restaurant.toString(), context);
      food.isAvailable = isAvailable;
      await food.save();
      return food.populate('restaurant category variations.addons');
    },

    createCategory: async (_: unknown, { categoryInput }: any, context: AuthContext) => {
      requireVendor(context);
      return Category.create(categoryInput);
    },

    editCategory: async (_: unknown, { categoryInput }: any, context: AuthContext) => {
      requireVendor(context);
      const { _id, ...updates } = categoryInput;
      const category = await Category.findOneAndUpdate(
        { _id, ...activeOnly },
        { $set: updates },
        { new: true, runValidators: true }
      );
      if (!category) throw new NotFoundError('Category');
      return category;
    },

    deleteCategory: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireVendor(context);
      const category = await Category.findOneAndUpdate({ _id: id, ...activeOnly }, { isActive: false }, { new: true });
      if (!category) throw new NotFoundError('Category');
      await Food.updateMany({ category: id }, { $set: { isActive: false, isAvailable: false } });
      return { message: 'Category deleted successfully' };
    },

    createAddons: async (_: unknown, { addonInput }: any, context: AuthContext) => {
      requireVendor(context);
      if (addonInput.quantityMaximum < addonInput.quantityMinimum) {
        throw new ValidationError('Maximum quantity must be greater than or equal to minimum quantity');
      }
      return Addon.create(addonInput);
    },

    editAddons: async (_: unknown, { addonInput }: any, context: AuthContext) => {
      requireVendor(context);
      const { _id, ...updates } = addonInput;
      const addon = await Addon.findOneAndUpdate(
        { _id, ...activeOnly },
        { $set: updates },
        { new: true, runValidators: true }
      );
      if (!addon) throw new NotFoundError('Addon');
      return addon;
    },

    deleteAddons: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireVendor(context);
      const addon = await Addon.findOneAndUpdate({ _id: id, ...activeOnly }, { isActive: false }, { new: true });
      if (!addon) throw new NotFoundError('Addon');
      return { message: 'Addon deleted successfully' };
    },

    createCoupon: async (_: unknown, { couponInput }: any, context: AuthContext) => {
      requireVendor(context);
      if (couponInput.restaurant) await ensureRestaurantAccess(couponInput.restaurant, context);
      const coupon = await Coupon.create({ ...couponInput, code: couponInput.code.toUpperCase() });
      return coupon.populate('restaurant');
    },

    editCoupon: async (_: unknown, { couponInput }: any, context: AuthContext) => {
      requireVendor(context);
      const { _id, ...updates } = couponInput;
      const existing = await Coupon.findById(_id);
      if (!existing || !existing.isActive) throw new NotFoundError('Coupon');
      if (existing.restaurant) await ensureRestaurantAccess(existing.restaurant.toString(), context);
      if (updates.code) updates.code = updates.code.toUpperCase();
      return Coupon.findByIdAndUpdate(_id, { $set: updates }, { new: true, runValidators: true }).populate('restaurant');
    },

    deleteCoupon: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireVendor(context);
      const coupon = await Coupon.findById(id);
      if (!coupon || !coupon.isActive) throw new NotFoundError('Coupon');
      if (coupon.restaurant) await ensureRestaurantAccess(coupon.restaurant.toString(), context);
      coupon.isActive = false;
      coupon.isEnabled = false;
      await coupon.save();
      return { message: 'Coupon deleted successfully' };
    },

    applyCoupon: async (_: unknown, { code, restaurant }: { code: string; restaurant?: string }, context: AuthContext) => {
      requireAuth(context);
      const coupon = await Coupon.findOne({ code: code.trim().toUpperCase(), isActive: true, isEnabled: true }).populate(
        'restaurant'
      );
      if (!coupon) throw new ValidationError('Coupon is invalid or expired');
      if (coupon.restaurant && coupon.restaurant._id.toString() !== restaurant) {
        throw new ValidationError('Coupon is not valid for this restaurant');
      }
      return coupon;
    },

    createZone: async (_: unknown, { zoneInput }: any, context: AuthContext) => {
      requireAdmin(context);
      const { coordinates, ...data } = zoneInput;
      return Zone.create({ ...data, location: { type: 'Polygon', coordinates } });
    },

    editZone: async (_: unknown, { zoneInput }: any, context: AuthContext) => {
      requireAdmin(context);
      const { _id, coordinates, ...updates } = zoneInput;
      if (coordinates) updates.location = { type: 'Polygon', coordinates };
      const zone = await Zone.findOneAndUpdate(
        { _id, ...activeOnly },
        { $set: updates },
        { new: true, runValidators: true }
      );
      if (!zone) throw new NotFoundError('Zone');
      return zone;
    },

    deleteZone: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireAdmin(context);
      const zone = await Zone.findOneAndUpdate({ _id: id, ...activeOnly }, { isActive: false }, { new: true });
      if (!zone) throw new NotFoundError('Zone');
      await Restaurant.updateMany({ zone: id }, { $unset: { zone: 1 } });
      return { message: 'Zone deleted successfully' };
    },
  },
};
