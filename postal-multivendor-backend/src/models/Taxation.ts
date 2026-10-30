import mongoose, { Document, Schema } from 'mongoose';

export interface ITaxation extends Document {
  taxationCharges: number;
  enabled: boolean;
}

const taxationSchema = new Schema<ITaxation>({
  taxationCharges: { type: Number, default: 5, min: 0 },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

export const Taxation = mongoose.model<ITaxation>('Taxation', taxationSchema);
