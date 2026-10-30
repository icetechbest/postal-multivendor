import { createHash, randomBytes } from 'crypto';
import { Address } from '../../models/Address';
import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';
import config from '../../config';
import { AuthContext, requireAdmin, requireAuth } from '../../middleware/auth';
import { hashPassword } from '../../utils/crypto';
import { AuthorizationError, NotFoundError, ValidationError } from '../../utils/errors';
import { validatePassword } from '../../utils/validation';
import { sendEmail } from '../../services/notifications';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const ownedAddress = async (id: string, userId: string) => {
  const address = await Address.findOne({ _id: id, user: userId });
  if (!address) throw new NotFoundError('Address');
  return address;
};

export const accountResolvers = {
  Query: {
    riders: async (_: unknown, __: unknown, context: AuthContext) => {
      requireAdmin(context);
      return User.find({ role: 'RIDER', isActive: true }).populate('zone').sort({ name: 1 });
    },
    rider: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireAuth(context);
      if (context.user!.role !== 'ADMIN' && context.user!.userId !== id) throw new AuthorizationError();
      return User.findOne({ _id: id, role: 'RIDER', isActive: true }).populate('zone');
    },
    availableRiders: async (_: unknown, { zone }: { zone?: string }, context: AuthContext) => {
      requireAuth(context);
      const filter: any = { role: 'RIDER', isActive: true, isAvailable: true };
      if (zone) filter.zone = zone;
      return User.find(filter).populate('zone').sort({ name: 1 });
    },
  },

  Mutation: {
    createAddress: async (_: unknown, { addressInput }: any, context: AuthContext) => {
      requireAuth(context);
      const userId = context.user!.userId;
      const count = await Address.countDocuments({ user: userId });
      const address: any = await Address.create({
        label: addressInput.label,
        deliveryAddress: addressInput.deliveryAddress,
        details: addressInput.details,
        location: { type: 'Point', coordinates: [addressInput.longitude, addressInput.latitude] },
        user: userId,
        isSelected: count === 0,
      } as any);
      await User.findByIdAndUpdate(userId, { $addToSet: { addresses: address._id } });
      return address;
    },

    editAddress: async (_: unknown, { addressInput }: any, context: AuthContext) => {
      requireAuth(context);
      const address = await ownedAddress(addressInput._id, context.user!.userId);
      const { latitude, longitude, _id, ...updates } = addressInput;
      Object.assign(address, updates);
      if (latitude !== undefined || longitude !== undefined) {
        if (latitude === undefined || longitude === undefined) {
          throw new ValidationError('Latitude and longitude must be provided together');
        }
        address.location.coordinates = [longitude, latitude];
      }
      await address.save();
      return address;
    },

    deleteAddress: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireAuth(context);
      const userId = context.user!.userId;
      const address = await ownedAddress(id, userId);
      const wasSelected = Boolean((address as any).isSelected);
      await address.deleteOne();
      await User.findByIdAndUpdate(userId, { $pull: { addresses: id } });
      if (wasSelected) {
        const next = await Address.findOne({ user: userId }).sort({ createdAt: 1 });
        if (next) {
          (next as any).isSelected = true;
          await next.save();
        }
      }
      return { message: 'Address deleted successfully' };
    },

    selectAddress: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireAuth(context);
      const userId = context.user!.userId;
      const address = await ownedAddress(id, userId);
      await Address.updateMany({ user: userId, _id: { $ne: id } }, { $set: { isSelected: false } });
      (address as any).isSelected = true;
      await address.save();
      return address;
    },

    addFavouriteRestaurant: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireAuth(context);
      const restaurant = await Restaurant.findOne({ _id: id, isActive: true });
      if (!restaurant) throw new NotFoundError('Restaurant');
      const user = await User.findByIdAndUpdate(
        context.user!.userId,
        { $addToSet: { favouriteRestaurants: id } },
        { new: true }
      ).populate('addresses favouriteRestaurants');
      if (!user) throw new NotFoundError('User');
      return user;
    },

    createRider: async (_: unknown, { riderInput }: any, context: AuthContext) => {
      requireAdmin(context);
      const passwordValidation = validatePassword(riderInput.password);
      if (!passwordValidation.isValid) throw new ValidationError(passwordValidation.message!);
      const existing = await User.findOne({ email: riderInput.email.toLowerCase() });
      if (existing) throw new ValidationError('A user with this email already exists');
      return User.create({
        ...riderInput,
        email: riderInput.email.toLowerCase(),
        password: await hashPassword(riderInput.password),
        role: 'RIDER',
      });
    },

    editRider: async (_: unknown, { riderInput }: any, context: AuthContext) => {
      requireAuth(context);
      const updates = { ...riderInput };
      const _id = updates._id;
      delete updates._id;
      delete updates.password;
      if (context.user!.role !== 'ADMIN' && context.user!.userId !== _id) throw new AuthorizationError();
      if (updates.email) updates.email = updates.email.toLowerCase();
      const rider = await User.findOneAndUpdate(
        { _id, role: 'RIDER', isActive: true },
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('zone');
      if (!rider) throw new NotFoundError('Rider');
      return rider;
    },

    deleteRider: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireAdmin(context);
      const rider = await User.findOneAndUpdate(
        { _id: id, role: 'RIDER', isActive: true },
        { $set: { isActive: false, isAvailable: false } },
        { new: true }
      );
      if (!rider) throw new NotFoundError('Rider');
      return { message: 'Rider deleted successfully' };
    },

    toggleAvailablity: async (_: unknown, { id }: { id: string }, context: AuthContext) => {
      requireAuth(context);
      if (context.user!.role !== 'ADMIN' && context.user!.userId !== id) throw new AuthorizationError();
      const rider = await User.findOne({ _id: id, role: 'RIDER', isActive: true });
      if (!rider) throw new NotFoundError('Rider');
      rider.isAvailable = !rider.isAvailable;
      await rider.save();
      return rider;
    },

    forgotPassword: async (_: unknown, { email }: { email: string }) => {
      const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
      if (user) {
        const token = randomBytes(32).toString('hex');
        user.resetPasswordToken = hashToken(token);
        user.resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();
        const resetUrl = `${config.urls.resetPassword}?token=${token}`;
        await sendEmail(user.email, 'Reset your password', `Use this link within one hour to reset your password: ${resetUrl}`);
      }
      return { message: 'If the account exists, a password reset email has been sent' };
    },

    resetPassword: async (_: unknown, { token, password }: { token: string; password: string }) => {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) throw new ValidationError(passwordValidation.message!);
      const user = await User.findOne({
        resetPasswordToken: hashToken(token),
        resetPasswordExpiry: { $gt: new Date() },
        isActive: true,
      }).select('+resetPasswordToken +resetPasswordExpiry +password');
      if (!user) throw new ValidationError('Reset token is invalid or expired');
      user.password = await hashPassword(password);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiry = undefined;
      await user.save();
      return { message: 'Password reset successfully' };
    },
  },
};
