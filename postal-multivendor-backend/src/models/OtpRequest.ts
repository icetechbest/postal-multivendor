import mongoose, { Document, Schema } from 'mongoose';

export interface IOtpRequest extends Document {
  target: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  requestedAt: Date;
  verifiedAt?: Date;
}

const otpRequestSchema = new Schema<IOtpRequest>({
  target: { type: String, required: true, unique: true, index: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  requestedAt: { type: Date, default: Date.now },
  verifiedAt: Date,
}, { timestamps: true });

otpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
export const OtpRequest = mongoose.model<IOtpRequest>('OtpRequest', otpRequestSchema);
