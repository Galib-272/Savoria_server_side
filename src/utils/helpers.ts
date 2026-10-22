import mongoose from 'mongoose';
import { Counter } from '../models/Counter.model.js';
import { ENV } from '../config/env.js';

export const STAFF_ROLES = ['admin', 'manager', 'cashier', 'kitchen', 'waiter', 'delivery'] as const;

export const isStaffRole = (role?: string): boolean =>
  !!role && (STAFF_ROLES as readonly string[]).includes(role);

/** Escape user input before building a RegExp / $regex query. */
export const escapeRegex = (value: unknown): string =>
  String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isValidObjectId = (id: unknown): boolean =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);

/** Today's date (YYYY-MM-DD) in the restaurant's timezone. */
export const todayInRestaurantTz = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ENV.RESTAURANT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

/** Current time formatted like "07:45 PM" in the restaurant's timezone. */
export const formattedTime = (date: Date = new Date()): string =>
  date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: ENV.RESTAURANT_TIMEZONE });

/** Converts "7:00 PM" / "19:00" to minutes since midnight. Returns NaN if invalid. */
export const timeToMinutes = (time: string): number => {
  const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return NaN;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minutes > 59) return NaN;
  if (meridiem) {
    if (hours < 1 || hours > 12) return NaN;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  } else if (hours > 23) {
    return NaN;
  }
  return hours * 60 + minutes;
};

/**
 * Atomically returns the next number in a named sequence.
 * On first use the counter is seeded with `seedValue()` (e.g. the highest existing number).
 */
export const nextSequence = async (name: string, seedValue: () => Promise<number>): Promise<number> => {
  const existing = await Counter.findById(name).lean();
  if (!existing) {
    const start = await seedValue();
    try {
      await Counter.create({ _id: name, seq: start });
    } catch {
      // another request created it concurrently — fine
    }
  }
  const updated = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return updated!.seq;
};

/** Pick only allowed keys from a request body. */
export const pick = <T extends Record<string, any>>(source: T, keys: string[]): Partial<T> => {
  const out: Record<string, any> = {};
  for (const key of keys) {
    if (source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out as Partial<T>;
};
