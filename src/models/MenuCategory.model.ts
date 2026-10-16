import mongoose, { Document, Schema } from 'mongoose';

export interface IMenuCategory extends Document {
  name: string;
  icon: string;
  active: boolean;
  order: number;
}

const MenuCategorySchema = new Schema<IMenuCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, default: '🍽️' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const MenuCategory = mongoose.model<IMenuCategory>('MenuCategory', MenuCategorySchema);
