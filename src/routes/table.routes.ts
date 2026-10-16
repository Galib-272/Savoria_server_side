import { Router } from 'express';
import {
  getAllTables,
  getTableById,
  updateTableStatus,
  updateSeatStatus,
  assignWaiter,
} from '../controllers/table.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

// Public can view tables/seats to see availability for reservations
router.get('/', optionalAuthenticate, getAllTables);
router.get('/:id', optionalAuthenticate, getTableById);

// Staff/Waiters/Managers/Admin can update table & seat status
router.put('/:id/status', authenticate, requireRole(['admin', 'manager', 'waiter', 'cashier']), updateTableStatus);
router.put('/:id/seats/:seatNumber', authenticate, requireRole(['admin', 'manager', 'waiter', 'cashier', 'customer']), updateSeatStatus);
router.put('/:id/assign-waiter', authenticate, requireRole(['admin', 'manager', 'waiter']), assignWaiter);

export default router;
