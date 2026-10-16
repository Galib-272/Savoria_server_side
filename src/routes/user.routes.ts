import { Router } from 'express';
import {
  getStaffMembers,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole, protectAdminRules } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/staff', requireRole(['admin', 'manager']), getStaffMembers);
router.post('/staff', requireRole(['admin']), protectAdminRules, createStaffMember);
router.put('/staff/:id', requireRole(['admin', 'manager']), protectAdminRules, updateStaffMember);
router.delete('/staff/:id', requireRole(['admin']), protectAdminRules, deleteStaffMember);

export default router;
