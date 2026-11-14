import mongoose, { Document, Schema } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  title?: string;
  discount: number;
  expiresAt?: Date;
  startDate?: Date;
  endDate?: Date;
  lifeTimeActive: boolean;
  isActive: boolean;
  isEnabled: boolean;
  restaurant?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: String,
    expiresAt: Date,
    startDate: Date,
    endDate: Date,
    lifeTimeActive: { type: Boolean, default: false },
    discount: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
couponSchema.index({ restaurant: 1 });
couponSchema.index({ isActive: 1, isEnabled: 1 });

export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);
