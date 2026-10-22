import { Request, Response } from 'express';
import { Coupon } from '../models/Coupon.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { evaluateCoupon, CouponError } from '../services/coupon.service.js';
import { isStaffRole, todayInRestaurantTz } from '../utils/helpers.js';

export const getCoupons = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Public offers page: only live coupons. Management sees everything.
    const showAll = isStaffRole(req.user?.role) && ['admin', 'manager'].includes(req.user!.role);
    const filter = showAll ? {} : { active: true, expiry: { $gte: todayInRestaurantTz() } };
    const coupons = (await Coupon.find(filter).sort({ createdAt: -1 })).filter((c) => showAll || c.used < c.usageLimit);
    const formatted = coupons.map((c) => ({
      id: c._id.toString(),
      code: c.code,
      type: c.type,
      value: c.value,
      minOrder: c.minOrder,
      maxDiscount: c.maxDiscount,
      expiry: c.expiry,
      usageLimit: c.usageLimit,
      used: c.used,
      active: c.active,
    }));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCoupon = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { code, type, value, minOrder = 0, maxDiscount, expiry, usageLimit = 100 } = req.body;

    if (!code || !type || !value || !expiry) {
      res.status(400).json({ success: false, message: 'Code, type, value, and expiry are required.' });
      return;
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      type,
      value: Number(value),
      minOrder: Number(minOrder),
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      expiry,
      usageLimit: Number(usageLimit),
      used: 0,
      active: true,
    });

    res.status(201).json({ success: true, message: 'Coupon created', data: coupon });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, orderAmount } = req.body;
    if (!code || orderAmount === undefined) {
      res.status(400).json({ success: false, message: 'Coupon code and order amount are required.' });
      return;
    }
    const { coupon, discount } = await evaluateCoupon(String(code), Number(orderAmount) || 0);
    res.status(200).json({
      success: true,
      message: 'Coupon code applied successfully',
      discount,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrder: coupon.minOrder,
        maxDiscount: coupon.maxDiscount,
      },
    });
  } catch (error: any) {
    const status = error instanceof CouponError ? error.status : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const deleteCoupon = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Coupon deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
