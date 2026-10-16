import mongoose, { Document, Schema } from 'mongoose';
import { TableStatus, SeatStatus } from '../types/index.js';

export interface ISeat {
  seatNumber: 'S1' | 'S2' | 'S3' | 'S4';
  status: SeatStatus;
  currentCustomerName?: string;
  reservationId?: string;
  orderId?: string;
}

export interface ITable extends Document {
  number: number;           // 1 to 25
  tableName: string;        // "T1" to "T25"
  capacity: number;         // 4
  section: string;          // "Main", "Window", "Patio", "VIP"
  status: TableStatus;      // "available", "occupied", "reserved", "cleaning", "out_of_service"
  currentOrderId?: string;
  currentWaiterId?: string;
  waiterName?: string;
  seats: ISeat[];
}

const SeatSchema = new Schema<ISeat>(
  {
    seatNumber: {
      type: String,
      enum: ['S1', 'S2', 'S3', 'S4'],
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved'],
      default: 'available',
    },
    currentCustomerName: { type: String },
    reservationId: { type: String },
    orderId: { type: String },
  },
  { _id: false }
);

const TableSchema = new Schema<ITable>(
  {
    number: { type: Number, required: true, unique: true, min: 1, max: 25 },
    tableName: { type: String, required: true },
    capacity: { type: Number, default: 4 },
    section: { type: String, default: 'Main' },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'cleaning', 'out_of_service'],
      default: 'available',
    },
    currentOrderId: { type: String },
    currentWaiterId: { type: String },
    waiterName: { type: String },
    seats: {
      type: [SeatSchema],
      default: [
        { seatNumber: 'S1', status: 'available' },
        { seatNumber: 'S2', status: 'available' },
        { seatNumber: 'S3', status: 'available' },
        { seatNumber: 'S4', status: 'available' },
      ],
    },
  },
  { timestamps: true }
);

export const Table = mongoose.model<ITable>('Table', TableSchema);
