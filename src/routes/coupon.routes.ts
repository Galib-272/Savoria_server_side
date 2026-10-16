import { Router } from 'express';
import {
  getCoupons,
  createCoupon,
  validateCoupon,
  deleteCoupon,
} from '../controllers/coupon.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

// Public / checkout validation
router.post('/validate', optionalAuthenticate, validateCoupon);
router.get('/', optionalAuthenticate, getCoupons);

// Admin / Manager CRUD
router.post('/', authenticate, requireRole(['admin', 'manager']), createCoupon);
router.delete('/:id', authenticate, requireRole(['admin']), deleteCoupon);

export default router;
