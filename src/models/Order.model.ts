import mongoose, { Document, Schema } from 'mongoose';
import { OrderType, OrderStatus, PaymentStatus, PaymentMethod } from '../types/index.js';

export interface IOrderItemModifier {
  name: string;
  price: number;
}

export interface IOrderItem {
  menuItemId?: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: IOrderItemModifier[] | string[];
}

export interface IOrderTimeline {
  time: string;
  status: string;
  label: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string;
  orderType: OrderType;
  tableNumber?: number;
  seats?: string[];
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  status: OrderStatus;
  waiterId?: string;
  waiterName?: string;
  cashierId?: string;
  cashierName?: string;
  kitchenStaffId?: string;
  kitchenStaffName?: string;
  deliveryStaffId?: string;
  deliveryStaffName?: string;
  address?: string;
  notes?: string;
  timeline: IOrderTimeline[];
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  paidAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  couponCode?: string;
  inventoryDeducted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItemId: { type: String },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    modifiers: { type: Schema.Types.Mixed, default: [] },
  },
  { _id: false }
);

const OrderTimelineSchema = new Schema<IOrderTimeline>(
  {
    time: { type: String, required: true },
    status: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    customerEmail: { type: String },
    customerId: { type: String },
    orderType: {
      type: String,
      enum: ['dine-in', 'takeaway', 'delivery'],
      required: true,
      default: 'dine-in',
    },
    tableNumber: { type: Number },
    seats: [{ type: String }],
    items: [OrderItemSchema],
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'mobile_banking', 'bank_transfer', 'stripe'],
    },
    status: {
      type: String,
      enum: [
        'new',
        'confirmed',
        'preparing',
        'ready',
        'served',
        'assigned',
        'picked_up',
        'out_for_delivery',
        'delivered',
        'completed',
        'cancelled',
      ],
      default: 'new',
    },
    waiterId: { type: String },
    waiterName: { type: String },
    cashierId: { type: String },
    cashierName: { type: String },
    kitchenStaffId: { type: String },
    kitchenStaffName: { type: String },
    deliveryStaffId: { type: String },
    deliveryStaffName: { type: String },
    address: { type: String },
    notes: { type: String },
    timeline: [OrderTimelineSchema],
    stripePaymentIntentId: { type: String },
    stripeChargeId: { type: String },
    paidAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    couponCode: { type: String },
    inventoryDeducted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
