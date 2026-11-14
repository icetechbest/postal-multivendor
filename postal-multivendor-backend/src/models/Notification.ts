import mongoose, { Document, Schema } from 'mongoose';

// Broadcast push notifications sent from the admin dashboard.
export interface INotification extends Document {
  title?: string;
  body: string;
  sentBy?: mongoose.Types.ObjectId;
  recipients: number;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
  title: String,
  body: { type: String, required: true },
  sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
  recipients: { type: Number, default: 0 },
}, { timestamps: true });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);

// In-dashboard ("web") notifications, e.g. a new order for the admin panel.
export interface IWebNotification extends Document {
  title?: string;
  body: string;
  navigateTo?: string;
  read: boolean;
  createdAt: Date;
}

const webNotificationSchema = new Schema<IWebNotification>({
  title: String,
  body: { type: String, required: true },
  navigateTo: String,
  read: { type: Boolean, default: false, index: true },
}, { timestamps: true });

export const WebNotification = mongoose.model<IWebNotification>('WebNotification', webNotificationSchema);
