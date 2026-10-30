import mongoose, { Document, Schema } from 'mongoose';

export interface IActivity extends Document {
  user?: mongoose.Types.ObjectId;
  groupId: string;
  module: string;
  screenPath: string;
  type: string;
  details: string;
}

const activitySchema = new Schema<IActivity>({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  groupId: { type: String, required: true },
  module: { type: String, required: true },
  screenPath: { type: String, required: true },
  type: { type: String, required: true },
  details: { type: String, required: true, maxlength: 4000 },
}, { timestamps: true });

activitySchema.index({ groupId: 1, createdAt: -1 });
export const Activity = mongoose.model<IActivity>('Activity', activitySchema);
