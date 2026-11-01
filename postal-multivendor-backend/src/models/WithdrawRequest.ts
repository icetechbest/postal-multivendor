import mongoose, { Document, Schema } from 'mongoose';

export interface IWithdrawRequest extends Document {
  requestId: string;
  requestAmount: number;
  requestTime: Date;
  status: 'REQUESTED' | 'TRANSFERRED' | 'CANCELLED';
  userType: 'RIDER' | 'STORE';
  rider?: mongoose.Types.ObjectId;
  store?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawRequestSchema = new Schema<IWithdrawRequest>({
  requestId: { type: String, required: true, unique: true },
  requestAmount: { type: Number, required: true, min: 0 },
  requestTime: { type: Date, default: Date.now },
  status: { type: String, enum: ['REQUESTED', 'TRANSFERRED', 'CANCELLED'], default: 'REQUESTED', index: true },
  userType: { type: String, enum: ['RIDER', 'STORE'], required: true },
  rider: { type: Schema.Types.ObjectId, ref: 'User' },
  store: { type: Schema.Types.ObjectId, ref: 'Restaurant' },
}, { timestamps: true });

withdrawRequestSchema.index({ userType: 1, createdAt: -1 });
export const WithdrawRequest = mongoose.model<IWithdrawRequest>('WithdrawRequest', withdrawRequestSchema);
