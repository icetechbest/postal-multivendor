import { randomInt } from 'crypto';
import { Types } from 'mongoose';
import { Addon } from '../../models/Addon';
import { Category } from '../../models/Category';
import { Coupon } from '../../models/Coupon';
import { Food } from '../../models/Food';
import { Order } from '../../models/Order';
import { RestaurantOption } from '../../models/Option';
import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';
import { AuthContext, requireAuth, requireRole } from '../../middleware/auth';
import { hashPassword } from '../../utils/crypto';
import { AuthorizationError, NotFoundError, ValidationError } from '../../utils/errors';
import { validatePassword, validateCoordinates } from '../../utils/validation';
import { idOf } from './appHelpers';
import { assertObjectId, audit, cleanId, definedOnly, ensureRestaurantOwner, escapeRegex, pageParams, requirePlatformReader, requireSuperAdmin } from './adminHelpers';

const slugify = (name: string) => name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'restaurant';

const uniqueSlug = async (name: string, excludeId?: string) => {
  const base = slugify(name);
  let slug = base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const clash = await Restaurant.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (!clash) return slug;
    slug = `${base}-${randomInt(100, 9999)}`;
  }
  throw new ValidationError('Could not generate a unique restaurant slug');
};

const uniquePrefix = async (name: string) => {
  const letters = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const prefix = `${letters}${randomInt(10, 99)}`;
    if (!(await Restaurant.exists({ orderPrefix: prefix }))) return prefix;
  }
  throw new ValidationError('Could not generate a unique order prefix');
};

const assertUnique = async (field: 'username' | 'orderPrefix', value: string | undefined, excludeId?: string) => {
  if (!value) return;
  const exists = await Restaurant.exists({ [field]: value, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  if (exists) throw new ValidationError(field === 'username' ? 'Restaurant username is already taken' : 'Order prefix already exists');
};

const loadRestaurant = async (id: unknown, context: AuthContext) => {
  const restaurant = await Restaurant.findById(assertObjectId(id, 'restaurant')).populate('owner');
  if (!restaurant) throw new NotFoundError('Restaurant');
  ensureRestaurantOwner(restaurant, context);
  return restaurant;
};

const response = (message: string, data: unknown) => ({ success: true, message, data });

/** Visibility filter for list queries: platform staff see all, owners their own, the public active ones. */
const listFilter = (context: AuthContext, cloned: boolean, search?: string | null) => {
  const filter: Record<string, any> = cloned ? { clonedFrom: { $exists: true, $ne: null } } : { clonedFrom: null };
  const role = context.user?.role;
  if (role === 'VENDOR') filter.owner = context.user!.userId;
  else if (role !== 'ADMIN' && role !== 'STAFF') filter.isActive = true;
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: regex }, { orderPrefix: regex }, { slug: regex }, { address: regex }];
  }
  return filter;
};

const paginated = async (filter: Record<string, any>, page?: number | null, limit?: number | null) => {
  const p = pageParams(page, limit, 10);
  const [data, totalCount] = await Promise.all([
    Restaurant.find(filter).populate('owner').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Restaurant.countDocuments(filter),
  ]);
  return { data, totalCount, currentPage: p.page, totalPages: Math.max(1, Math.ceil(totalCount / p.limit)) };
};

const profileFields = async (input: any, excludeId?: string) => {
  const fields: Record<string, any> = definedOnly({
    name: input.name?.trim(),
    phone: input.phone,
    address: input.address,
    image: input.image,
    logo: input.logo,
    deliveryTime: input.deliveryTime,
    minimumOrder: input.minimumOrder,
    salesTax: input.salesTax,
    shopType: input.shopType,
    isAvailable: input.isAvailable,
  });
  if (input.cuisines) fields.cuisines = input.cuisines;
  if (input.username) {
    await assertUnique('username', input.username, excludeId);
    fields.username = input.username;
  }
  if (input.password) {
    const check = validatePassword(input.password);
    if (!check.isValid) throw new ValidationError(check.message!);
    fields.password = await hashPassword(input.password);
  }
  if (input.orderPrefix) {
    const prefix = String(input.orderPrefix).toUpperCase();
    await assertUnique('orderPrefix', prefix, excludeId);
    fields.orderPrefix = prefix;
  }
  return fields;
};

export const adminRestaurantResolvers = {
  Query: {
    restaurants: async (_parent: unknown, args: { page?: number; limit?: number; search?: string }, context: AuthContext) => {
      const filter = listFilter(context, false, args.search);
      const query = Restaurant.find(filter).populate('owner').populate('zone').sort({ createdAt: -1 });
      // Without paging arguments the dashboard dropdowns expect every restaurant.
      if (args.limit) {
        const p = pageParams(args.page, args.limit);
        query.skip(p.skip).limit(p.limit);
      }
      return query;
    },
    restaurantsPaginated: async (_parent: unknown, args: { page?: number; limit?: number; search?: string }, context: AuthContext) =>
      paginated(listFilter(context, false, args.search), args.page, args.limit),
    getClonedRestaurants: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      return Restaurant.find(listFilter(context, true)).populate('owner').sort({ createdAt: -1 });
    },
    getClonedRestaurantsPaginated: async (_parent: unknown, args: { page?: number; limit?: number; search?: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      return paginated(listFilter(context, true, args.search), args.page, args.limit);
    },
    commissionRate: async (_parent: unknown, args: { page?: number; limit?: number }, context: AuthContext) => {
      requirePlatformReader(context);
      const p = pageParams(args.page, args.limit);
      // `null` matches both a missing field and an explicit null (original restaurants).
      const filter: Record<string, any> = { clonedFrom: null };
      const [restaurant, total] = await Promise.all([
        Restaurant.find(filter).sort({ name: 1 }).skip(p.skip).limit(p.limit),
        Restaurant.countDocuments(filter),
      ]);
      const totalPages = Math.max(1, Math.ceil(total / p.limit));
      return { restaurant, currentPage: p.page, totalPages, nextPage: p.page < totalPages ? p.page + 1 : null, prevPage: p.page > 1 ? p.page - 1 : null };
    },
    restaurantByOwner: async (_parent: unknown, { id }: { id?: string }, context: AuthContext) => {
      requireAuth(context);
      const ownerId = cleanId(id) || context.user!.userId;
      const role = context.user!.role;
      if (role !== 'ADMIN' && role !== 'STAFF' && ownerId !== context.user!.userId) throw new AuthorizationError();
      const owner = await User.findOne({ _id: assertObjectId(ownerId, 'owner'), role: { $in: ['VENDOR', 'ADMIN'] } });
      if (!owner) throw new NotFoundError('Owner');
      return owner;
    },
    getRestaurantDeliveryZoneInfo: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      const restaurant = await loadRestaurant(id, context);
      return {
        boundType: restaurant.boundType || 'polygon',
        deliveryBounds: restaurant.deliveryBounds?.coordinates?.length ? restaurant.deliveryBounds : { coordinates: [] },
        location: restaurant.location,
        circleBounds: restaurant.circleBounds || { radius: 0 },
        address: restaurant.address,
        city: restaurant.city,
        postCode: restaurant.postCode,
      };
    },
  },

  Mutation: {
    createRestaurant: async (_parent: unknown, args: { restaurant?: any; restaurantInput?: any; owner?: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'VENDOR']);
      const input = args.restaurant || args.restaurantInput;
      if (!input?.name?.trim() || !input.address) throw new ValidationError('Restaurant name and address are required');
      const ownerId = cleanId(args.owner) || cleanId(input.ownerId) || (context.user!.role === 'VENDOR' ? context.user!.userId : undefined);
      if (context.user!.role === 'VENDOR' && ownerId !== context.user!.userId) throw new AuthorizationError();
      const owner = await User.findById(assertObjectId(ownerId, 'owner'));
      if (!owner || owner.role !== 'VENDOR') throw new ValidationError('Invalid owner');
      if (!input.image) throw new ValidationError('Restaurant image is required');

      const fields = await profileFields(input);
      let coordinates: [number, number] = [0, 0];
      if (input.location) {
        if (!validateCoordinates(input.location.latitude, input.location.longitude)) throw new ValidationError('Invalid coordinates');
        coordinates = [input.location.longitude, input.location.latitude];
      }
      const restaurant = await Restaurant.create({
        deliveryTime: 30,
        minimumOrder: 0,
        ...fields,
        slug: await uniqueSlug(fields.name),
        orderPrefix: fields.orderPrefix || (await uniquePrefix(fields.name)),
        location: { type: 'Point', coordinates },
        owner: owner._id,
        zone: input.zone || undefined,
        deliveryFee: input.deliveryFee,
      });
      await audit(context, 'createRestaurant', 'Restaurant', restaurant._id);
      return restaurant.populate('owner');
    },
    editRestaurant: async (_parent: unknown, args: { restaurant?: any; restaurantInput?: any }, context: AuthContext) => {
      const input = args.restaurant || args.restaurantInput;
      const restaurant = await loadRestaurant(input?._id, context);
      const fields = await profileFields(input, idOf(restaurant._id));
      if (fields.name && fields.name !== restaurant.name) fields.slug = await uniqueSlug(fields.name, idOf(restaurant._id));
      Object.assign(restaurant, fields);
      await restaurant.save();
      await audit(context, 'editRestaurant', 'Restaurant', restaurant._id, Object.keys(fields).map((key) => (key === 'password' ? 'password: [redacted]' : key)));
      return restaurant;
    },
    // "Delete" in the dashboard activates/deactivates a restaurant.
    deleteRestaurant: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'VENDOR']);
      const restaurant = await loadRestaurant(id, context);
      restaurant.isActive = !restaurant.isActive;
      await restaurant.save();
      await audit(context, 'toggleRestaurantActive', 'Restaurant', restaurant._id, { isActive: restaurant.isActive });
      return restaurant;
    },
    hardDeleteRestaurant: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const restaurant = await Restaurant.findById(assertObjectId(id, 'restaurant'));
      if (!restaurant) throw new NotFoundError('Restaurant');
      if (await Order.exists({ restaurant: restaurant._id })) throw new ValidationError('Restaurant has orders; deactivate it instead of deleting');
      await Promise.all([
        Food.deleteMany({ restaurant: restaurant._id }),
        Category.deleteMany({ restaurant: restaurant._id }),
        Addon.deleteMany({ restaurant: restaurant._id }),
        RestaurantOption.deleteMany({ restaurant: restaurant._id }),
        Coupon.deleteMany({ restaurant: restaurant._id }),
      ]);
      await restaurant.deleteOne();
      await audit(context, 'hardDeleteRestaurant', 'Restaurant', id);
      return true;
    },
    duplicateRestaurant: async (_parent: unknown, { id, owner }: { id: string; owner: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const source = await Restaurant.findById(assertObjectId(id, 'restaurant'));
      if (!source) throw new NotFoundError('Restaurant');
      const newOwner = await User.findOne({ _id: assertObjectId(owner, 'owner'), role: 'VENDOR' });
      if (!newOwner) throw new ValidationError('Invalid owner');

      const raw: any = source.toObject();
      const { _id, id: _virtualId, createdAt, updatedAt, __v, slug, orderPrefix, orderId, username, password, owner: _o, categories, ...copy } = raw;
      const name = `${source.name} (Copy)`;
      const clone = await Restaurant.create({
        ...copy,
        name,
        slug: await uniqueSlug(name),
        orderPrefix: await uniquePrefix(source.name),
        owner: newOwner._id,
        clonedFrom: source._id,
        reviewCount: 0,
        reviewSum: 0,
        reviewAverage: 0,
        rating: 0,
        wallet: 0,
        totalOrders: 0,
        totalEarnings: 0,
        withdrawnWalletAmount: 0,
      });

      const optionMap = new Map<string, Types.ObjectId>();
      for (const option of await RestaurantOption.find({ restaurant: source._id, isActive: true })) {
        const copyDoc = await RestaurantOption.create({ restaurant: clone._id, title: option.title, description: option.description, price: option.price });
        optionMap.set(idOf(option._id), copyDoc._id as Types.ObjectId);
      }
      const addonMap = new Map<string, Types.ObjectId>();
      for (const addon of await Addon.find({ restaurant: source._id, isActive: true })) {
        const copyDoc = await Addon.create({
          title: addon.title,
          description: addon.description,
          quantityMinimum: addon.quantityMinimum,
          quantityMaximum: addon.quantityMaximum,
          restaurant: clone._id,
          options: addon.options.map((option) => ({ _id: optionMap.get(idOf(option._id)) || new Types.ObjectId(), title: option.title, description: option.description, price: option.price })),
        });
        addonMap.set(idOf(addon._id), copyDoc._id as Types.ObjectId);
      }
      const categoryMap = new Map<string, Types.ObjectId>();
      for (const category of await Category.find({ restaurant: source._id, isActive: true })) {
        const copyDoc = await Category.create({ title: category.title, description: category.description, image: category.image, restaurant: clone._id });
        categoryMap.set(idOf(category._id), copyDoc._id as Types.ObjectId);
      }
      for (const food of await Food.find({ restaurant: source._id, isActive: true })) {
        const category = categoryMap.get(idOf(food.category));
        if (!category) continue;
        await Food.create({
          title: food.title,
          description: food.description,
          image: food.image,
          subCategory: food.subCategory,
          restaurant: clone._id,
          category,
          variations: food.variations.map((variation) => ({
            title: variation.title,
            price: variation.price,
            discounted: variation.discounted,
            isOutOfStock: variation.isOutOfStock,
            // Only addons cloned for this restaurant can be remapped; never emit undefined entries.
            addons: (variation.addons || []).flatMap((addonId) => {
              const mapped = addonMap.get(idOf(addonId));
              return mapped ? [mapped] : [];
            }),
          })),
        });
      }
      await audit(context, 'duplicateRestaurant', 'Restaurant', clone._id, { from: idOf(source._id) });
      return clone.populate('owner');
    },
    updateCommission: async (_parent: unknown, { id, commissionRate }: { id: string; commissionRate: number }, context: AuthContext) => {
      requireSuperAdmin(context);
      if (!(commissionRate >= 0 && commissionRate <= 100)) throw new ValidationError('Commission rate must be between 0 and 100');
      const restaurant = await Restaurant.findByIdAndUpdate(assertObjectId(id, 'restaurant'), { commissionRate }, { new: true });
      if (!restaurant) throw new NotFoundError('Restaurant');
      await audit(context, 'updateCommission', 'Restaurant', id, { commissionRate });
      return restaurant;
    },
    updateRestaurantBussinessDetails: async (_parent: unknown, { id, bussinessDetails }: { id: string; bussinessDetails?: any }, context: AuthContext) => {
      const restaurant = await loadRestaurant(id, context);
      restaurant.bussinessDetails = definedOnly(bussinessDetails || {}) as any;
      restaurant.markModified('bussinessDetails');
      await restaurant.save();
      return response('Business details updated', restaurant);
    },
    updateDeliveryBoundsAndLocation: async (_parent: unknown, args: any, context: AuthContext) => {
      const restaurant = await loadRestaurant(args.id, context);
      const latitude = Number(args.location?.latitude);
      const longitude = Number(args.location?.longitude);
      if (!validateCoordinates(latitude, longitude)) throw new ValidationError('Invalid coordinates');
      // The admin editor sends `point` | `radius` | `polygon`, while the model
      // stores `circle` | `polygon`. `point` means "move the pin only" and must
      // not wipe the existing delivery zone.
      const requestedType = String(args.boundType || '').toLowerCase();
      const isPointOnly = requestedType === 'point';
      const boundType = requestedType === 'circle' || requestedType === 'radius' ? 'circle' : 'polygon';

      restaurant.location = { type: 'Point', coordinates: [longitude, latitude] };
      if (args.address !== undefined) restaurant.address = args.address;
      if (args.city !== undefined) restaurant.city = args.city;
      if (args.postCode !== undefined) restaurant.postCode = args.postCode;

      if (!isPointOnly) {
        restaurant.boundType = boundType;
        if (boundType === 'circle') {
          restaurant.circleBounds = { radius: Number(args.circleBounds?.radius) || 0 };
          // Delivery eligibility is evaluated against `deliveryBounds`
          // (pointInPolygon). Clearing it in circle mode silently removed the
          // delivery restriction, so persist the polygon approximation the
          // admin sends alongside the radius.
          const circleRing = (args.bounds?.[0] || []) as number[][];
          if (circleRing.length >= 4) {
            restaurant.deliveryBounds = { type: 'Polygon', coordinates: args.bounds } as any;
          } else {
            restaurant.set('deliveryBounds', undefined);
          }
        } else {
          const ring = (args.bounds?.[0] || []) as number[][];
          if (ring.length < 4) throw new ValidationError('A delivery polygon needs at least 3 points');
          restaurant.deliveryBounds = { type: 'Polygon', coordinates: args.bounds } as any;
        }
      }
      await restaurant.save();
      return response('Delivery bounds and location updated', restaurant);
    },
    updateRestaurantDelivery: async (_parent: unknown, args: { id: string; deliveryBounds?: number[][][]; minDeliveryFee?: number; deliveryDistance?: number; deliveryFee?: number }, context: AuthContext) => {
      const restaurant = await loadRestaurant(args.id, context);
      const info = definedOnly({ minDeliveryFee: args.minDeliveryFee, deliveryDistance: args.deliveryDistance, deliveryFee: args.deliveryFee });
      restaurant.deliveryInfo = { ...(restaurant.deliveryInfo || {}), ...info };
      if (args.deliveryFee !== undefined && args.deliveryFee !== null) restaurant.deliveryFee = args.deliveryFee;
      if (args.deliveryBounds) restaurant.deliveryBounds = { type: 'Polygon', coordinates: args.deliveryBounds } as any;
      await restaurant.save();
      return response('Delivery settings updated', restaurant);
    },
    updateTimings: async (_parent: unknown, { id, openingTimes }: { id: string; openingTimes?: any[] }, context: AuthContext) => {
      const restaurant = await loadRestaurant(id, context);
      restaurant.openingTimes = (openingTimes || []).filter(Boolean).map((entry) => ({ day: entry.day, times: (entry.times || []).filter(Boolean).map((t: any) => ({ startTime: t.startTime || [], endTime: t.endTime || [] })) })) as any;
      await restaurant.save();
      return restaurant;
    },
    updateDeliveryOptions: async (_parent: unknown, args: { restId: string; pickup: boolean; delivery: boolean }, context: AuthContext) => {
      const restaurant = await loadRestaurant(args.restId, context);
      restaurant.deliveryOptions = { pickup: args.pickup, delivery: args.delivery };
      await restaurant.save();
      return restaurant;
    },
  },
};

export const adminRestaurantFields = {
  Restaurant: {
    unique_restaurant_id: (parent: any) => idOf(parent._id).slice(-8).toUpperCase(),
    deliveryInfo: (parent: any) => ({
      minDeliveryFee: parent.deliveryInfo?.minDeliveryFee ?? 0,
      deliveryDistance: parent.deliveryInfo?.deliveryDistance ?? 0,
      deliveryFee: parent.deliveryInfo?.deliveryFee ?? parent.deliveryFee ?? 0,
    }),
    deliveryOptions: (parent: any) => ({ delivery: parent.deliveryOptions?.delivery !== false, pickup: parent.deliveryOptions?.pickup !== false }),
    bussinessDetails: (parent: any) => parent.bussinessDetails ?? null,
    currentWalletAmount: (parent: any) => parent.wallet ?? 0,
    totalWalletAmount: (parent: any) => parent.totalEarnings ?? 0,
    withdrawnWalletAmount: (parent: any) => parent.withdrawnWalletAmount ?? 0,
  },
  RestaurantDeliveryZoneInfo: {},
};
