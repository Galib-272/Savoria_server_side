import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole, StaffStatus } from '../types/index.js';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role: UserRole;
  status: StaffStatus;
  isMainAdmin: boolean;
  avatar?: string;
  assignedManager?: string;
  permissions: string[];
  googleId?: string;
  joinDate: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: ['admin', 'manager', 'cashier', 'kitchen', 'waiter', 'delivery', 'customer'],
      default: 'customer',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'on_leave'],
      default: 'active',
    },
    isMainAdmin: { type: Boolean, default: false },
    avatar: { type: String },
    assignedManager: { type: String },
    permissions: [{ type: String }],
    googleId: { type: String },
    joinDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);
