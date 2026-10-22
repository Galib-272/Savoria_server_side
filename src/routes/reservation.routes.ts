import { Router } from 'express';
import {
  createReservation,
  getReservations,
  getAvailability,
  updateReservationStatus,
  cancelOwnReservation,
} from '../controllers/reservation.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

// Public: booked seats for a date/time (no personal details)
router.get('/availability', getAvailability);

router.use(authenticate);
router.post('/', requireRole(['customer', 'waiter', 'admin', 'manager']), createReservation);
router.get('/', requireRole(['customer', 'waiter', 'admin', 'manager', 'cashier']), getReservations);
router.put('/:id/status', requireRole(['admin', 'manager', 'waiter']), updateReservationStatus);
router.put('/:id/cancel', requireRole(['customer']), cancelOwnReservation);

export default router;
