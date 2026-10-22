import { Coupon, ICoupon } from '../models/Coupon.model.js';
import { todayInRestaurantTz } from '../utils/helpers.js';

export class CouponError extends Error {
  status = 400;
}

/** Validates a coupon code against a food subtotal and returns the discount (never more than the subtotal). */
export const evaluateCoupon = async (rawCode: string, subtotal: number): Promise<{ coupon: ICoupon; discount: number }> => {
  const code = String(rawCode || '').toUpperCase().trim();
  if (!code) throw new CouponError('Coupon code is required.');

  const coupon = await Coupon.findOne({ code, active: true });
  if (!coupon) {
    const err = new CouponError('Invalid or inactive coupon code.');
    err.status = 404;
    throw err;
  }
  if (coupon.expiry < todayInRestaurantTz()) throw new CouponError('This coupon code has expired.');
  if (coupon.used >= coupon.usageLimit) throw new CouponError('Coupon usage limit has been reached.');
  if (subtotal < coupon.minOrder) {
    throw new CouponError(`Minimum order amount of ৳${coupon.minOrder} required to apply this coupon.`);
  }

  let discount = coupon.type === 'percentage' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
  discount = Math.max(0, Math.min(discount, subtotal));
  return { coupon, discount };
};

/** Atomically consumes one use of the coupon. Returns false if the limit was reached in the meantime. */
export const consumeCoupon = async (couponId: unknown): Promise<boolean> => {
  const coupon = await Coupon.findById(couponId).select('usageLimit').lean();
  if (!coupon) return false;
  const res = await Coupon.updateOne({ _id: couponId, active: true, used: { $lt: coupon.usageLimit } }, { $inc: { used: 1 } });
  return res.modifiedCount === 1;
};
