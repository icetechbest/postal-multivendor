import mongoose, { Document, Schema } from 'mongoose';

export interface ITipping extends Document {
  tipVariations: number[];
  enabled: boolean;
}

const tippingSchema = new Schema<ITipping>({
  tipVariations: { type: [Number], default: [5, 10, 15, 20] },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

export const Tipping = mongoose.model<ITipping>('Tipping', tippingSchema);
