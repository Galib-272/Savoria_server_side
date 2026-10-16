import mongoose, { Document, Schema } from 'mongoose';
import { InventoryStatus } from '../types/index.js';

export interface IInventoryItem extends Document {
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  cost: number;
  supplier: string;
  expirationDate?: string;
  status: InventoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, required: true },
    unit: { type: String, required: true },
    currentStock: { type: Number, required: true, default: 0 },
    minStock: { type: Number, required: true, default: 5 },
    maxStock: { type: Number, default: 100 },
    cost: { type: Number, required: true, default: 0 },
    supplier: { type: String, required: true },
    expirationDate: { type: String },
    status: {
      type: String,
      enum: ['in_stock', 'low_stock', 'out_of_stock'],
      default: 'in_stock',
    },
  },
  { timestamps: true }
);

InventoryItemSchema.pre('save', function (next) {
  if (this.currentStock <= 0) {
    this.status = 'out_of_stock';
  } else if (this.currentStock <= this.minStock) {
    this.status = 'low_stock';
  } else {
    this.status = 'in_stock';
  }
  next();
});

export const InventoryItem = mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);
