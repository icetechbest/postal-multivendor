import { Types } from 'mongoose';
import { Addon } from '../../models/Addon';
import { Banner } from '../../models/Banner';
import { Category } from '../../models/Category';
import { Coupon } from '../../models/Coupon';
import { Cuisine } from '../../models/Cuisine';
import { Food } from '../../models/Food';
import { RestaurantOption } from '../../models/Option';
import { Restaurant } from '../../models/Restaurant';
import { Review } from '../../models/Review';
import { ShopType } from '../../models/ShopType';
import { SubCategory } from '../../models/SubCategory';
import { Taxation } from '../../models/Taxation';
import { Tipping } from '../../models/Tipping';
import { AuthContext, requireRole } from '../../middleware/auth';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { idOf } from './appHelpers';
import { assertObjectId, audit, cleanId, definedOnly, ensureRestaurantOwner, escapeRegex, pageParams, requireSuperAdmin } from './adminHelpers';

const isDuplicate = (error: any) => error?.code === 11000;
const duplicate = (label: string) => new ValidationError(`${label} already exists`);

const loadRestaurant = async (id: unknown, context: AuthContext) => {
  const restaurant = await Restaurant.findById(assertObjectId(id, 'restaurant')).populate('owner');
  if (!restaurant) throw new NotFoundError('Restaurant');
  ensureRestaurantOwner(restaurant, context);
  return restaurant;
};

/** Embeds a stable snapshot of restaurant-level options (same _id) inside an addon. */
const snapshotOptions = async (restaurantId: string, ids: string[] = []) => {
  const valid = ids.filter((id) => Types.ObjectId.isValid(id));
  const found = valid.length ? await RestaurantOption.find({ _id: { $in: valid }, restaurant: restaurantId, isActive: true }) : [];
  return valid
    .map((id) => found.find((option) => idOf(option._id) === id))
    .filter(Boolean)
    .map((option: any) => ({ _id: option._id, title: option.title, description: option.description, price: option.price }));
};

const addonFields = async (restaurantId: string, input: any) => {
  const fields: Record<string, unknown> = definedOnly({
    title: input.title,
    description: input.description,
    quantityMinimum: input.quantityMinimum,
    quantityMaximum: input.quantityMaximum,
  });
  if (input.options) fields.options = await snapshotOptions(restaurantId, input.options);
  const min = Number(fields.quantityMinimum ?? 0);
  const max = Number(fields.quantityMaximum ?? Math.max(min, 1));
  if (max < min) throw new ValidationError('Maximum quantity must be greater than or equal to minimum quantity');
  return fields;
};

const cleanVariations = (variations: any[] = []) =>
  variations.map((variation) => {
    const { _id, ...rest } = variation;
    const id = cleanId(_id);
    return { ...(id && Types.ObjectId.isValid(id) ? { _id: id } : {}), ...rest, addons: (rest.addons || []).filter((a: string) => Types.ObjectId.isValid(a)) };
  });

const couponFields = (input: any) => {
  const fields: Record<string, any> = definedOnly({
    title: input.title,
    discount: input.discount,
    lifeTimeActive: input.lifeTimeActive,
  });
  const code = input.code || input.title;
  if (code) fields.code = String(code).trim().toUpperCase();
  const enabled = input.enabled ?? input.isEnabled;
  if (enabled !== undefined) fields.isEnabled = enabled;
  if (input.isActive !== undefined) fields.isActive = input.isActive;
  if (input.startDate) fields.startDate = new Date(input.startDate);
  if (input.endDate) fields.endDate = new Date(input.endDate);
  if (input.lifeTimeActive) fields.expiresAt = null;
  else if (input.endDate) fields.expiresAt = new Date(input.endDate);
  return fields;
};

const firstOrCreate = async (model: any) => (await model.findOne().sort({ createdAt: 1 })) || null;

export const adminCatalogResolvers = {
  Query: {
    reviews: async (_parent: unknown, { restaurant }: { restaurant: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      return Review.find({ restaurant: assertObjectId(restaurant, 'restaurant'), isActive: true }).sort({ createdAt: -1 }).limit(500);
    },
    subCategory: async (_parent: unknown, { _id }: { _id?: string }) => (_id && Types.ObjectId.isValid(_id) ? SubCategory.findOne({ _id, isActive: true }) : null),
    fetchShopTypes: async (_parent: unknown, args: { filter?: any; pagination?: any }) => {
      const filter: Record<string, any> = {};
      const search = args.filter?.search || args.filter?.name;
      if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
      if (args.filter?.isActive !== undefined && args.filter?.isActive !== null) filter.isActive = args.filter.isActive;
      const { page, limit, skip } = pageParams(args.pagination?.page, args.pagination?.pageSize ?? args.pagination?.limit, 500);
      const [data, total] = await Promise.all([ShopType.find(filter).sort({ name: 1 }).skip(skip).limit(limit), ShopType.countDocuments(filter)]);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return { data, total, page, pageSize: limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
    },
    fetchShopTypeByUnique: async (_parent: unknown, { dto }: { dto?: { _id?: string; name?: string } }) => {
      if (dto?._id && Types.ObjectId.isValid(dto._id)) return ShopType.findById(dto._id);
      if (dto?.name) return ShopType.findOne({ name: { $regex: `^${escapeRegex(dto.name)}$`, $options: 'i' } });
      return null;
    },
    restaurantCoupons: async (_parent: unknown, { restaurantId }: { restaurantId: string }, context: AuthContext) => {
      await loadRestaurant(restaurantId, context);
      return Coupon.find({ restaurant: restaurantId, isActive: true }).sort({ createdAt: -1 });
    },
  },

  Mutation: {
    // ---------- categories (restaurant scoped)
    createCategory: async (_parent: unknown, args: { category?: any; categoryInput?: any }, context: AuthContext) => {
      const input = args.category || args.categoryInput;
      if (!input?.title?.trim()) throw new ValidationError('Category title is required');
      const restaurant = await loadRestaurant(input.restaurant, context);
      try {
        await Category.create({ title: input.title.trim(), description: input.description, image: input.image, restaurant: restaurant._id });
      } catch (error) {
        if (isDuplicate(error)) throw duplicate('A category with this title');
        throw error;
      }
      return restaurant;
    },
    editCategory: async (_parent: unknown, args: { category?: any; categoryInput?: any }, context: AuthContext) => {
      const input = args.category || args.categoryInput;
      const category = await Category.findOne({ _id: assertObjectId(input?._id, 'category'), isActive: true });
      if (!category) throw new NotFoundError('Category');
      const restaurant = await loadRestaurant(category.restaurant || input.restaurant, context);
      Object.assign(category, definedOnly({ title: input.title?.trim(), description: input.description, image: input.image }));
      try {
        await category.save();
      } catch (error) {
        if (isDuplicate(error)) throw duplicate('A category with this title');
        throw error;
      }
      return restaurant;
    },
    deleteCategory: async (_parent: unknown, { id, restaurant }: { id: string; restaurant?: string }, context: AuthContext) => {
      const category = await Category.findOne({ _id: assertObjectId(id, 'category'), isActive: true });
      if (!category) throw new NotFoundError('Category');
      const owner = await loadRestaurant(category.restaurant || restaurant, context);
      category.isActive = false;
      await category.save();
      await Food.updateMany({ category: category._id }, { $set: { isActive: false, isAvailable: false } });
      return owner;
    },

    // ---------- food
    createFood: async (_parent: unknown, { foodInput }: { foodInput: any }, context: AuthContext) => {
      const restaurant = await loadRestaurant(foodInput.restaurant, context);
      if (!foodInput.variations?.length) throw new ValidationError('At least one variation is required');
      const { _id, ...rest } = foodInput;
      await Food.create({ ...rest, restaurant: restaurant._id, variations: cleanVariations(rest.variations) });
      return restaurant;
    },
    editFood: async (_parent: unknown, { foodInput }: { foodInput: any }, context: AuthContext) => {
      const food = await Food.findOne({ _id: assertObjectId(foodInput._id, 'food'), isActive: true });
      if (!food) throw new NotFoundError('Food');
      const restaurant = await loadRestaurant(food.restaurant, context);
      const { _id, restaurant: _ignored, variations, ...rest } = foodInput;
      Object.assign(food, definedOnly(rest));
      if (variations) food.variations = cleanVariations(variations) as any;
      await food.save();
      return restaurant;
    },
    deleteFood: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      const food = await Food.findOne({ _id: assertObjectId(id, 'food'), isActive: true });
      if (!food) throw new NotFoundError('Food');
      await loadRestaurant(food.restaurant, context);
      food.isActive = false;
      food.isAvailable = false;
      await food.save();
      return food;
    },
    updateFoodOutOfStock: async (_parent: unknown, args: { id: string; isAvailable?: boolean | null }, context: AuthContext) => {
      const food = await Food.findOne({ _id: assertObjectId(args.id, 'food'), isActive: true });
      if (!food) throw new NotFoundError('Food');
      await loadRestaurant(food.restaurant, context);
      const available = args.isAvailable ?? Boolean(food.isOutOfStock);
      food.isAvailable = available;
      food.isOutOfStock = !available;
      await food.save();
      return true;
    },

    // ---------- addons / options (restaurant scoped)
    createAddons: async (_parent: unknown, { addonInput }: { addonInput?: any }, context: AuthContext) => {
      const restaurant = await loadRestaurant(addonInput?.restaurant, context);
      const items = addonInput.addons?.length ? addonInput.addons : addonInput.title ? [addonInput] : [];
      if (!items.length) throw new ValidationError('At least one addon is required');
      for (const item of items) {
        if (!item.title?.trim()) throw new ValidationError('Addon title is required');
        const options = (item.options || []).map((entry: any) => (typeof entry === 'string' ? entry : idOf(entry._id)));
        await Addon.create({ ...(await addonFields(idOf(restaurant._id), { ...item, options })), restaurant: restaurant._id });
      }
      return restaurant;
    },
    editAddon: async (_parent: unknown, { addonInput }: { addonInput?: any }, context: AuthContext) => {
      const restaurant = await loadRestaurant(addonInput?.restaurant, context);
      const item = addonInput.addons;
      const addon = await Addon.findOne({ _id: assertObjectId(item?._id || addonInput._id, 'addon'), restaurant: restaurant._id, isActive: true });
      if (!addon) throw new NotFoundError('Addon');
      Object.assign(addon, await addonFields(idOf(restaurant._id), item));
      await addon.save();
      return restaurant;
    },
    deleteAddon: async (_parent: unknown, { id, restaurant }: { id: string; restaurant: string }, context: AuthContext) => {
      const owner = await loadRestaurant(restaurant, context);
      const addon = await Addon.findOneAndUpdate({ _id: assertObjectId(id, 'addon'), restaurant: owner._id, isActive: true }, { isActive: false }, { new: true });
      if (!addon) throw new NotFoundError('Addon');
      await Food.updateMany({ restaurant: owner._id }, { $pull: { 'variations.$[].addons': addon._id } });
      return owner;
    },
    createOptions: async (_parent: unknown, { optionInput }: { optionInput?: any }, context: AuthContext) => {
      const restaurant = await loadRestaurant(optionInput?.restaurant, context);
      const options = optionInput.options || [];
      if (!options.length) throw new ValidationError('At least one option is required');
      await RestaurantOption.insertMany(options.map((o: any) => ({ restaurant: restaurant._id, title: o.title.trim(), description: o.description, price: o.price })));
      return restaurant;
    },
    editOption: async (_parent: unknown, { optionInput }: { optionInput?: any }, context: AuthContext) => {
      const restaurant = await loadRestaurant(optionInput?.restaurant, context);
      const input = optionInput.options;
      const id = assertObjectId(input?._id || optionInput._id, 'option');
      const option = await RestaurantOption.findOneAndUpdate(
        { _id: id, restaurant: restaurant._id, isActive: true },
        { $set: definedOnly({ title: input.title?.trim(), description: input.description, price: input.price }) },
        { new: true, runValidators: true }
      );
      if (!option) throw new NotFoundError('Option');
      await Addon.updateMany(
        { restaurant: restaurant._id, 'options._id': option._id },
        { $set: { 'options.$[o].title': option.title, 'options.$[o].description': option.description, 'options.$[o].price': option.price } },
        { arrayFilters: [{ 'o._id': option._id }] }
      );
      return restaurant;
    },
    deleteOption: async (_parent: unknown, { id, restaurant }: { id: string; restaurant: string }, context: AuthContext) => {
      const owner = await loadRestaurant(restaurant, context);
      const option = await RestaurantOption.findOneAndUpdate({ _id: assertObjectId(id, 'option'), restaurant: owner._id, isActive: true }, { isActive: false }, { new: true });
      if (!option) throw new NotFoundError('Option');
      await Addon.updateMany({ restaurant: owner._id }, { $pull: { options: { _id: option._id } } });
      return owner;
    },

    // ---------- coupons
    createCoupon: async (_parent: unknown, { couponInput }: { couponInput: any }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'VENDOR']);
      if (couponInput.restaurant) await loadRestaurant(couponInput.restaurant, context);
      else requireSuperAdmin(context);
      const fields = couponFields(couponInput);
      if (!fields.code) throw new ValidationError('Coupon title is required');
      try {
        return await Coupon.create({ ...fields, restaurant: couponInput.restaurant || undefined });
      } catch (error) {
        if (isDuplicate(error)) throw duplicate('A coupon with this code');
        throw error;
      }
    },
    editCoupon: async (_parent: unknown, { couponInput }: { couponInput: any }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'VENDOR']);
      const coupon = await Coupon.findOne({ _id: assertObjectId(couponInput._id, 'coupon'), isActive: true });
      if (!coupon) throw new NotFoundError('Coupon');
      if (coupon.restaurant) await loadRestaurant(coupon.restaurant, context);
      else requireSuperAdmin(context);
      Object.assign(coupon, couponFields(couponInput));
      try {
        await coupon.save();
      } catch (error) {
        if (isDuplicate(error)) throw duplicate('A coupon with this code');
        throw error;
      }
      return coupon;
    },
    deleteCoupon: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'VENDOR']);
      const coupon = await Coupon.findById(assertObjectId(id, 'coupon'));
      if (!coupon) throw new NotFoundError('Coupon');
      if (coupon.restaurant) await loadRestaurant(coupon.restaurant, context);
      else requireSuperAdmin(context);
      await coupon.deleteOne();
      return true;
    },
    createRestaurantCoupon: async (_parent: unknown, { restaurantId, couponInput }: { restaurantId: string; couponInput: any }, context: AuthContext) => {
      const restaurant = await loadRestaurant(restaurantId, context);
      const fields = couponFields(couponInput);
      if (!fields.code) throw new ValidationError('Coupon title is required');
      try {
        return await Coupon.create({ ...fields, restaurant: restaurant._id });
      } catch (error) {
        if (isDuplicate(error)) throw duplicate('A coupon with this code');
        throw error;
      }
    },
    editRestaurantCoupon: async (_parent: unknown, { restaurantId, couponInput }: { restaurantId: string; couponInput: any }, context: AuthContext) => {
      const restaurant = await loadRestaurant(restaurantId, context);
      const coupon = await Coupon.findOne({ _id: assertObjectId(couponInput._id, 'coupon'), restaurant: restaurant._id, isActive: true });
      if (!coupon) throw new NotFoundError('Coupon');
      Object.assign(coupon, couponFields(couponInput));
      await coupon.save();
      return coupon;
    },
    deleteRestaurantCoupon: async (_parent: unknown, { restaurantId, couponId }: { restaurantId: string; couponId: string }, context: AuthContext) => {
      const restaurant = await loadRestaurant(restaurantId, context);
      const result = await Coupon.deleteOne({ _id: assertObjectId(couponId, 'coupon'), restaurant: restaurant._id });
      return result.deletedCount > 0;
    },

    // ---------- global catalog (super admin)
    createBanner: async (_parent: unknown, { bannerInput }: { bannerInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const { _id, ...fields } = bannerInput;
      const banner = await Banner.create(definedOnly(fields));
      await audit(context, 'createBanner', 'Banner', banner._id);
      return banner;
    },
    editBanner: async (_parent: unknown, { bannerInput }: { bannerInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const { _id, ...fields } = bannerInput;
      const banner = await Banner.findByIdAndUpdate(assertObjectId(_id, 'banner'), { $set: definedOnly(fields) }, { new: true, runValidators: true });
      if (!banner) throw new NotFoundError('Banner');
      await audit(context, 'editBanner', 'Banner', banner._id);
      return banner;
    },
    deleteBanner: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const result = await Banner.deleteOne({ _id: assertObjectId(id, 'banner') });
      if (!result.deletedCount) throw new NotFoundError('Banner');
      await audit(context, 'deleteBanner', 'Banner', id);
      return true;
    },
    createCuisine: async (_parent: unknown, { cuisineInput }: { cuisineInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const { _id, ...fields } = cuisineInput;
      try {
        const cuisine = await Cuisine.create({ ...definedOnly(fields), name: fields.name.trim() });
        await audit(context, 'createCuisine', 'Cuisine', cuisine._id);
        return cuisine;
      } catch (error) {
        if (isDuplicate(error)) throw duplicate('A cuisine with this name');
        throw error;
      }
    },
    editCuisine: async (_parent: unknown, { cuisineInput }: { cuisineInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const { _id, ...fields } = cuisineInput;
      try {
        const cuisine = await Cuisine.findByIdAndUpdate(assertObjectId(_id, 'cuisine'), { $set: definedOnly({ ...fields, name: fields.name?.trim() }) }, { new: true, runValidators: true });
        if (!cuisine) throw new NotFoundError('Cuisine');
        await audit(context, 'editCuisine', 'Cuisine', cuisine._id);
        return cuisine;
      } catch (error) {
        if (isDuplicate(error)) throw duplicate('A cuisine with this name');
        throw error;
      }
    },
    deleteCuisine: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const result = await Cuisine.deleteOne({ _id: assertObjectId(id, 'cuisine') });
      if (!result.deletedCount) throw new NotFoundError('Cuisine');
      await audit(context, 'deleteCuisine', 'Cuisine', id);
      return true;
    },
    createShopType: async (_parent: unknown, { dto }: { dto?: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      if (!dto?.name?.trim()) throw new ValidationError('Shop type name is required');
      try {
        const shopType = await ShopType.create({ name: dto.name.trim(), image: dto.image, isActive: dto.isActive ?? true });
        await audit(context, 'createShopType', 'ShopType', shopType._id);
        return shopType;
      } catch (error) {
        if (isDuplicate(error)) throw duplicate('A shop type with this name');
        throw error;
      }
    },
    updateShopType: async (_parent: unknown, { dto }: { dto?: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const { _id, ...fields } = dto || {};
      try {
        const shopType = await ShopType.findByIdAndUpdate(assertObjectId(_id, 'shop type'), { $set: definedOnly({ ...fields, name: fields.name?.trim() }) }, { new: true, runValidators: true });
        if (!shopType) throw new NotFoundError('Shop type');
        await audit(context, 'updateShopType', 'ShopType', shopType._id);
        return shopType;
      } catch (error) {
        if (isDuplicate(error)) throw duplicate('A shop type with this name');
        throw error;
      }
    },
    deleteShopType: async (_parent: unknown, { id, type }: { id: string; type?: 'SOFT' | 'HARD' | null }, context: AuthContext) => {
      requireSuperAdmin(context);
      const shopType = await ShopType.findById(assertObjectId(id, 'shop type'));
      if (!shopType) throw new NotFoundError('Shop type');
      if (type === 'SOFT') {
        shopType.isActive = false;
        await shopType.save();
      } else {
        if (await Restaurant.exists({ shopType: shopType.name, isActive: true })) throw new ValidationError('Shop type is in use by restaurants; deactivate it instead');
        await shopType.deleteOne();
      }
      await audit(context, 'deleteShopType', 'ShopType', id, { type: type || 'HARD' });
      return shopType;
    },
    createTaxation: async (_parent: unknown, { taxationInput }: { taxationInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const { _id, ...fields } = taxationInput;
      return Taxation.create(definedOnly(fields));
    },
    editTaxation: async (_parent: unknown, { taxationInput }: { taxationInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const { _id, ...fields } = taxationInput;
      const id = cleanId(_id);
      const target = id ? await Taxation.findById(assertObjectId(id, 'taxation')) : await firstOrCreate(Taxation);
      if (!target) throw new NotFoundError('Taxation');
      Object.assign(target, definedOnly(fields));
      return target.save();
    },
    createTipping: async (_parent: unknown, { tippingInput }: { tippingInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const { _id, ...fields } = tippingInput;
      if (fields.tipVariations?.some((v: number) => v < 0)) throw new ValidationError('Tip values must not be negative');
      return Tipping.create(definedOnly(fields));
    },
    editTipping: async (_parent: unknown, { tippingInput }: { tippingInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const { _id, ...fields } = tippingInput;
      if (fields.tipVariations?.some((v: number) => v < 0)) throw new ValidationError('Tip values must not be negative');
      const id = cleanId(_id);
      const target = id ? await Tipping.findById(assertObjectId(id, 'tipping')) : await firstOrCreate(Tipping);
      if (!target) throw new NotFoundError('Tipping');
      Object.assign(target, definedOnly(fields));
      return target.save();
    },
    createSubCategories: async (_parent: unknown, { subCategories }: { subCategories: Array<{ title: string; parentCategoryId: string }> }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'VENDOR']);
      for (const item of subCategories) {
        const title = item.title.trim();
        if (!title) continue;
        await SubCategory.findOneAndUpdate(
          { parentCategoryId: item.parentCategoryId, title },
          { $set: { isActive: true }, $setOnInsert: { parentCategoryId: item.parentCategoryId, title } },
          { upsert: true }
        );
      }
      return true;
    },
    deleteSubCategory: async (_parent: unknown, { _id }: { _id: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'VENDOR']);
      const sub = await SubCategory.findByIdAndUpdate(assertObjectId(_id, 'sub-category'), { isActive: false });
      if (!sub) throw new NotFoundError('Sub-category');
      return true;
    },
  },
};

/** Field-level resolvers (deep-merged over appFieldResolvers in resolvers/index.ts). */
const legacyAddonIds = async (restaurantId: string) => {
  const foods = await Food.find({ restaurant: restaurantId, isActive: true }).select('variations.addons');
  return Array.from(new Set(foods.flatMap((food) => food.variations.flatMap((variation) => (variation.addons || []).map(idOf)))));
};

export const adminCatalogFields = {
  Restaurant: {
    addons: async (parent: any) => {
      const restaurantId = idOf(parent._id);
      const ids = await legacyAddonIds(restaurantId);
      return Addon.find({ isActive: true, $or: [{ restaurant: restaurantId }, ...(ids.length ? [{ _id: { $in: ids } }] : [])] });
    },
    options: async (parent: any) => {
      const restaurantId = idOf(parent._id);
      const ids = await legacyAddonIds(restaurantId);
      const addons = ids.length ? await Addon.find({ _id: { $in: ids }, isActive: true }) : [];
      const own = await RestaurantOption.find({ restaurant: restaurantId, isActive: true }).sort({ title: 1 });
      const seen = new Set<string>();
      return [...own, ...addons.flatMap((addon) => addon.options)].filter((option: any) => {
        const id = idOf(option._id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    },
  },
  // Admin-managed addons expose option ids (the dashboard maps them to Restaurant.options);
  // legacy addons keep returning the embedded option objects.
  RestaurantAddon: {
    options: (parent: any) => (parent.restaurant ? (parent.options || []).map((option: any) => idOf(option._id)) : parent.options),
  },
  Review: {
    comments: (parent: any) => parent.comments ?? parent.description ?? null,
  },
};
