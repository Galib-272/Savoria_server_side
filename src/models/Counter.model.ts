import mongoose, { Schema } from 'mongoose';

// Atomic sequence counters (order numbers, receipt numbers, purchase numbers)
const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = mongoose.model<{ _id: string; seq: number }>('Counter', CounterSchema);
