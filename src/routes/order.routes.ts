import { Router } from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  startPreparingOrder,
  markOrderReady,
  waiterClaimFood,
  deliveryPickupFood,
  deliveryMarkOutForDelivery,
  deliveryMarkDelivered,
  updateOrderStatus,
} from '../controllers/order.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

// Order creation can be done by customer (authenticated or guest checkout) or waiter/cashier POS
router.post('/', optionalAuthenticate, createOrder);
router.get('/', optionalAuthenticate, getAllOrders);
router.get('/:id', optionalAuthenticate, getOrderById);

// Kitchen actions
router.put('/:id/start-preparing', authenticate, requireRole(['admin', 'manager', 'kitchen']), startPreparingOrder);
router.put('/:id/mark-ready', authenticate, requireRole(['admin', 'manager', 'kitchen']), markOrderReady);

// Waiter actions
router.put('/:id/waiter-claim', authenticate, requireRole(['admin', 'manager', 'waiter']), waiterClaimFood);

// Delivery actions
router.put('/:id/delivery-pickup', authenticate, requireRole(['admin', 'manager', 'delivery']), deliveryPickupFood);
router.put('/:id/delivery-out', authenticate, requireRole(['admin', 'manager', 'delivery']), deliveryMarkOutForDelivery);
router.put('/:id/delivery-delivered', authenticate, requireRole(['admin', 'manager', 'delivery']), deliveryMarkDelivered);

// General status update and customer pickup
router.put('/:id/status', authenticate, requireRole(['admin', 'manager', 'cashier', 'waiter', 'customer']), updateOrderStatus);

export default router;
