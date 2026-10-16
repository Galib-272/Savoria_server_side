import { Router } from 'express';
import { getDashboardStats, getAnalyticsCharts } from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireRole(['admin', 'manager']));

router.get('/dashboard-stats', getDashboardStats);
router.get('/charts', getAnalyticsCharts);

export default router;
