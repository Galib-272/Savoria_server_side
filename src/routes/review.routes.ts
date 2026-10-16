import { Router } from 'express';
import { getReviews, createReview } from '../controllers/review.controller.js';
import { optionalAuthenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', getReviews);
router.post('/', optionalAuthenticate, createReview);

export default router;
