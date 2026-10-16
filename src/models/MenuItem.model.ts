import mongoose, { Document, Schema } from 'mongoose';

export interface IModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface IMenuModifier {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  options: IModifierOption[];
}

export interface IRecipeItem {
  inventoryItemName: string;
  amount: number;
  unit: string;
}

export interface IMenuItem extends Document {
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  image: string;
  categoryId: string;
  categoryName?: string;
  available: boolean;
  featured: boolean;
  popular: boolean;
  rating: number;
  reviewCount: number;
  prepTime: number;
  ingredients: string[];
  allergens: string[];
  modifiers: IMenuModifier[];
  recipe: IRecipeItem[];
}

const ModifierOptionSchema = new Schema<IModifierOption>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const MenuModifierSchema = new Schema<IMenuModifier>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['single', 'multiple'], default: 'single' },
    required: { type: Boolean, default: false },
    options: [ModifierOptionSchema],
  },
  { _id: false }
);

const RecipeItemSchema = new Schema<IRecipeItem>(
  {
    inventoryItemName: { type: String, required: true },
    amount: { type: Number, required: true },
    unit: { type: String, required: true },
  },
  { _id: false }
);

const MenuItemSchema = new Schema<IMenuItem>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number },
    image: { type: String, default: '' },
    categoryId: { type: String, required: true },
    categoryName: { type: String },
    available: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    popular: { type: Boolean, default: false },
    rating: { type: Number, default: 5.0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    prepTime: { type: Number, default: 15 },
    ingredients: [{ type: String }],
    allergens: [{ type: String }],
    modifiers: [MenuModifierSchema],
    recipe: [RecipeItemSchema],
  },
  { timestamps: true }
);

export const MenuItem = mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);
