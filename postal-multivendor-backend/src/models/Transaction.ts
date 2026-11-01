import mongoose, { Document, Schema } from 'mongoose';

// Payout record created when a withdraw request is marked TRANSFERRED.
export interface ITransaction extends Document {
  transactionId: string;
  amountCurrency: string;
  amountTransferred: number;
  status: string;
  userType: 'RIDER' | 'STORE';
  userId: string;
  toBank?: { accountName?: string; bankName?: string; accountNumber?: string; accountCode?: string };
  rider?: mongoose.Types.ObjectId;
  store?: mongoose.Types.ObjectId;
  withdrawRequest?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  transactionId: { type: String, required: true, unique: true },
  amountCurrency: { type: String, default: 'USD' },
  amountTransferred: { type: Number, required: true, min: 0 },
  status: { type: String, default: 'TRANSFERRED' },
  userType: { type: String, enum: ['RIDER', 'STORE'], required: true },
  userId: { type: String, required: true, index: true },
  toBank: { accountName: String, bankName: String, accountNumber: String, accountCode: String },
  rider: { type: Schema.Types.ObjectId, ref: 'User' },
  store: { type: Schema.Types.ObjectId, ref: 'Restaurant' },
  withdrawRequest: { type: Schema.Types.ObjectId, ref: 'WithdrawRequest' },
}, { timestamps: true });

transactionSchema.index({ userType: 1, createdAt: -1 });
export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
