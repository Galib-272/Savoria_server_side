import { Router } from 'express';
import { getReviews, createReview } from '../controllers/review.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

router.get('/', getReviews);
router.post('/', authenticate, requireRole(['customer']), createReview);

export default router;
