import mongoose, { Document, Schema } from 'mongoose';

export interface IShopType extends Document {
  name: string;
  image?: string;
  isActive: boolean;
}

const shopTypeSchema = new Schema<IShopType>({
  name: { type: String, required: true, unique: true, trim: true },
  image: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const ShopType = mongoose.model<IShopType>('ShopType', shopTypeSchema);
