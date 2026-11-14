import mongoose, { Document, Schema } from 'mongoose';

/**
 * Ledger of every coin movement. The unique partial index on (order, type=EARN)
 * is what makes awarding idempotent: an order can only ever earn coins once,
 * no matter how many code paths mark it as delivered.
 */
export interface ICoinTransaction extends Document {
  user: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  type: 'EARN' | 'REDEEM' | 'REFUND' | 'ADJUST';
  coins: number;
  /** Order subtotal the coins were calculated from. */
  orderAmount?: number;
  /** Earn rate (coins per 1 currency unit) that was active when the coins were awarded. */
  rate?: number;
  /** Currency value of one coin at award time (for reporting). */
  coinValue?: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const coinTransactionSchema = new Schema<ICoinTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    type: { type: String, enum: ['EARN', 'REDEEM', 'REFUND', 'ADJUST'], required: true },
    coins: { type: Number, required: true },
    orderAmount: Number,
    rate: Number,
    coinValue: Number,
    note: String,
  },
  { timestamps: true }
);

coinTransactionSchema.index(
  { order: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'EARN', order: { $exists: true } } }
);
coinTransactionSchema.index({ user: 1, createdAt: -1 });

export const CoinTransaction = mongoose.model<ICoinTransaction>('CoinTransaction', coinTransactionSchema);
