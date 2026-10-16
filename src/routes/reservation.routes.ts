import { Router } from 'express';
import {
  createReservation,
  getReservations,
  updateReservationStatus,
} from '../controllers/reservation.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

router.post('/', optionalAuthenticate, createReservation);
router.get('/', optionalAuthenticate, getReservations);
router.put('/:id/status', authenticate, requireRole(['admin', 'manager', 'waiter']), updateReservationStatus);

export default router;
