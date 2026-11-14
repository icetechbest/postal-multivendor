import mongoose, { Document, Schema } from 'mongoose';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface ISupportTicket extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: string;
  category?: string;
  orderId?: string;
  otherDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: String,
  status: { type: String, default: 'open', index: true },
  category: String,
  orderId: String,
  otherDetails: String,
}, { timestamps: true });

supportTicketSchema.index({ user: 1, updatedAt: -1 });
export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);
