import mongoose, { Document, Schema } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '../types/index.js';

export interface ISplitPayment {
  customerName: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt?: Date;
}

export interface IPayment extends Document {
  orderId: string;
  orderNumber: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashierId?: string;
  cashierName?: string;
  receiptNumber: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  splitPayments: ISplitPayment[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SplitPaymentSchema = new Schema<ISplitPayment>(
  {
    customerName: { type: String, required: true },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ['cash', 'card', 'mobile_banking', 'bank_transfer', 'stripe'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'refunded'],
      default: 'paid',
    },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: { type: String, required: true },
    orderNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'mobile_banking', 'bank_transfer', 'stripe'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'refunded'],
      default: 'paid',
    },
    cashierId: { type: String },
    cashierName: { type: String },
    receiptNumber: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String },
    stripeChargeId: { type: String },
    splitPayments: [SplitPaymentSchema],
    notes: { type: String },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
