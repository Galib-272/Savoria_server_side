import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense extends Document {
  amount: number;
  category: string;
  date: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true },
    description: { type: String, required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
