import mongoose, { Document, Schema } from 'mongoose';

export interface IOption extends Document {
  restaurant: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  price: number;
  isActive: boolean;
}

const optionSchema = new Schema<IOption>({
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

optionSchema.index({ restaurant: 1, isActive: 1 });
export const RestaurantOption = mongoose.model<IOption>('RestaurantOption', optionSchema);
