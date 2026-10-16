import mongoose, { Document, Schema } from 'mongoose';

export interface IRestaurantSettings extends Document {
  name: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  currency: string;
  taxRate: number;        // percentage e.g. 10
  serviceChargeRate: number; // percentage e.g. 0
  deliveryFee: number;    // flat fee e.g. 50
  logo?: string;
  coverImage?: string;
  primaryColor?: string;
  updatedAt: Date;
}

const RestaurantSettingsSchema = new Schema<IRestaurantSettings>(
  {
    name: { type: String, default: 'Savoria' },
    tagline: { type: String, default: 'Where Every Bite Tells a Story' },
    description: {
      type: String,
      default:
        'A premium dining experience serving authentic cuisine crafted with the finest ingredients since 2014.',
    },
    address: { type: String, default: '123 Culinary Avenue, Dhaka 1213' },
    phone: { type: String, default: '+880 1700-000000' },
    email: { type: String, default: 'hello@savoria.com' },
    hours: { type: String, default: 'Mon–Sun: 10:00 AM – 11:00 PM' },
    currency: { type: String, default: '৳' },
    taxRate: { type: Number, default: 10 },
    serviceChargeRate: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 50 },
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    primaryColor: { type: String, default: '#E11D48' },
  },
  { timestamps: true }
);

export const RestaurantSettings = mongoose.model<IRestaurantSettings>(
  'RestaurantSettings',
  RestaurantSettingsSchema
);
