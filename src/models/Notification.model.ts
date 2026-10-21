import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  title: string;
  message: string;
  type: 'order' | 'kitchen' | 'table' | 'delivery' | 'inventory' | 'payment' | 'system' | 'reservation';
  read: boolean;
  time: string;
  recipientRole?: string;
  recipientId?: string;
  targetRoles?: string[];
  orderId?: string;
  tableNumber?: number;
  reservationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['order', 'kitchen', 'table', 'delivery', 'inventory', 'payment', 'system', 'reservation'],
      required: true,
    },
    read: { type: Boolean, default: false },
    time: { type: String, default: 'Just now' },
    recipientRole: { type: String },
    recipientId: { type: String },
    targetRoles: { type: [String], default: [] },
    orderId: { type: String },
    tableNumber: { type: Number },
    reservationId: { type: String },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
