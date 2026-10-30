import mongoose, { Document, Schema } from 'mongoose';

export interface IBanner extends Document {
  title: string;
  description?: string;
  action?: string;
  screen?: string;
  file?: string;
  parameters?: Record<string, unknown>;
  isActive: boolean;
}

const bannerSchema = new Schema<IBanner>({
  title: { type: String, required: true },
  description: String,
  action: String,
  screen: String,
  file: String,
  parameters: Schema.Types.Mixed,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

bannerSchema.index({ isActive: 1, createdAt: -1 });
export const Banner = mongoose.model<IBanner>('Banner', bannerSchema);
