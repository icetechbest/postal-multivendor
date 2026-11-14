import mongoose, { Document, Schema } from 'mongoose';

export interface ITicketMessage extends Document {
  ticket: mongoose.Types.ObjectId;
  content: string;
  senderType: 'user' | 'admin';
  sender?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ticketMessageSchema = new Schema<ITicketMessage>({
  ticket: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },
  content: { type: String, required: true, maxlength: 4000 },
  senderType: { type: String, enum: ['user', 'admin'], required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User' },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

ticketMessageSchema.index({ ticket: 1, createdAt: -1 });
export const TicketMessage = mongoose.model<ITicketMessage>('TicketMessage', ticketMessageSchema);
