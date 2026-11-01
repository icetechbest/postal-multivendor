import { createHash } from 'crypto';
import { Activity } from '../../models/Activity';
import { Address } from '../../models/Address';
import { Addon } from '../../models/Addon';
import { ChatMessage } from '../../models/ChatMessage';
import { Configuration } from '../../models/Configuration';
import { Coupon } from '../../models/Coupon';
import { Food } from '../../models/Food';
import { Order } from '../../models/Order';
import { OtpRequest } from '../../models/OtpRequest';
import { Restaurant } from '../../models/Restaurant';
import { Review } from '../../models/Review';
import { Taxation } from '../../models/Taxation';
import { User } from '../../models/User';
import { Zone } from '../../models/Zone';
import config from '../../config';
import { AuthContext, requireAuth, requireRider } from '../../middleware/auth';
import { sendEmail, sendSms } from '../../services/notifications';
import { pubsub } from '../../services/pubsub';
import { comparePassword, generateOTP, generateOrderId, hashPassword } from '../../utils/crypto';
import { AuthenticationError, AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { generateRefreshToken, generateToken, verifyRefreshToken } from '../../utils/jwt';
import { validateEmail, validatePassword } from '../../utils/validation';
import { distanceKm, ensureOrderAccess, getPopulatedOrder, getUser, idOf, pointInPolygon, publishOrderPlaced, publishOrderUpdate, validCoordinates } from './appHelpers';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const normalizeTarget = (value: string) => value.includes('@') ? value.trim().toLowerCase() : value.trim();

const expirationSeconds = (value: string): number => {
  const match = /^(\d+)([smhd])?$/.exec(value);
  if (!match) return 7 * 24 * 60 * 60;
  const amount = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] || 's'] || 1;
  return amount * multiplier;
};

const authPayload = async (user: any, isNewUser = false) => {
  const payload = { userId: idOf(user._id), email: user.email, role: user.role };
  const token = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  return {
    userId: idOf(user._id),
    token,
    refreshToken,
    tokenExpiration: expirationSeconds(config.jwt.expiresIn),
    isActive: user.isActive,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isNewUser,
    user,
  };
};

const issueOtp = async (rawTarget: string, channel: 'email' | 'phone'): Promise<string> => {
  const target = normalizeTarget(rawTarget);
  if (!target) throw new ValidationError(`${channel === 'email' ? 'Email' : 'Phone'} is required`);
  if (channel === 'email' && !validateEmail(target)) throw new ValidationError('Invalid email address');
  const existing = await OtpRequest.findOne({ target });
  if (existing && Date.now() - existing.requestedAt.getTime() < 30_000) {
    throw new ValidationError('Please wait before requesting another verification code');
  }
  const otp = generateOTP(config.otp.length);
  const now = new Date();
  await OtpRequest.findOneAndUpdate(
    { target },
    {
      $set: {
        otpHash: await hashPassword(otp),
        expiresAt: new Date(now.getTime() + config.otp.expiryMinutes * 60_000),
        attempts: 0,
        requestedAt: now,
      },
      $unset: { verifiedAt: 1 },
    },
    { upsert: true, new: true }
  );
  const body = `Your Postal verification code is ${otp}. It expires in ${config.otp.expiryMinutes} minutes.`;
  if (channel === 'email') await sendEmail(target, 'Your Postal verification code', body);
  else await sendSms(target, body);
  return 'Verification code sent';
};

const verifyOtpCode = async (rawTarget: string, otp: string): Promise<void> => {
  const target = normalizeTarget(rawTarget);
  const request = await OtpRequest.findOne({ target });
  if (!request || Date.now() > request.expiresAt.getTime()) throw new ValidationError('Verification code has expired');
  if (request.attempts >= 5) throw new ValidationError('Too many invalid attempts. Request a new code');
  const valid = await comparePassword(otp, request.otpHash);
  if (!valid) {
    request.attempts += 1;
    await request.save();
    throw new ValidationError('Invalid verification code');
  }
  request.verifiedAt = new Date();
  await request.save();
  const user = await User.findOne(target.includes('@') ? { email: target } : { phone: target });
  if (user) {
    if (target.includes('@')) {
      user.emailVerified = true;
      user.emailIsVerified = true;
    } else {
      user.phoneVerified = true;
      user.phoneIsVerified = true;
    }
    await user.save();
  }
};

const addressCoordinates = (input: any): [number, number] => {
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!validCoordinates(latitude, longitude)) throw new ValidationError('Valid latitude and longitude are required');
  return [longitude, latitude];
};

const ownedUser = async (context: AuthContext) => {
  requireAuth(context);
  const user = await User.findById(context.user!.userId);
  if (!user) throw new NotFoundError('User');
  return user;
};

const updateOrderStatus = async (id: string, status: string, reason: string | undefined, context: AuthContext) => {
  const order = await Order.findById(id);
  if (!order) throw new NotFoundError('Order');
  await ensureOrderAccess(order, context, true);
  const normalized = status.toUpperCase() as typeof order.orderStatus;
  const allowed = ['AWAITING_ADMIN', 'PENDING', 'ACCEPTED', 'ASSIGNED', 'PICKED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
  if (!allowed.includes(normalized)) throw new ValidationError('Invalid order status');
  if ((normalized as string) === 'AWAITING_ADMIN') throw new ValidationError('An order cannot be moved back to AWAITING_ADMIN');
  // Orders waiting for admin confirmation can only leave that state through adminConfirmOrder / adminRejectOrder.
  if (order.orderStatus === 'AWAITING_ADMIN') throw new ValidationError('This order is waiting for admin confirmation; use adminConfirmOrder or adminRejectOrder');
  const now = new Date();
  order.orderStatus = normalized;
  if (reason !== undefined) order.reason = reason;
  if (normalized === 'ACCEPTED') order.acceptedAt = now;
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
  return publishOrderUpdate(order._id, 'updateOrderStatus');
};

const abortOrder = async (id: string, reason: string | undefined, context: AuthContext) => {
  requireAuth(context);
  const order = await Order.findById(id);
  if (!order) throw new NotFoundError('Order');
  if (context.user!.role !== 'ADMIN' && idOf(order.user) !== context.user!.userId) throw new AuthorizationError();
  if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.orderStatus)) {
    throw new ValidationError('This order can no longer be cancelled');
  }
  order.orderStatus = 'CANCELLED';
  order.reason = reason || 'Cancelled by customer';
  order.cancelledAt = new Date();
  await order.save();
  return publishOrderUpdate(order._id, 'abortOrder');
};

export const appMutationResolvers = {
  createUser: async (_parent: unknown, { userInput }: { userInput: any }) => {
    const email = userInput.email?.trim().toLowerCase();
    if (!email || !validateEmail(email)) throw new ValidationError('Invalid email address');
    if (!userInput.name?.trim()) throw new ValidationError('Name is required');
    if (!userInput.appleId) {
      const passwordValidation = validatePassword(userInput.password || '');
      if (!passwordValidation.isValid) throw new ValidationError(passwordValidation.message!);
    }
    if (await User.findOne({ email })) throw new ConflictError('User with this email already exists');
    if (userInput.phone && await User.findOne({ phone: userInput.phone })) throw new ConflictError('User with this phone number already exists');
    const otp = await OtpRequest.findOne({ target: email, verifiedAt: { $exists: true } });
    const user = await User.create({
      name: userInput.name.trim(),
      email,
      phone: userInput.phone || undefined,
      password: userInput.password ? await hashPassword(userInput.password) : undefined,
      notificationToken: userInput.notificationToken,
      socialProvider: userInput.appleId ? 'apple' : undefined,
      socialId: userInput.appleId,
      emailVerified: Boolean(userInput.emailIsVerified || userInput.appleId || otp),
      emailIsVerified: Boolean(userInput.emailIsVerified || userInput.appleId || otp),
      role: 'USER',
    });
    return authPayload(user, true);
  },
  login: async (_parent: unknown, args: any) => {
    const type = (args.type || 'email').toLowerCase();
    const email = args.email?.trim().toLowerCase();
    if (!email || !validateEmail(email)) throw new ValidationError('Invalid email address');
    let user = await User.findOne(email ? { email } : { socialId: args.appleId }).select('+password');
    let isNewUser = false;
    if (type === 'email') {
      if (!args.password) throw new ValidationError('Password is required');
      if (!user || !user.password || !(await comparePassword(args.password, user.password))) {
        throw new AuthenticationError('Invalid email or password');
      }
    } else {
      if (!['google', 'facebook', 'apple'].includes(type)) throw new ValidationError('Unsupported login type');
      if (!user) {
        user = await User.create({
          name: args.name?.trim() || email.split('@')[0],
          email,
          role: 'USER',
          socialProvider: type,
          socialId: args.appleId || email,
          emailVerified: true,
          emailIsVerified: true,
          notificationToken: args.notificationToken,
        });
        isNewUser = true;
      }
    }
    if (!user.isActive) throw new AuthenticationError('Account is deactivated');
    if (args.notificationToken) user.notificationToken = args.notificationToken;
    user.password = undefined;
    return authPayload(user, isNewUser);
  },
  refreshToken: async (_parent: unknown, { refreshToken }: { refreshToken: string }) => {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.userId).select('+refreshTokenHash');
      if (!user || !user.isActive || user.refreshTokenHash !== hashToken(refreshToken)) throw new AuthenticationError('Invalid refresh token');
      return authPayload(user);
    } catch {
      throw new AuthenticationError('Invalid or expired refresh token');
    }
  },
  emailExist: async (_parent: unknown, { email }: { email: string }) => User.findOne({ email: email.trim().toLowerCase() }),
  phoneExist: async (_parent: unknown, { phone }: { phone: string }) => User.findOne({ phone: phone.trim() }),
  Deactivate: async (_parent: unknown, { isActive, email }: { isActive: boolean; email: string }, context: AuthContext) => {
    requireAuth(context);
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) throw new NotFoundError('User');
    if (context.user!.role !== 'ADMIN' && idOf(user._id) !== context.user!.userId) throw new AuthorizationError();
    user.isActive = isActive;
    await user.save();
    return user;
  },
  updateUser: async (_parent: unknown, { updateUserInput }: { updateUserInput: any }, context: AuthContext) => {
    const user = await ownedUser(context);
    user.name = updateUserInput.name.trim();
    if (updateUserInput.phone !== undefined && updateUserInput.phone !== user.phone) {
      if (updateUserInput.phone && await User.findOne({ phone: updateUserInput.phone, _id: { $ne: user._id } })) {
        throw new ConflictError('Phone number is already in use');
      }
      user.phone = updateUserInput.phone;
      user.phoneVerified = false;
      user.phoneIsVerified = false;
    }
    if (updateUserInput.phoneIsVerified !== undefined) {
      user.phoneVerified = updateUserInput.phoneIsVerified;
      user.phoneIsVerified = updateUserInput.phoneIsVerified;
    }
    if (updateUserInput.emailIsVerified !== undefined) {
      user.emailVerified = updateUserInput.emailIsVerified;
      user.emailIsVerified = updateUserInput.emailIsVerified;
    }
    await user.save();
    return user;
  },
  updateNotificationStatus: async (_parent: unknown, args: any, context: AuthContext) => {
    const user = await ownedUser(context);
    user.isOfferNotification = args.offerNotification;
    user.isOrderNotification = args.orderNotification ?? args.isOrderNotification;
    await user.save();
    return user;
  },
  pushToken: async (_parent: unknown, { token }: { token?: string }, context: AuthContext) => {
    const user = await ownedUser(context);
    user.notificationToken = token || undefined;
    await user.save();
    return user;
  },
  changePassword: async (_parent: unknown, { oldPassword, newPassword }: { oldPassword: string; newPassword: string }, context: AuthContext) => {
    const user = await ownedUser(context);
    const withPassword = await User.findById(user._id).select('+password');
    if (!withPassword?.password || !(await comparePassword(oldPassword, withPassword.password))) throw new AuthenticationError('Current password is incorrect');
    const validation = validatePassword(newPassword);
    if (!validation.isValid) throw new ValidationError(validation.message!);
    withPassword.password = await hashPassword(newPassword);
    withPassword.refreshTokenHash = undefined;
    await withPassword.save();
    return true;
  },
  forgotPassword: async (_parent: unknown, { email }: { email: string }) => {
    const normalized = email.trim().toLowerCase();
    if (!validateEmail(normalized)) throw new ValidationError('Invalid email address');
    if (await User.findOne({ email: normalized, isActive: true })) await issueOtp(normalized, 'email');
    return { result: 'If the account exists, a verification code has been sent' };
  },
  resetPassword: async (_parent: unknown, { password, email, token }: { password: string; email: string; token?: string }) => {
    const validation = validatePassword(password);
    if (!validation.isValid) throw new ValidationError(validation.message!);
    const normalized = email.trim().toLowerCase();
    let authorized = false;
    if (token) {
      const user = await User.findOne({ email: normalized, resetPasswordToken: hashToken(token), resetPasswordExpiry: { $gt: new Date() } });
      authorized = Boolean(user);
    } else {
      const request = await OtpRequest.findOne({ target: normalized, verifiedAt: { $gte: new Date(Date.now() - 15 * 60_000) } });
      authorized = Boolean(request);
    }
    if (!authorized) throw new AuthorizationError('Password reset verification is required or has expired');
    const user = await User.findOne({ email: normalized, isActive: true }).select('+password +resetPasswordToken +resetPasswordExpiry');
    if (!user) throw new NotFoundError('User');
    user.password = await hashPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    user.refreshTokenHash = undefined;
    await user.save();
    await OtpRequest.deleteOne({ target: normalized });
    return { result: 'Password reset successfully' };
  },
  sendOtpToEmail: async (_parent: unknown, { email }: { email: string }) => ({ result: await issueOtp(email, 'email') }),
  sendOtpToPhoneNumber: async (_parent: unknown, { phone }: { phone: string }) => ({ result: await issueOtp(phone, 'phone') }),
  verifyOtp: async (_parent: unknown, { phone, email, otp }: { phone?: string; email?: string; otp: string }) => {
    if (!email && !phone) throw new ValidationError('Either email or phone is required');
    await verifyOtpCode((email || phone)!, otp);
    return { result: 'Verification successful' };
  },
  createAddress: async (_parent: unknown, { addressInput }: { addressInput: any }, context: AuthContext) => {
    const user = await ownedUser(context);
    const count = await Address.countDocuments({ user: user._id });
    const address: any = await Address.create({
      label: addressInput.label,
      deliveryAddress: addressInput.deliveryAddress,
      details: addressInput.details || '',
      location: { type: 'Point', coordinates: addressCoordinates(addressInput) },
      user: user._id,
      isSelected: count === 0,
    } as any);
    user.addresses.push(address._id);
    await user.save();
    return getUser(idOf(user._id));
  },
  editAddress: async (_parent: unknown, { addressInput }: { addressInput: any }, context: AuthContext) => {
    const user = await ownedUser(context);
    if (!addressInput._id) throw new ValidationError('Address _id is required');
    const address = await Address.findOne({ _id: addressInput._id, user: user._id });
    if (!address) throw new NotFoundError('Address');
    address.label = addressInput.label;
    address.deliveryAddress = addressInput.deliveryAddress;
    address.details = addressInput.details || '';
    address.location.coordinates = addressCoordinates(addressInput);
    await address.save();
    return getUser(idOf(user._id));
  },
  deleteAddress: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
    const user = await ownedUser(context);
    const address = await Address.findOneAndDelete({ _id: id, user: user._id });
    if (!address) throw new NotFoundError('Address');
    user.addresses = user.addresses.filter((addressId) => idOf(addressId) !== id) as any;
    await user.save();
    return getUser(idOf(user._id));
  },
  deleteBulkAddresses: async (_parent: unknown, { ids }: { ids: string[] }, context: AuthContext) => {
    const user = await ownedUser(context);
    await Address.deleteMany({ _id: { $in: ids }, user: user._id });
    user.addresses = user.addresses.filter((addressId) => !ids.includes(idOf(addressId))) as any;
    await user.save();
    return getUser(idOf(user._id));
  },
  selectAddress: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
    const user = await ownedUser(context);
    const address = await Address.findOne({ _id: id, user: user._id });
    if (!address) throw new NotFoundError('Address');
    await Address.updateMany({ user: user._id }, { $set: { isSelected: false } });
    (address as any).isSelected = true;
    await address.save();
    return getUser(idOf(user._id));
  },
  addFavourite: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
    const user = await ownedUser(context);
    if (!await Restaurant.findOne({ _id: id, isActive: true })) throw new NotFoundError('Restaurant');
    const exists = user.favouriteRestaurants.some((restaurantId) => idOf(restaurantId) === id);
    if (exists) user.favouriteRestaurants = user.favouriteRestaurants.filter((restaurantId) => idOf(restaurantId) !== id) as any;
    else user.favouriteRestaurants.push(id as any);
    await user.save();
    return getUser(idOf(user._id));
  },
  addFavouriteRestaurant: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
    const user = await ownedUser(context);
    if (!await Restaurant.findOne({ _id: id, isActive: true })) throw new NotFoundError('Restaurant');
    await User.findByIdAndUpdate(user._id, { $addToSet: { favouriteRestaurants: id } });
    return getUser(idOf(user._id));
  },
  coupon: async (_parent: unknown, { coupon, restaurantId }: { coupon: string; restaurantId: string }, context: AuthContext) => {
    requireAuth(context);
    const record = await Coupon.findOne({
      code: coupon.trim().toUpperCase(),
      isActive: true,
      isEnabled: true,
      $and: [{ $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }] }],
    });
    if (!record || (record.restaurant && idOf(record.restaurant) !== restaurantId)) {
      return { success: false, message: 'Coupon is invalid or expired', coupon: null };
    }
    return { success: true, message: 'Coupon applied', coupon: record };
  },
  placeOrder: async (_parent: unknown, args: any, context: AuthContext) => {
    requireAuth(context);
    const restaurant = await Restaurant.findById(args.restaurant);
    if (!restaurant || !restaurant.isActive || !restaurant.isAvailable) throw new ValidationError('Restaurant is not available');
    if (!Array.isArray(args.orderInput) || !args.orderInput.length || args.orderInput.length > 100) {
      throw new ValidationError('Order must contain between 1 and 100 items');
    }
    const coordinates = addressCoordinates(args.address);
    const isPickup = Boolean(args.isPickedUp);
    if (!isPickup) {
      const zone = await Zone.findOne({ _id: restaurant.zone, isActive: true });
      if (!zone) throw new ValidationError('Restaurant delivery zone is unavailable');
      if (!pointInPolygon(coordinates[0], coordinates[1], zone.location.coordinates)) throw new ValidationError('Address is outside the delivery zone');
      if (restaurant.deliveryBounds?.coordinates?.length && !pointInPolygon(coordinates[0], coordinates[1], restaurant.deliveryBounds.coordinates)) {
        throw new ValidationError('Address is outside the restaurant delivery bounds');
      }
    }
    const items: any[] = [];
    let orderAmount = 0;
    const quantities = new Map<string, number>();
    for (const input of args.orderInput) {
      if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) throw new ValidationError('Item quantity must be between 1 and 100');
      const food = await Food.findById(input.food);
      if (!food || !food.isActive || !food.isAvailable || food.isOutOfStock || idOf(food.restaurant) !== args.restaurant) {
        throw new ValidationError('An item is unavailable at this restaurant');
      }
      const variation = food.variations.find((entry) => idOf(entry._id) === input.variation);
      if (!variation || (variation as any).isOutOfStock) throw new ValidationError(`Invalid variation for ${food.title}`);
      const addons: any[] = [];
      let addonsPrice = 0;
      for (const requested of input.addons || []) {
        if (!(variation.addons || []).some((addonId) => idOf(addonId) === requested._id)) throw new ValidationError(`Invalid addon for ${food.title}`);
        const addon = await Addon.findOne({ _id: requested._id, isActive: true });
        if (!addon) throw new ValidationError(`Invalid addon for ${food.title}`);
        const uniqueOptions = Array.from(new Set(requested.options || []));
        const options = addon.options.filter((option) => uniqueOptions.includes(idOf(option._id)));
        if (options.length !== uniqueOptions.length || options.length < addon.quantityMinimum || options.length > addon.quantityMaximum) {
          throw new ValidationError(`Invalid options for ${addon.title}`);
        }
        addonsPrice += options.reduce((sum, option) => sum + option.price, 0);
        addons.push({
          _id: addon._id,
          title: addon.title,
          description: addon.description,
          quantityMinimum: addon.quantityMinimum,
          quantityMaximum: addon.quantityMaximum,
          options,
        });
      }
      const basePrice = variation.discounted > 0 ? variation.discounted : variation.price;
      orderAmount += (basePrice + addonsPrice) * input.quantity;
      quantities.set(idOf(food._id), (quantities.get(idOf(food._id)) || 0) + input.quantity);
      items.push({
        food: food._id,
        title: food.title,
        description: food.description,
        image: food.image,
        quantity: input.quantity,
        variation: { _id: variation._id, title: variation.title, price: variation.price, discounted: variation.discounted },
        addons,
        specialInstructions: input.specialInstructions || '',
        isActive: food.isActive,
        isOutOfStock: food.isOutOfStock,
        createdAt: food.createdAt,
        updatedAt: food.updatedAt,
      });
    }
    orderAmount = Math.round(orderAmount * 100) / 100;
    if (orderAmount < restaurant.minimumOrder) throw new ValidationError(`Minimum order amount is ${restaurant.minimumOrder}`);
    let discount = 0;
    if (args.couponCode) {
      const coupon = await Coupon.findOne({ code: args.couponCode.trim().toUpperCase(), isActive: true, isEnabled: true });
      if (!coupon || (coupon.restaurant && idOf(coupon.restaurant) !== args.restaurant) || (coupon.expiresAt && coupon.expiresAt <= new Date())) {
        throw new ValidationError('Coupon is invalid or expired');
      }
      discount = Math.min(orderAmount, orderAmount * coupon.discount / 100);
    }
    const taxation = await Taxation.findOne({ enabled: true }).sort({ createdAt: 1 });
    const taxRate = taxation ? taxation.taxationCharges : restaurant.salesTax;
    const taxationAmount = Math.round(orderAmount * taxRate) / 100;
    const configuration = await Configuration.findOne({ key: 'default' });
    let deliveryCharges = 0;
    if (!isPickup && !restaurant.freeDelivery) {
      const deliveryRate = Number(configuration?.get('deliveryRate') ?? config.delivery.defaultFee);
      if (configuration?.get('costType') === 'perKM') {
        const [restaurantLongitude, restaurantLatitude] = restaurant.location.coordinates;
        deliveryCharges = distanceKm(coordinates[1], coordinates[0], restaurantLatitude, restaurantLongitude) * deliveryRate;
      } else {
        deliveryCharges = deliveryRate;
      }
      deliveryCharges = Math.round(deliveryCharges * 100) / 100;
    }
    const tipping = Math.max(0, Number(args.tipping) || 0);
    const total = Math.max(0, Math.round((orderAmount + deliveryCharges + tipping + taxationAmount - discount) * 100) / 100);
    const orderDate = new Date(args.orderDate);
    if (Number.isNaN(orderDate.getTime())) throw new ValidationError('Invalid order date');
    const paymentMethod = String(args.paymentMethod).toUpperCase();
    if (!['COD', 'CARD', 'HYP'].includes(paymentMethod)) throw new ValidationError('Unsupported payment method');
    const order: any = await Order.create({
      orderId: generateOrderId(restaurant.orderPrefix),
      restaurant: restaurant._id,
      user: context.user!.userId,
      items,
      deliveryAddress: {
        id: args.address._id,
        label: args.address.label,
        deliveryAddress: args.address.deliveryAddress,
        details: args.address.details || '',
        location: { type: 'Point', coordinates },
      },
      orderAmount,
      deliveryCharges,
      tipping,
      taxationAmount,
      discount: Math.round(discount * 100) / 100,
      total,
      paymentMethod,
      paidAmount: 0,
      paymentStatus: 'PENDING',
      orderStatus: 'AWAITING_ADMIN',
      isPickedUp: isPickup,
      instructions: args.instructions || '',
      orderDate,
      expectedTime: new Date(orderDate.getTime() + restaurant.deliveryTime * 60_000),
      estimatedDeliveryTime: new Date(orderDate.getTime() + restaurant.deliveryTime * 60_000),
      preparationTime: restaurant.deliveryTime,
      couponCode: args.couponCode || undefined,
    } as any);
    await Promise.all([
      ...Array.from(quantities.entries()).map(([foodId, quantity]) => Food.findByIdAndUpdate(foodId, { $inc: { orderCount: quantity } })),
      Restaurant.findByIdAndUpdate(restaurant._id, { $inc: { totalOrders: 1 } }),
    ]);
    return publishOrderPlaced(order._id);
  },
  updateOrderStatus: async (_parent: unknown, { id, status, reason }: { id: string; status: string; reason?: string }, context: AuthContext) =>
    updateOrderStatus(id, status, reason, context),
  assignRider: async (_parent: unknown, { orderId, riderId }: { orderId: string; riderId: string }, context: AuthContext) => {
    requireAuth(context);
    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError('Order');
    await ensureOrderAccess(order, context, true);
    if (context.user!.role === 'RIDER') throw new AuthorizationError();
    if (order.orderStatus === 'AWAITING_ADMIN') throw new ValidationError('This order is waiting for admin confirmation');
    const rider = await User.findOne({ _id: riderId, role: 'RIDER', isActive: true });
    if (!rider) throw new ValidationError('Invalid rider');
    order.rider = rider._id;
    order.orderStatus = 'ASSIGNED';
    order.riderAssignedAt = new Date();
    order.assignedAt = order.riderAssignedAt;
    await order.save();
    return publishOrderUpdate(order._id, 'assignRider');
  },
  abortOrder: async (_parent: unknown, { id, reason }: { id: string; reason?: string }, context: AuthContext) => abortOrder(id, reason, context),
  cancelOrder: async (_parent: unknown, { id, reason }: { id: string; reason: string }, context: AuthContext) => abortOrder(id, reason, context),
  reviewOrder: async (_parent: unknown, { reviewInput }: { reviewInput: any }, context: AuthContext) => {
    requireAuth(context);
    const order = await Order.findById(reviewInput.order);
    if (!order) throw new NotFoundError('Order');
    if (idOf(order.user) !== context.user!.userId) throw new AuthorizationError();
    if (!['DELIVERED', 'COMPLETED'].includes(order.orderStatus)) throw new ValidationError('Order must be completed before review');
    if (order.isReviewed) throw new ValidationError('Order already reviewed');
    if (!Number.isInteger(reviewInput.rating) || reviewInput.rating < 1 || reviewInput.rating > 5) throw new ValidationError('Rating must be between 1 and 5');
    const review = await Review.create({
      order: order._id,
      restaurant: order.restaurant,
      rating: reviewInput.rating,
      description: reviewInput.description || '',
    });
    order.review = review._id;
    order.isReviewed = true;
    await order.save();
    const aggregate = await Review.aggregate([{ $match: { restaurant: order.restaurant, isActive: true } }, { $group: { _id: '$restaurant', total: { $sum: 1 }, sum: { $sum: '$rating' } } }]);
    if (aggregate[0]) {
      await Restaurant.findByIdAndUpdate(order.restaurant, {
        reviewCount: aggregate[0].total,
        reviewSum: aggregate[0].sum,
        reviewAverage: aggregate[0].sum / aggregate[0].total,
        rating: aggregate[0].sum / aggregate[0].total,
      });
    }
    return getPopulatedOrder(order._id);
  },
  updateRiderLocation: async (_parent: unknown, { latitude, longitude }: { latitude: number; longitude: number }, context: AuthContext) => {
    requireRider(context);
    if (!validCoordinates(latitude, longitude)) throw new ValidationError('Invalid coordinates');
    const rider = await User.findByIdAndUpdate(
      context.user!.userId,
      { $set: { location: { type: 'Point', coordinates: [longitude, latitude] } } },
      { new: true }
    );
    if (!rider) throw new NotFoundError('Rider');
    await pubsub.publish(`RIDER_LOCATION_${idOf(rider._id)}`, { subscriptionRiderLocation: rider });
    return rider;
  },
  sendChatMessage: async (_parent: unknown, { message, orderId }: { message: any; orderId: string }, context: AuthContext) => {
    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError('Order');
    await ensureOrderAccess(order, context);
    if (!message.message?.trim() || message.message.length > 4000) throw new ValidationError('Message must contain between 1 and 4000 characters');
    const sender = await User.findById(context.user!.userId);
    if (!sender) throw new NotFoundError('User');
    const chat = await ChatMessage.create({ order: order._id, message: message.message.trim(), user: { id: idOf(sender._id), name: sender.name } });
    await pubsub.publish(`CHAT_${orderId}`, { subscriptionNewMessage: chat });
    return { success: true, message: 'Message sent', data: chat };
  },
  createActivity: async (_parent: unknown, args: any, context: AuthContext) => {
    requireAuth(context);
    await Activity.create({ ...args, user: context.user!.userId });
    return true;
  },
};
