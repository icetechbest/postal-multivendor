import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage extends Document {
  order: mongoose.Types.ObjectId;
  message: string;
  user: { id: string; name: string };
}

const chatMessageSchema = new Schema<IChatMessage>({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  message: { type: String, required: true, maxlength: 4000 },
  user: {
    id: { type: String, required: true },
    name: { type: String, required: true },
  },
}, { timestamps: true });

chatMessageSchema.index({ order: 1, createdAt: 1 });
export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
