import { Router } from 'express';
import {
  createStripePaymentIntent,
  processPayment,
  getAllPayments,
  getReceiptByOrder,
} from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

// Demo Stripe payment intent (accepts any amount — no real money is charged)
router.post('/stripe-intent', createStripePaymentIntent);

// Cashier billing (POS and collecting pay-at-counter orders)
router.post('/process', requireRole(['admin', 'manager', 'cashier']), processPayment);

// Transaction logs & receipts
router.get('/', requireRole(['admin', 'manager', 'cashier']), getAllPayments);
router.get('/receipt/:orderId', getReceiptByOrder);

export default router;
