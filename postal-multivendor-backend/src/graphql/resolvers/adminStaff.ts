import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';
import { AuthContext, requireRole } from '../../middleware/auth';
import { comparePassword, hashPassword } from '../../utils/crypto';
import { AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from '../../utils/errors';
import { generateToken } from '../../utils/jwt';
import { validateEmail, validatePassword } from '../../utils/validation';
import { idOf } from './appHelpers';
import { assertObjectId, audit, cleanId, requireSuperAdmin } from './adminHelpers';

const blank = (value: unknown): string | undefined => {
  const text = cleanId(value);
  return text && text !== 'undefined' ? text : undefined;
};

const ensureUnique = async (email: string | undefined, phone: string | undefined, excludeId?: string) => {
  const notSelf = excludeId ? { _id: { $ne: excludeId } } : {};
  if (email && (await User.exists({ email, ...notSelf }))) throw new ValidationError('A user with this email already exists');
  if (phone && (await User.exists({ phone, ...notSelf }))) throw new ValidationError('A user with this phone number already exists');
};

const checkedPassword = async (password: string) => {
  const result = validatePassword(password);
  if (!result.isValid) throw new ValidationError(result.message!);
  return hashPassword(password);
};

const normalizedEmail = (email?: string) => {
  const value = email?.trim().toLowerCase();
  if (!value || !validateEmail(value)) throw new ValidationError('A valid email address is required');
  return value;
};

export const adminStaffResolvers = {
  Query: {
    staffs: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requireSuperAdmin(context);
      return User.find({ role: 'STAFF' }).sort({ createdAt: -1 });
    },
    vendors: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF']);
      return User.find({ role: 'VENDOR' }).sort({ createdAt: -1 });
    },
    getVendor: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
      const vendorId = assertObjectId(id, 'vendor');
      if (context.user!.role === 'VENDOR' && context.user!.userId !== vendorId) throw new AuthorizationError();
      const vendor = await User.findOne({ _id: vendorId, role: 'VENDOR' });
      if (!vendor) throw new NotFoundError('Vendor');
      return vendor;
    },
  },

  Mutation: {
    // Superset of the original resolver: staff may sign in too, and the payload carries their permissions.
    ownerLogin: async (_parent: unknown, { email, password }: { email: string; password: string }) => {
      const normalized = normalizedEmail(email);
      const user = await User.findOne({ email: normalized, role: { $in: ['VENDOR', 'ADMIN', 'STAFF'] } }).select('+password');
      if (!user || !user.password || !(await comparePassword(password, user.password))) throw new AuthenticationError('Invalid credentials');
      if (!user.isActive) throw new AuthenticationError('Account is deactivated');
      const token = generateToken({ userId: idOf(user._id), email: user.email, role: user.role });
      await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
      user.password = undefined;
      const restaurants = user.role === 'VENDOR' ? await Restaurant.find({ owner: user._id }) : [];
      return {
        userId: idOf(user._id),
        token,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        userType: user.role,
        permissions: user.permissions || [],
        userTypeId: idOf(user._id),
        image: user.image || user.avatar || null,
        shopType: restaurants[0]?.shopType,
        restaurants,
        user,
      };
    },

    createStaff: async (_parent: unknown, { staffInput }: { staffInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const email = normalizedEmail(staffInput.email);
      if (!staffInput.password) throw new ValidationError('Password is required');
      const phone = blank(staffInput.phone);
      await ensureUnique(email, phone);
      const staff = await User.create({
        name: staffInput.name.trim(),
        email,
        phone,
        password: await checkedPassword(staffInput.password),
        role: 'STAFF',
        isActive: staffInput.isActive ?? true,
        permissions: staffInput.permissions || [],
        emailVerified: true,
        emailIsVerified: true,
      });
      await audit(context, 'createStaff', 'Staff', staff._id, { permissions: staff.permissions });
      return staff;
    },
    editStaff: async (_parent: unknown, { staffInput }: { staffInput: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      const staff = await User.findOne({ _id: assertObjectId(staffInput._id, 'staff'), role: 'STAFF' });
      if (!staff) throw new NotFoundError('Staff');
      const email = normalizedEmail(staffInput.email);
      const phone = blank(staffInput.phone);
      await ensureUnique(email, phone, idOf(staff._id));
      staff.name = staffInput.name.trim();
      staff.email = email;
      if (phone !== undefined) staff.phone = phone;
      if (staffInput.isActive !== undefined && staffInput.isActive !== null) staff.isActive = staffInput.isActive;
      if (staffInput.permissions) staff.permissions = staffInput.permissions;
      if (staffInput.password) staff.password = await checkedPassword(staffInput.password);
      await staff.save();
      await audit(context, 'editStaff', 'Staff', staff._id, { permissions: staff.permissions, isActive: staff.isActive });
      return staff;
    },
    deleteStaff: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const staff = await User.findOneAndDelete({ _id: assertObjectId(id, 'staff'), role: 'STAFF' });
      if (!staff) throw new NotFoundError('Staff');
      await audit(context, 'deleteStaff', 'Staff', id);
      return staff;
    },

    createVendor: async (_parent: unknown, { vendorInput }: { vendorInput?: any }, context: AuthContext) => {
      requireSuperAdmin(context);
      if (!vendorInput) throw new ValidationError('Vendor details are required');
      const email = normalizedEmail(vendorInput.email);
      if (!vendorInput.password) throw new ValidationError('Password is required');
      const phone = blank(vendorInput.phoneNumber);
      await ensureUnique(email, phone);
      const name = (vendorInput.name || `${vendorInput.firstName || ''} ${vendorInput.lastName || ''}`).trim();
      if (!name) throw new ValidationError('Vendor name is required');
      const vendor = await User.create({
        name,
        firstName: vendorInput.firstName,
        lastName: vendorInput.lastName,
        email,
        phone,
        image: vendorInput.image || undefined,
        password: await checkedPassword(vendorInput.password),
        role: 'VENDOR',
        emailVerified: true,
        emailIsVerified: true,
      });
      await audit(context, 'createVendor', 'Vendor', vendor._id);
      return vendor;
    },
    editVendor: async (_parent: unknown, { vendorInput }: { vendorInput?: any }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'VENDOR']);
      const id = assertObjectId(vendorInput?._id, 'vendor');
      if (context.user!.role === 'VENDOR' && context.user!.userId !== id) throw new AuthorizationError();
      const vendor = await User.findOne({ _id: id, role: 'VENDOR' });
      if (!vendor) throw new NotFoundError('Vendor');
      const email = vendorInput.email ? normalizedEmail(vendorInput.email) : undefined;
      const phone = blank(vendorInput.phoneNumber);
      await ensureUnique(email, phone, id);
      if (email) vendor.email = email;
      if (phone !== undefined) vendor.phone = phone;
      if (vendorInput.firstName !== undefined) vendor.firstName = vendorInput.firstName;
      if (vendorInput.lastName !== undefined) vendor.lastName = vendorInput.lastName;
      if (vendorInput.name?.trim()) vendor.name = vendorInput.name.trim();
      if (vendorInput.image !== undefined && vendorInput.image !== null) vendor.image = vendorInput.image;
      if (vendorInput.password) {
        vendor.password = await checkedPassword(vendorInput.password);
        vendor.refreshTokenHash = undefined;
      }
      await vendor.save();
      await audit(context, 'editVendor', 'Vendor', vendor._id);
      return vendor;
    },
    deleteVendor: async (_parent: unknown, { id }: { id: string }, context: AuthContext) => {
      requireSuperAdmin(context);
      const vendor = await User.findOne({ _id: assertObjectId(id, 'vendor'), role: 'VENDOR' });
      if (!vendor) throw new NotFoundError('Vendor');
      if (await Restaurant.exists({ owner: vendor._id })) throw new ValidationError('Vendor still owns restaurants; delete or reassign them first');
      await vendor.deleteOne();
      await audit(context, 'deleteVendor', 'Vendor', id);
      return true;
    },
  },
};

export const adminStaffFields = {
  Staff: {
    userType: () => 'STAFF',
    password: () => null,
    plainPassword: () => null,
    permissions: (parent: any) => parent.permissions || [],
  },
  Vendor: {
    unique_id: (parent: any) => `VND-${idOf(parent._id).slice(-8).toUpperCase()}`,
    userType: (parent: any) => parent.role || 'VENDOR',
    phoneNumber: (parent: any) => parent.phone ?? null,
    firstName: (parent: any) => parent.firstName ?? (parent.name ? String(parent.name).split(' ')[0] : null),
    lastName: (parent: any) => parent.lastName ?? (parent.name ? String(parent.name).split(' ').slice(1).join(' ') || null : null),
    image: (parent: any) => parent.image || parent.avatar || null,
    password: () => null,
    plainPassword: () => null,
    restaurants: (parent: any) => Restaurant.find({ owner: parent._id }).sort({ createdAt: -1 }),
  },
};
