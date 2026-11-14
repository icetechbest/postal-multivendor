import mongoose, { Document, Schema } from 'mongoose';

/**
 * Ledger of every money movement on a rider's or a customer's wallet.
 *
 * Rider wallet has two separate numbers on the User document:
 *   - currentWalletAmount : the rider's earnings balance (what the company owes the rider)
 *   - commissionDebt      : what the rider owes the company (platform commission, customer change kept in cash...)
 *
 * Types:
 *   EARNING          (+wallet)  delivery fee + tip credited when an order is delivered
 *   COMMISSION       (+debt)    platform commission charged on that order
 *   DEBT_PAYMENT     (-debt)    rider paid the company in cash (admin recorded it)
 *   DEBT_OFFSET      (-debt, -wallet) admin settled the debt from the rider's wallet earnings
 *   WALLET_ADJUST    (+/-wallet) manual admin correction
 *   DEBT_ADJUST      (+/-debt)   manual admin correction
 *   CUSTOMER_CHANGE  (+debt)    rider kept the cash change and credited the customer's wallet instead
 *   WALLET_CREDIT    (+wallet)  customer wallet credited with the change (ownerType CUSTOMER)
 *   CASH_IN          (+cash)    rider collected cash-on-delivery money (balance CASH = cash the rider holds for the company)
 *   CASH_HANDOVER    (-cash)    rider handed the collected cash to the company (admin recorded it)
 *   WALLET_DEBIT     (-wallet)  customer paid part/all of an order from the wallet (ownerType CUSTOMER)
 *   WALLET_REFUND    (+wallet)  wallet payment returned because the order was cancelled (ownerType CUSTOMER)
 */
export type WalletTxType =
  | 'EARNING'
  | 'COMMISSION'
  | 'DEBT_PAYMENT'
  | 'DEBT_OFFSET'
  | 'WALLET_ADJUST'
  | 'DEBT_ADJUST'
  | 'CUSTOMER_CHANGE'
  | 'WALLET_CREDIT'
  | 'CASH_IN'
  | 'CASH_HANDOVER'
  | 'WALLET_DEBIT'
  | 'WALLET_REFUND';

export interface IWalletTransaction extends Document {
  owner: mongoose.Types.ObjectId;
  ownerType: 'RIDER' | 'CUSTOMER';
  type: WalletTxType;
  /** Always positive: the direction is implied by `type` / `direction`. */
  amount: number;
  /** +1 increases the affected balance, -1 decreases it. */
  direction: 1 | -1;
  /** Which balance moved. */
  balance: 'WALLET' | 'DEBT' | 'CASH';
  walletAfter?: number;
  debtAfter?: number;
  order?: mongoose.Types.ObjectId;
  note?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerType: { type: String, enum: ['RIDER', 'CUSTOMER'], required: true },
    type: {
      type: String,
      enum: ['EARNING', 'COMMISSION', 'DEBT_PAYMENT', 'DEBT_OFFSET', 'WALLET_ADJUST', 'DEBT_ADJUST', 'CUSTOMER_CHANGE', 'WALLET_CREDIT', 'CASH_IN', 'CASH_HANDOVER', 'WALLET_DEBIT', 'WALLET_REFUND'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    direction: { type: Number, enum: [1, -1], required: true },
    balance: { type: String, enum: ['WALLET', 'DEBT', 'CASH'], required: true },
    walletAfter: Number,
    debtAfter: Number,
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    note: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ owner: 1, createdAt: -1 });
// One earning / commission / change entry per order: makes settlement idempotent even under races.
walletTransactionSchema.index(
  { order: 1, owner: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: { $in: ['EARNING', 'COMMISSION', 'CUSTOMER_CHANGE', 'WALLET_CREDIT', 'CASH_IN', 'WALLET_DEBIT', 'WALLET_REFUND'] }, order: { $exists: true } } }
);

export const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', walletTransactionSchema);
