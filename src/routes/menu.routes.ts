import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
  deleteMenuItem,
} from '../controllers/menu.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

// Public menu browsing
router.get('/categories', getCategories);
router.get('/items', getMenuItems);
router.get('/items/:id', getMenuItemById);

// Management routes
router.post('/categories', authenticate, requireRole(['admin', 'manager']), createCategory);
router.put('/categories/:id', authenticate, requireRole(['admin', 'manager']), updateCategory);
router.delete('/categories/:id', authenticate, requireRole(['admin']), deleteCategory);

router.post('/items', authenticate, requireRole(['admin', 'manager']), createMenuItem);
router.put('/items/:id', authenticate, requireRole(['admin', 'manager']), updateMenuItem);
router.patch('/items/:id/availability', authenticate, requireRole(['admin', 'manager']), toggleAvailability);
router.delete('/items/:id', authenticate, requireRole(['admin']), deleteMenuItem);

export default router;
