import { Router } from 'express';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchases,
  createPurchase,
} from '../controllers/supplier.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

// Suppliers
router.get('/', requireRole(['admin', 'manager']), getSuppliers);
router.post('/', requireRole(['admin', 'manager']), createSupplier);
router.put('/:id', requireRole(['admin', 'manager']), updateSupplier);
router.delete('/:id', requireRole(['admin']), deleteSupplier);

// Purchases
router.get('/purchases', requireRole(['admin', 'manager']), getPurchases);
router.post('/purchases', requireRole(['admin', 'manager']), createPurchase);

export default router;
