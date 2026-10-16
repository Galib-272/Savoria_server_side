import mongoose, { Document, Schema } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  products: string[];
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    products: [{ type: String }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

export const Supplier = mongoose.model<ISupplier>('Supplier', SupplierSchema);
