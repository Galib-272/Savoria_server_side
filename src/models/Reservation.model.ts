import mongoose, { Document, Schema } from 'mongoose';
import { ReservationStatus } from '../types/index.js';

export interface IReservation extends Document {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerId?: string;
  date: string;              // 'YYYY-MM-DD'
  time: string;              // e.g. '7:00 PM'
  guests: number;
  tableNumber: number;       // 1 to 25
  seats: string[];           // ['S1', 'S2', etc.]
  specialRequest?: string;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String },
    customerId: { type: String },
    date: { type: String, required: true },
    time: { type: String, required: true },
    guests: { type: Number, required: true, min: 1 },
    tableNumber: { type: Number, required: true, min: 1, max: 25 },
    seats: [{ type: String, enum: ['S1', 'S2', 'S3', 'S4'] }],
    specialRequest: { type: String },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
      default: 'confirmed',
    },
  },
  { timestamps: true }
);

// Index to prevent overlapping seat reservations on same date & time & table
ReservationSchema.index({ date: 1, time: 1, tableNumber: 1, status: 1 });

export const Reservation = mongoose.model<IReservation>('Reservation', ReservationSchema);
