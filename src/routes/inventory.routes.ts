import { Router } from 'express';
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
} from '../controllers/inventory.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['admin', 'manager', 'kitchen']), getInventoryItems);
router.post('/', requireRole(['admin', 'manager']), createInventoryItem);
router.put('/:id', requireRole(['admin', 'manager']), updateInventoryItem);
router.patch('/:id/adjust', requireRole(['admin', 'manager', 'kitchen']), adjustStock);
router.delete('/:id', requireRole(['admin']), deleteInventoryItem);

export default router;
