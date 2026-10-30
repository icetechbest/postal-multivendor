import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  title: string;
  description?: string;
  image?: string;
  restaurant?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: String,
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', index: true },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
categorySchema.index({ isActive: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
