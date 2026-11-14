import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  order: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  rating: number;
  description?: string;
  isActive: boolean;
}

const reviewSchema = new Schema<IReview>({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  description: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

reviewSchema.index({ restaurant: 1, isActive: 1, createdAt: -1 });
export const Review = mongoose.model<IReview>('Review', reviewSchema);
