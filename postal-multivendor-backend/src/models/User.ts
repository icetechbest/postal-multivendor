import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  phoneIsVerified: boolean;
  emailIsVerified: boolean;
  role: 'USER' | 'VENDOR' | 'RIDER' | 'ADMIN' | 'STAFF';
  isActive: boolean;
  isOrderNotification: boolean;
  isOfferNotification: boolean;
  isAvailable: boolean;
  zone?: mongoose.Types.ObjectId;
  location?: { type: string; coordinates: number[] };
  username?: string;
  image?: string;
  accountNumber?: string;
  currentWalletAmount: number;
  totalWalletAmount: number;
  withdrawnWalletAmount: number;
  notificationToken?: string;
  addresses: mongoose.Types.ObjectId[];
  favouriteRestaurants: mongoose.Types.ObjectId[];
  socialProvider?: 'google' | 'facebook' | 'apple';
  socialId?: string;
  avatar?: string;
  otp?: string;
  otpExpiry?: Date;
  otpAttempts: number;
  otpRequestedAt?: Date;
  resetPasswordVerifiedAt?: Date;
  refreshTokenHash?: string;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  // Admin-dashboard fields
  firstName?: string;
  lastName?: string;
  permissions: string[];
  status: string;
  statusReason?: string;
  lastLogin?: Date;
  notes?: string;
  vehicleType?: string;
  bussinessDetails?: Record<string, unknown>;
  licenseDetails?: Record<string, unknown>;
  vehicleDetails?: Record<string, unknown>;
  sessionResetAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneIsVerified: {
      type: Boolean,
      default: false,
    },
    emailIsVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['USER', 'VENDOR', 'RIDER', 'ADMIN', 'STAFF'],
      default: 'USER',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isOrderNotification: {
      type: Boolean,
      default: true,
    },
    isOfferNotification: {
      type: Boolean,
      default: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    username: String,
    firstName: String,
    lastName: String,
    permissions: { type: [String], default: [] },
    status: { type: String, default: 'ACTIVE' },
    statusReason: String,
    lastLogin: Date,
    notes: String,
    vehicleType: String,
    bussinessDetails: Schema.Types.Mixed,
    licenseDetails: Schema.Types.Mixed,
    vehicleDetails: Schema.Types.Mixed,
    sessionResetAt: { type: Date, select: false },
    image: String,
    accountNumber: String,
    currentWalletAmount: { type: Number, default: 0 },
    totalWalletAmount: { type: Number, default: 0 },
    withdrawnWalletAmount: { type: Number, default: 0 },
    zone: {
      type: Schema.Types.ObjectId,
      ref: 'Zone',
    },
    notificationToken: String,
    addresses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Address',
      },
    ],
    favouriteRestaurants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Restaurant',
      },
    ],
    socialProvider: {
      type: String,
      enum: ['google', 'facebook', 'apple'],
    },
    socialId: String,
    avatar: String,
    otp: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    otpAttempts: { type: Number, default: 0, select: false },
    otpRequestedAt: { type: Date, select: false },
    resetPasswordVerifiedAt: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpiry: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ socialId: 1, socialProvider: 1 });
userSchema.index({ location: '2dsphere' });

export const User = mongoose.model<IUser>('User', userSchema);
