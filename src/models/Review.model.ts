import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  customerName: string;
  customerId?: string;
  rating: number;
  comment: string;
  date: string;
  orderId?: string;
  menuItemId?: string;
  avatar?: string;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    customerName: { type: String, required: true },
    customerId: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    orderId: { type: String },
    menuItemId: { type: String },
    avatar: { type: String },
    approved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
