import mongoose, { Document, Schema } from 'mongoose';

export interface ICuisine extends Document {
  name: string;
  description?: string;
  image?: string;
  shopType?: string;
  isActive: boolean;
}

const cuisineSchema = new Schema<ICuisine>({
  name: { type: String, required: true, unique: true, trim: true },
  description: String,
  image: String,
  shopType: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

cuisineSchema.index({ isActive: 1, shopType: 1 });
export const Cuisine = mongoose.model<ICuisine>('Cuisine', cuisineSchema);
