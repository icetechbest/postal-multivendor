import mongoose, { Document, Schema } from 'mongoose';

export interface IOrder extends Document {
  orderId: string;
  restaurant: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  items: any[];
  deliveryAddress: any;
  orderAmount: number;
  deliveryCharges: number;
  tipping: number;
  taxationAmount: number;
  discount: number;
  total: number;
  paymentMethod: 'COD' | 'CARD' | 'PAYPAL' | 'STRIPE' | 'HYP';
  paidAmount: number;
  orderStatus: 'PENDING' | 'ACCEPTED' | 'ASSIGNED' | 'PICKED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
  paymentReference?: string;
  reason?: string;
  isActive: boolean;
  isRinged: boolean;
  isRiderRinged: boolean;
  isPickedUp: boolean;
  instructions?: string;
  rider?: mongoose.Types.ObjectId;
  riderAssignedAt?: Date;
  assignedAt?: Date;
  acceptedAt?: Date;
  pickedAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  estimatedDeliveryTime?: Date;
  expectedTime?: Date;
  completionTime?: Date;
  orderDate?: Date;
  preparationTime?: number;
  review?: any;
  isReviewed: boolean;
  couponCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const optionSnapshot = new Schema({
  title: String,
  description: String,
  price: { type: Number, default: 0 },
}, { _id: true });

const addonSnapshot = new Schema({
  title: String,
  description: String,
  quantityMinimum: { type: Number, default: 0 },
  quantityMaximum: { type: Number, default: 1 },
  options: { type: [optionSnapshot], default: [] },
}, { _id: true });

const orderItemSchema = new Schema({
  food: { type: Schema.Types.ObjectId, ref: 'Food', required: true },
  title: String,
  description: String,
  image: String,
  quantity: { type: Number, required: true, min: 1 },
  variation: {
    _id: Schema.Types.ObjectId,
    title: String,
    price: Number,
    discounted: Number,
  },
  addons: { type: [addonSnapshot], default: [] },
  specialInstructions: String,
  isActive: { type: Boolean, default: true },
  isOutOfStock: { type: Boolean, default: false },
  createdAt: Date,
  updatedAt: Date,
}, { _id: true });

const orderSchema = new Schema<IOrder>({
  orderId: { type: String, required: true, unique: true },
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: { type: [orderItemSchema], default: [] } as any,
  deliveryAddress: {
    id: String,
    label: String,
    deliveryAddress: String,
    details: String,
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
  },
  orderAmount: { type: Number, required: true, min: 0 },
  deliveryCharges: { type: Number, default: 0, min: 0 },
  tipping: { type: Number, default: 0, min: 0 },
  taxationAmount: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['COD', 'CARD', 'PAYPAL', 'STRIPE', 'HYP'], required: true },
  paidAmount: { type: Number, default: 0, min: 0 },
  orderStatus: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'ASSIGNED', 'PICKED', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
  },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'REFUNDED', 'FAILED'], default: 'PENDING' },
  paymentReference: String,
  reason: String,
  isActive: { type: Boolean, default: true },
  isRinged: { type: Boolean, default: false },
  isRiderRinged: { type: Boolean, default: false },
  isPickedUp: { type: Boolean, default: false },
  instructions: String,
  rider: { type: Schema.Types.ObjectId, ref: 'User' },
  riderAssignedAt: Date,
  assignedAt: Date,
  acceptedAt: Date,
  pickedAt: Date,
  deliveredAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  estimatedDeliveryTime: Date,
  expectedTime: Date,
  completionTime: Date,
  orderDate: Date,
  preparationTime: Number,
  review: { type: Schema.Types.ObjectId, ref: 'Review' },
  isReviewed: { type: Boolean, default: false },
  couponCode: String,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

orderSchema.index({ restaurant: 1, orderStatus: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ rider: 1, orderStatus: 1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'deliveryAddress.location': '2dsphere' });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
