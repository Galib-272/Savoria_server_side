import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/setting.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

// Public can view basic restaurant info (opening hours, currency, branding)
router.get('/', getSettings);

// Only admin can update application settings
router.put('/', authenticate, requireRole(['admin']), updateSettings);

export default router;
