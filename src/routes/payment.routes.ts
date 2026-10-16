import { Router } from 'express';
import {
  createStripePaymentIntent,
  processPayment,
  getAllPayments,
  getReceiptByOrder,
} from '../controllers/payment.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

// Stripe Payment Intent (public or logged-in checkout)
router.post('/stripe-intent', optionalAuthenticate, createStripePaymentIntent);

// Cashier payment processing
router.post('/process', authenticate, requireRole(['admin', 'cashier']), processPayment);

// Transaction logs & receipts
router.get('/', authenticate, requireRole(['admin', 'manager', 'cashier']), getAllPayments);
router.get('/receipt/:orderId', optionalAuthenticate, getReceiptByOrder);

export default router;
