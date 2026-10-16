import { Request, Response } from 'express';
import { Expense } from '../models/Expense.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditLog } from '../models/AuditLog.model.js';

export const getExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, startDate, endDate } = req.query;
    const filter: any = {};

    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });
    const formatted = expenses.map((e) => ({
      id: e._id.toString(),
      amount: e.amount,
      category: e.category,
      date: e.date,
      description: e.description,
      createdBy: e.createdBy,
    }));

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { amount, category, date, description } = req.body;

    if (!amount || !category || !description) {
      res.status(400).json({ success: false, message: 'Amount, category, and description are required.' });
      return;
    }

    const expense = await Expense.create({
      amount: Number(amount),
      category,
      date: date || new Date().toISOString().split('T')[0],
      description,
      createdBy: req.user?.name || 'Staff',
    });

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'admin',
      action: 'CREATE_EXPENSE',
      entity: 'Expense',
      entityId: expense._id.toString(),
      details: `Added expense: ৳${amount} for ${category} (${description})`,
    });

    res.status(201).json({ success: true, message: 'Expense recorded', data: expense });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await Expense.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Expense deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
