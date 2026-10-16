import { Router } from 'express';
import { getExpenses, createExpense, deleteExpense } from '../controllers/expense.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['admin', 'manager']), getExpenses);
router.post('/', requireRole(['admin', 'manager']), createExpense);
router.delete('/:id', requireRole(['admin']), deleteExpense);

export default router;
