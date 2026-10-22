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
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

// Every order endpoint requires a signed-in user (customers only ever see their own orders)
router.use(authenticate);

// Customers (online checkout) and front-of-house staff (POS / waiter) can place orders
router.post('/', requireRole(['customer', 'cashier', 'waiter', 'admin', 'manager']), createOrder);
router.get('/', getAllOrders);
router.get('/:id', getOrderById);

// Kitchen actions
router.put('/:id/start-preparing', requireRole(['admin', 'manager', 'kitchen']), startPreparingOrder);
router.put('/:id/mark-ready', requireRole(['admin', 'manager', 'kitchen']), markOrderReady);

// Waiter actions
router.put('/:id/waiter-claim', requireRole(['admin', 'manager', 'waiter']), waiterClaimFood);

// Delivery actions
router.put('/:id/delivery-pickup', requireRole(['admin', 'manager', 'delivery']), deliveryPickupFood);
router.put('/:id/delivery-out', requireRole(['admin', 'manager', 'delivery']), deliveryMarkOutForDelivery);
router.put('/:id/delivery-delivered', requireRole(['admin', 'manager', 'delivery']), deliveryMarkDelivered);

// Served / completed / cancelled (each transition is checked per role inside the controller)
router.put(
  '/:id/status',
  requireRole(['admin', 'manager', 'cashier', 'waiter', 'kitchen', 'customer']),
  updateOrderStatus
);

export default router;
