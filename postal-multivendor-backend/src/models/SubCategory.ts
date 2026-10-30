import mongoose, { Document, Schema } from 'mongoose';

export interface ISubCategory extends Document {
  title: string;
  parentCategoryId: string;
  isActive: boolean;
}

const subCategorySchema = new Schema<ISubCategory>({
  title: { type: String, required: true },
  parentCategoryId: { type: String, required: true, index: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

subCategorySchema.index({ parentCategoryId: 1, title: 1 });
export const SubCategory = mongoose.model<ISubCategory>('SubCategory', subCategorySchema);
