import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { Types } from 'mongoose';
import { Notification, WebNotification } from '../../models/Notification';
import { AuditLog } from '../../models/AuditLog';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { Transaction } from '../../models/Transaction';
import { User } from '../../models/User';
import { WithdrawRequest } from '../../models/WithdrawRequest';
import config from '../../config';
import { AuthContext, requireRole } from '../../middleware/auth';
import { sendPushNotification } from '../../services/push';
import { hashPassword } from '../../utils/crypto';
import { AuthorizationError, NotFoundError, ValidationError } from '../../utils/errors';
import { validatePassword } from '../../utils/validation';
import { idOf } from './appHelpers';
import { assertObjectId, audit, cleanId, dateRange, definedOnly, ensureRestaurantOwner, escapeRegex, isSuperAdmin, pageParams, requirePlatformReader, requireSuperAdmin, round2 } from './adminHelpers';

const DONE = ['DELIVERED', 'COMPLETED'];
const isRealString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && value !== 'undefined';

// ---------------------------------------------------------------- scoping helpers
/** Restaurants a dashboard user may see finance data for (null = unrestricted). */
const scopedStoreIds = async (context: AuthContext): Promise<Types.ObjectId[] | null> => {
  if (context.user!.role === 'VENDOR') return (await Restaurant.find({ owner: context.user!.userId }).select('_id')).map((r) => r._id as Types.ObjectId);
  return null;
};

const assertStoreAccess = async (storeId: string, context: AuthContext) => {
  const restaurant = await Restaurant.findById(assertObjectId(storeId, 'store'));
  if (!restaurant) throw new NotFoundError('Restaurant');
  ensureRestaurantOwner(restaurant, context);
  return restaurant;
};

export const deliveryFilter = (orderType?: string | null): Record<string, any> | null => {
  if (orderType === 'DELIVERY') return { $or: [{ rider: { $exists: true, $ne: null } }, { deliveryCharges: { $gt: 0 } }] };
  if (orderType === 'PICKUP') return { rider: { $in: [null, undefined] }, deliveryCharges: { $lte: 0 } };
  return null;
};

// ---------------------------------------------------------------- earnings
const earningsMatch = async (args: any, context: AuthContext) => {
  const match: Record<string, any> = { orderStatus: { $in: DONE } };
  const and: any[] = [];
  const userType = args.userType && args.userType !== 'ALL' ? args.userType : null;
  const userId = cleanId(args.userId);
  const stores = await scopedStoreIds(context);

  if (userType === 'RIDER') match.rider = userId ? new Types.ObjectId(assertObjectId(userId, 'rider')) : { $exists: true, $ne: null };
  else if (userType === 'STORE' || stores) {
    if (userId) {
      await assertStoreAccess(userId, context);
      match.restaurant = new Types.ObjectId(userId);
    } else if (stores) match.restaurant = { $in: stores };
  } else if (userId && Types.ObjectId.isValid(userId)) {
    and.push({ $or: [{ rider: new Types.ObjectId(userId) }, { restaurant: new Types.ObjectId(userId) }] });
  }
  const typeFilter = deliveryFilter(args.orderType && args.orderType !== 'ALL' ? args.orderType : null);
  if (typeFilter) and.push(typeFilter);
  if (args.paymentMethod && args.paymentMethod !== 'ALL') match.paymentMethod = args.paymentMethod;
  if (args.search) match.orderId = { $regex: escapeRegex(args.search), $options: 'i' };
  const range = dateRange(null, args.dateFilter?.starting_date, args.dateFilter?.ending_date);
  if (range) match.createdAt = range;
  if (and.length) match.$and = and;
  return match;
};

const earningRow = (order: any) => {
  const rate = Number(order.restaurant?.commissionRate ?? 0);
  const hasRider = Boolean(order.rider);
  const marketplaceCommission = round2((order.orderAmount * rate) / 100);
  const platformTotal = round2(marketplaceCommission + (order.taxationAmount || 0));
  const deliveryFee = hasRider ? order.deliveryCharges || 0 : 0;
  const tip = hasRider ? order.tipping || 0 : 0;
  return {
    _id: order._id,
    orderId: order.orderId,
    orderType: hasRider || order.deliveryCharges > 0 ? 'DELIVERY' : 'PICKUP',
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    platformEarnings: { marketplaceCommission, deliveryCommission: 0, tax: order.taxationAmount || 0, platformFee: 0, totalEarnings: platformTotal },
    riderEarnings: { riderId: order.rider || null, deliveryFee, tip, totalEarnings: round2(deliveryFee + tip) },
    storeEarnings: { storeId: order.restaurant || null, orderAmount: order.orderAmount, totalEarnings: round2(order.orderAmount - marketplaceCommission) },
  };
};

// ---------------------------------------------------------------- uploads
const IMAGE_SIGNATURES: Array<{ ext: string; test: (b: Buffer) => boolean }> = [
  { ext: 'png', test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', test: (b) => b.length > 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii')) },
  { ext: 'webp', test: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const publicBase = () => (process.env.API_PUBLIC_URL || `http://localhost:${config.port}`).replace(/\/$/, '');

// ---------------------------------------------------------------- resolvers
const populateWithdraw = (query: any) => query.populate('rider').populate('store');

export const adminUserResolvers = {
  Query: {
    users: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requirePlatformReader(context);
      return User.find({ role: 'USER' }).sort({ createdAt: -1 });
    },
    user: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requirePlatformReader(context);
      const user = await User.findById(assertObjectId(id, 'user'));
      if (!user) throw new NotFoundError('User');
      return user;
    },
    ridersByZone: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requirePlatformReader(context);
      return User.find({ role: 'RIDER', isActive: true, zone: assertObjectId(id, 'zone') }).populate('zone').sort({ name: 1 });
    },
    auditLogs: async (_parent: unknown, args: { page?: number; limit?: number }, context: AuthContext) => {
      requireSuperAdmin(context);
      const p = pageParams(args.page, args.limit, 20);
      const [auditLogs, totalCount] = await Promise.all([
        AuditLog.find().populate('admin').sort({ timestamp: -1 }).skip(p.skip).limit(p.limit),
        AuditLog.countDocuments(),
      ]);
      return { auditLogs, totalCount, currentPage: p.page, totalPages: Math.max(1, Math.ceil(totalCount / p.limit)) };
    },
    notifications: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requirePlatformReader(context);
      return Notification.find().sort({ createdAt: -1 }).limit(200);
    },
    webNotifications: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requirePlatformReader(context);
      return WebNotification.find().sort({ createdAt: -1 }).limit(100);
    },

    earnings: async (_parent: unknown, args: any, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      const match = await earningsMatch(args, context);
      const p = pageParams(args.pagination?.pageNo, args.pagination?.pageSize, 10);
      const [orders, total, sums] = await Promise.all([
        Order.find(match).populate('restaurant', 'name username commissionRate').populate('rider', 'name username').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
        Order.countDocuments(match),
        Order.aggregate([
          { $match: match },
          { $lookup: { from: 'restaurants', localField: 'restaurant', foreignField: '_id', as: 'store' } },
          { $addFields: { rate: { $ifNull: [{ $arrayElemAt: ['$store.commissionRate', 0] }, 0] }, hasRider: { $cond: [{ $ne: [{ $ifNull: ['$rider', null] }, null] }, 1, 0] } } },
          {
            $group: {
              _id: null,
              commission: { $sum: { $multiply: ['$orderAmount', { $divide: ['$rate', 100] }] } },
              tax: { $sum: '$taxationAmount' },
              orderAmount: { $sum: '$orderAmount' },
              rider: { $sum: { $multiply: ['$hasRider', { $add: ['$deliveryCharges', '$tipping'] }] } },
            },
          },
        ]),
      ]);
      const sum = sums[0] || { commission: 0, tax: 0, orderAmount: 0, rider: 0 };
      return {
        success: true,
        message: 'Earnings fetched',
        data: {
          earnings: orders.map(earningRow),
          grandTotalEarnings: {
            platformTotal: round2(sum.commission + sum.tax),
            riderTotal: round2(sum.rider),
            storeTotal: round2(sum.orderAmount - sum.commission),
          },
        },
        pagination: { total },
      };
    },

    transactionHistory: async (_parent: unknown, args: any, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      const filter: Record<string, any> = {};
      if (args.userType && args.userType !== 'ALL') filter.userType = args.userType;
      const stores = await scopedStoreIds(context);
      const userId = cleanId(args.userId);
      if (stores) {
        if (userId) await assertStoreAccess(userId, context);
        filter.userType = 'STORE';
        filter.userId = userId ? userId : { $in: stores.map(String) };
      } else if (userId) filter.userId = userId;
      if (args.search) filter.transactionId = { $regex: escapeRegex(args.search), $options: 'i' };
      const range = dateRange(null, args.dateFilter?.starting_date, args.dateFilter?.ending_date);
      if (range) filter.createdAt = range;
      const p = pageParams(args.pagination?.pageNo, args.pagination?.pageSize, 10);
      const [data, total] = await Promise.all([
        Transaction.find(filter).populate('rider').populate('store').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
        Transaction.countDocuments(filter),
      ]);
      return { data, pagination: { total } };
    },

    withdrawRequests: async (_parent: unknown, args: any, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      const filter: Record<string, any> = {};
      const userId = cleanId(args.userId);
      const stores = await scopedStoreIds(context);
      if (stores) {
        if (userId) await assertStoreAccess(userId, context);
        filter.userType = 'STORE';
        filter.store = userId ? new Types.ObjectId(userId) : { $in: stores };
      } else {
        if (args.userType && args.userType !== 'ALL') filter.userType = args.userType;
        if (userId) filter[args.userType === 'RIDER' ? 'rider' : 'store'] = assertObjectId(userId, 'user');
      }
      if (args.search) filter.requestId = { $regex: escapeRegex(args.search), $options: 'i' };
      const p = pageParams(args.pagination?.pageNo, args.pagination?.pageSize, 10);
      const [data, total] = await Promise.all([
        populateWithdraw(WithdrawRequest.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit)),
        WithdrawRequest.countDocuments(filter),
      ]);
      return { success: true, message: 'Withdraw requests fetched', data, pagination: { total } };
    },
  },

  Mutation: {
    // ---------- customers
    updateUserStatus: async (_parent: unknown, args: { id: string; status: string; reason?: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const status = args.status.trim().toUpperCase();
      if (!status || status.length > 30) throw new ValidationError('Invalid status');
      const user = await User.findOne({ _id: assertObjectId(args.id, 'user'), role: 'USER' });
      if (!user) throw new NotFoundError('User');
      user.status = status;
      user.statusReason = args.reason;
      user.isActive = status === 'ACTIVE';
      if (!user.isActive) user.sessionResetAt = new Date();
      await user.save();
      await audit(context, 'updateUserStatus', 'User', user._id, { status, reason: args.reason });
      return user;
    },
    updateUserNotes: async (_parent: unknown, { id, notes }: { id: string; notes: string }, context: AuthContext) => {
      requirePlatformReader(context);
      const user = await User.findOneAndUpdate({ _id: assertObjectId(id, 'user'), role: 'USER' }, { notes: notes.slice(0, 2000) }, { new: true });
      if (!user) throw new NotFoundError('User');
      return user;
    },
    deleteUser: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const user = await User.findOne({ _id: assertObjectId(id, 'user'), role: 'USER' });
      if (!user) throw new NotFoundError('User');
      if (await Order.exists({ user: user._id })) {
        // Keep order history intact: deactivate and blank the account instead of removing it.
        user.isActive = false;
        user.status = 'DELETED';
        user.sessionResetAt = new Date();
        await user.save();
      } else await user.deleteOne();
      await audit(context, 'deleteUser', 'User', id);
      return user;
    },
    resetUserSession: async (_parent: unknown, { userId }: { userId: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const user = await User.findById(assertObjectId(userId, 'user'));
      if (!user) throw new NotFoundError('User');
      user.refreshTokenHash = undefined;
      user.sessionResetAt = new Date();
      await user.save();
      await audit(context, 'resetUserSession', 'User', userId);
      return user;
    },

    // ---------- riders
    createRider: async (_parent: unknown, { riderInput }: { riderInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const username = riderInput.username?.trim();
      if (!username && !riderInput.email) throw new ValidationError('Username is required');
      if (!riderInput.password) throw new ValidationError('Password is required');
      const check = validatePassword(riderInput.password);
      if (!check.isValid) throw new ValidationError(check.message!);
      const email = (riderInput.email || `${username}@riders.invalid`).trim().toLowerCase();
      const phone = isRealString(riderInput.phone) ? riderInput.phone : undefined;
      if (await User.exists({ email })) throw new ValidationError('A user with this email already exists');
      if (username && (await User.exists({ username, role: 'RIDER' }))) throw new ValidationError('Rider username is already taken');
      if (phone && (await User.exists({ phone }))) throw new ValidationError('A user with this phone number already exists');
      const rider = await User.create({
        ...definedOnly({ name: riderInput.name.trim(), username, phone, vehicleType: riderInput.vehicleType, zone: cleanId(riderInput.zone), bussinessDetails: riderInput.bussinessDetails, licenseDetails: riderInput.licenseDetails, vehicleDetails: riderInput.vehicleDetails }),
        email,
        password: await hashPassword(riderInput.password),
        role: 'RIDER',
        isAvailable: riderInput.available ?? true,
        emailVerified: true,
        emailIsVerified: true,
      });
      await audit(context, 'createRider', 'Rider', rider._id);
      return rider.populate('zone');
    },
    editRider: async (_parent: unknown, { riderInput }: { riderInput: any }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'RIDER']);
      const id = assertObjectId(riderInput._id, 'rider');
      if (context.user!.role === 'RIDER' && context.user!.userId !== id) throw new AuthorizationError();
      const rider = await User.findOne({ _id: id, role: 'RIDER', isActive: true });
      if (!rider) throw new NotFoundError('Rider');
      const username = riderInput.username?.trim();
      if (username && username !== rider.username && (await User.exists({ username, role: 'RIDER', _id: { $ne: id } }))) throw new ValidationError('Rider username is already taken');
      const phone = isRealString(riderInput.phone) ? riderInput.phone : undefined;
      if (phone && phone !== rider.phone && (await User.exists({ phone, _id: { $ne: id } }))) throw new ValidationError('A user with this phone number already exists');
      Object.assign(rider, definedOnly({ name: riderInput.name?.trim(), username, phone, vehicleType: riderInput.vehicleType, bussinessDetails: riderInput.bussinessDetails, licenseDetails: riderInput.licenseDetails, vehicleDetails: riderInput.vehicleDetails }));
      if (riderInput.email) rider.email = riderInput.email.trim().toLowerCase();
      if (isSuperAdmin(context)) {
        if (riderInput.zone !== undefined) rider.zone = (cleanId(riderInput.zone) as any) || undefined;
        if (riderInput.available !== undefined && riderInput.available !== null) rider.isAvailable = riderInput.available;
      }
      if (riderInput.password) {
        const check = validatePassword(riderInput.password);
        if (!check.isValid) throw new ValidationError(check.message!);
        rider.password = await hashPassword(riderInput.password);
      }
      await rider.save();
      return rider.populate('zone');
    },
    deleteRider: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const rider = await User.findOneAndUpdate({ _id: assertObjectId(id, 'rider'), role: 'RIDER', isActive: true }, { $set: { isActive: false, isAvailable: false, sessionResetAt: new Date() } }, { new: true });
      if (!rider) throw new NotFoundError('Rider');
      await audit(context, 'deleteRider', 'Rider', id);
      return rider;
    },
    toggleAvailablity: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'RIDER']);
      const riderId = assertObjectId(id, 'rider');
      if (context.user!.role === 'RIDER' && context.user!.userId !== riderId) throw new AuthorizationError();
      const rider = await User.findOne({ _id: riderId, role: 'RIDER', isActive: true });
      if (!rider) throw new NotFoundError('Rider');
      rider.isAvailable = !rider.isAvailable;
      await rider.save();
      return rider.populate('zone');
    },

    // ---------- notifications / uploads
    sendNotificationUser: async (_parent: unknown, args: { notificationTitle?: string; notificationBody: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const body = args.notificationBody.trim();
      if (!body) throw new ValidationError('Notification body is required');
      const users = await User.find({ role: 'USER', isActive: true, isOfferNotification: { $ne: false }, notificationToken: { $exists: true, $ne: null } }).select('notificationToken').limit(5000);
      const title = args.notificationTitle?.trim() || 'Postal';
      for (let i = 0; i < users.length; i += 50) {
        await Promise.allSettled(users.slice(i, i + 50).map((u) => sendPushNotification(u.notificationToken, title, body)));
      }
      await Notification.create({ title, body, sentBy: context.user!.userId, recipients: users.length });
      return true;
    },
    markWebNotificationsAsRead: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requirePlatformReader(context);
      await WebNotification.updateMany({ read: false }, { $set: { read: true } });
      return WebNotification.find().sort({ createdAt: -1 }).limit(100);
    },
    uploadImageToS3: async (_parent: unknown, { image }: { image: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      if (/^https?:\/\//i.test(image)) return { imageUrl: image };
      const match = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(image);
      if (!match) throw new ValidationError('Image must be a base64 data URL');
      const buffer = Buffer.from(match[1], 'base64');
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new ValidationError('Image must be smaller than 8 MB');
      const type = IMAGE_SIGNATURES.find((entry) => entry.test(buffer));
      if (!type) throw new ValidationError('Unsupported image type (use PNG, JPEG, GIF or WebP)');
      const directory = resolve(process.cwd(), 'uploads');
      await mkdir(directory, { recursive: true });
      const name = `${randomUUID()}.${type.ext}`;
      await writeFile(resolve(directory, name), buffer);
      return { imageUrl: `${publicBase()}/uploads/${name}` };
    },
    uploadToken: async (_parent: unknown, { id, pushToken }: { id: string; pushToken: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'VENDOR']);
      const restaurant = await assertStoreAccess(id, context);
      restaurant.notificationToken = pushToken;
      await restaurant.save();
      return { _id: restaurant._id, pushToken };
    },

    // ---------- withdrawals
    createWithdrawRequest: async (_parent: unknown, args: { requestAmount: number; restaurantId?: string }, context: AuthContext) => {
      requireRole(context, ['VENDOR', 'RIDER']);
      const amount = round2(args.requestAmount);
      if (!(amount > 0)) throw new ValidationError('Request amount must be greater than zero');
      let balance = 0;
      const target: Record<string, any> = {};
      if (context.user!.role === 'RIDER') {
        const rider = await User.findById(context.user!.userId);
        if (!rider) throw new NotFoundError('Rider');
        balance = rider.currentWalletAmount;
        Object.assign(target, { userType: 'RIDER', rider: rider._id });
      } else {
        const owned = await Restaurant.find({ owner: context.user!.userId }).select('_id wallet');
        const store = args.restaurantId ? owned.find((r) => idOf(r._id) === args.restaurantId) : owned.length === 1 ? owned[0] : undefined;
        if (!store) throw new ValidationError(owned.length > 1 ? 'restaurantId is required when you own several restaurants' : 'Restaurant not found');
        balance = store.wallet;
        Object.assign(target, { userType: 'STORE', store: store._id });
      }
      const pending = await WithdrawRequest.aggregate([{ $match: { ...target, status: 'REQUESTED' } }, { $group: { _id: null, total: { $sum: '$requestAmount' } } }]);
      if (amount > round2(balance - (pending[0]?.total || 0))) throw new ValidationError('Request amount exceeds your available balance');
      const request = await WithdrawRequest.create({ ...target, requestAmount: amount, requestId: `WR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}` });
      return populateWithdraw(WithdrawRequest.findById(request._id));
    },
    updateWithdrawReqStatus: async (_parent: unknown, { id, status }: { id: string; status: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const next = status.toUpperCase();
      if (!['TRANSFERRED', 'CANCELLED'].includes(next)) throw new ValidationError('Status must be TRANSFERRED or CANCELLED');
      // Atomic claim so a request can only be settled once.
      const request = await WithdrawRequest.findOneAndUpdate({ _id: assertObjectId(id, 'request'), status: 'REQUESTED' }, { $set: { status: next } }, { new: true });
      if (!request) throw new ValidationError('Withdraw request not found or already processed');
      if (next === 'TRANSFERRED') {
        const isRider = request.userType === 'RIDER';
        const owner: any = isRider
          ? await User.findOneAndUpdate({ _id: request.rider, currentWalletAmount: { $gte: request.requestAmount } }, { $inc: { currentWalletAmount: -request.requestAmount, withdrawnWalletAmount: request.requestAmount } }, { new: true })
          : await Restaurant.findOneAndUpdate({ _id: request.store, wallet: { $gte: request.requestAmount } }, { $inc: { wallet: -request.requestAmount, withdrawnWalletAmount: request.requestAmount } }, { new: true });
        if (!owner) {
          await WithdrawRequest.updateOne({ _id: request._id }, { $set: { status: 'REQUESTED' } });
          throw new ValidationError('Insufficient wallet balance to complete this transfer');
        }
        const bank = (owner.bussinessDetails || {}) as Record<string, string>;
        await Transaction.create({
          transactionId: `TX-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`,
          amountTransferred: request.requestAmount,
          userType: request.userType,
          userId: idOf(owner._id),
          rider: isRider ? owner._id : undefined,
          store: isRider ? undefined : owner._id,
          withdrawRequest: request._id,
          toBank: { accountName: bank.accountName, bankName: bank.bankName, accountNumber: bank.accountNumber, accountCode: bank.accountCode },
        });
      }
      await audit(context, 'updateWithdrawReqStatus', 'WithdrawRequest', id, { status: next });
      return { success: true, message: `Withdraw request ${next.toLowerCase()}`, data: await populateWithdraw(WithdrawRequest.findById(request._id)) };
    },
  },
};

export const adminUserFields = {
  User: {
    status: (parent: any) => parent.status || (parent.isActive === false ? 'INACTIVE' : 'ACTIVE'),
    assigned: async (parent: any) => parent.role === 'RIDER' && Boolean(await Order.exists({ rider: parent._id, orderStatus: { $in: ['ASSIGNED', 'PICKED'] } })),
    bussinessDetails: (parent: any) => parent.bussinessDetails ?? null,
    licenseDetails: (parent: any) => parent.licenseDetails ?? null,
    vehicleDetails: (parent: any) => parent.vehicleDetails ?? null,
  },
};
