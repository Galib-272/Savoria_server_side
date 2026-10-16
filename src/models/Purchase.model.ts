import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchaseItem {
  name: string;
  quantity: number;
  unit: string;
  cost: number;
}

export interface IPurchase extends Document {
  purchaseNumber: string;
  supplierName: string;
  supplierId?: string;
  items: IPurchaseItem[];
  total: number;
  date: string;
  status: 'pending' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    cost: { type: Number, required: true },
  },
  { _id: false }
);

const PurchaseSchema = new Schema<IPurchase>(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    supplierName: { type: String, required: true },
    supplierId: { type: String },
    items: [PurchaseItemSchema],
    total: { type: Number, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'completed' },
  },
  { timestamps: true }
);

export const Purchase = mongoose.model<IPurchase>('Purchase', PurchaseSchema);
