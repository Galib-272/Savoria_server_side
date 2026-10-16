import { Request } from 'express';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'kitchen' | 'waiter' | 'delivery' | 'customer';

export type StaffStatus = 'active' | 'inactive' | 'suspended' | 'on_leave';

export type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded';

export type PaymentMethod = 'cash' | 'card' | 'mobile_banking' | 'bank_transfer' | 'stripe';

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_service';

export type SeatStatus = 'available' | 'occupied' | 'reserved';

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface IUserPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  isMainAdmin?: boolean;
  permissions?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: IUserPayload;
}
