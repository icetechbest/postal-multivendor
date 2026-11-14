import mongoose, { Document, Schema } from 'mongoose';

export interface IConfiguration extends Document {
  key: string;
  [key: string]: unknown;
}

const configurationSchema = new Schema<IConfiguration>(
  { key: { type: String, required: true, unique: true, default: 'default' } },
  { timestamps: true, strict: false, minimize: false }
);

export const Configuration = mongoose.model<IConfiguration>('Configuration', configurationSchema);
