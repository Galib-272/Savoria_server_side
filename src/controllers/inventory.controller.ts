import { Request, Response } from 'express';
import { InventoryItem } from '../models/Inventory.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { emitLowStockAlert } from '../sockets/socketHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { notify } from '../services/notification.service.js';
import { escapeRegex, isValidObjectId, pick } from '../utils/helpers.js';

const alertIfLow = async (item: any, previousStatus?: string) => {
  if ((item.status === 'low_stock' || item.status === 'out_of_stock') && item.status !== previousStatus) {
    emitLowStockAlert(item);
    await notify({
      title: item.status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock Alert',
      message: `${item.name} is ${item.status === 'out_of_stock' ? 'out of stock' : 'running low'} (${item.currentStock} ${item.unit} left, minimum ${item.minStock})`,
      type: 'inventory',
      roles: ['kitchen'],
    });
  }
};

export const getInventoryItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, category, search } = req.query;
    const filter: any = {};

    if (status) filter.status = String(status);
    if (category) filter.category = String(category);
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

    const items = await InventoryItem.find(filter).sort({ name: 1 });

    const formatted = items.map((i) => ({
      id: i._id.toString(),
      name: i.name,
      category: i.category,
      unit: i.unit,
      currentStock: i.currentStock,
      minStock: i.minStock,
      maxStock: i.maxStock,
      cost: i.cost,
      supplier: i.supplier,
      expirationDate: i.expirationDate,
      status: i.status,
    }));

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createInventoryItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, category, unit, currentStock = 0, minStock = 5, maxStock = 100, cost = 0, supplier, expirationDate } = req.body;

    if (!name || !category || !unit || !supplier) {
      res.status(400).json({ success: false, message: 'Name, category, unit, and supplier are required.' });
      return;
    }

    if ([currentStock, minStock, maxStock, cost].some((n) => Number.isNaN(Number(n)) || Number(n) < 0)) {
      res.status(400).json({ success: false, message: 'Stock levels and cost must be positive numbers.' });
      return;
    }
    const item = await InventoryItem.create({
      name,
      category,
      unit,
      currentStock: Number(currentStock),
      minStock: Number(minStock),
      maxStock: Number(maxStock),
      cost: Number(cost),
      supplier,
      expirationDate,
    });

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'admin',
      action: 'CREATE_INVENTORY',
      entity: 'InventoryItem',
      entityId: item._id.toString(),
      details: `Created inventory item ${item.name} (${item.currentStock} ${item.unit})`,
    });

    await alertIfLow(item);
    res.status(201).json({ success: true, message: 'Inventory item created', data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInventoryItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const item = isValidObjectId(id) ? await InventoryItem.findById(id) : null;
    if (!item) {
      res.status(404).json({ success: false, message: 'Inventory item not found.' });
      return;
    }

    const previousStatus = item.status;
    const updates: any = pick(req.body, ['name', 'category', 'unit', 'currentStock', 'minStock', 'maxStock', 'cost', 'supplier', 'expirationDate']);
    for (const key of ['currentStock', 'minStock', 'maxStock', 'cost']) {
      if (updates[key] !== undefined) {
        updates[key] = Number(updates[key]);
        if (Number.isNaN(updates[key]) || updates[key] < 0) {
          res.status(400).json({ success: false, message: `${key} must be a positive number.` });
          return;
        }
      }
    }
    Object.assign(item, updates);
    await item.save();
    await alertIfLow(item, previousStatus);

    res.status(200).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adjustStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { changeAmount, reason } = req.body; // positive to add, negative to reduce

    const item = isValidObjectId(id) ? await InventoryItem.findById(id) : null;
    if (!item) {
      res.status(404).json({ success: false, message: 'Inventory item not found.' });
      return;
    }
    const delta = Number(changeAmount);
    if (!Number.isFinite(delta) || delta === 0) {
      res.status(400).json({ success: false, message: 'Enter a non-zero amount to add or remove.' });
      return;
    }

    const previousStock = item.currentStock;
    const previousStatus = item.status;
    item.currentStock = Math.max(0, +(item.currentStock + delta).toFixed(3));
    await item.save();
    await alertIfLow(item, previousStatus);

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'manager',
      action: 'ADJUST_STOCK',
      entity: 'InventoryItem',
      entityId: item._id.toString(),
      details: `Adjusted ${item.name} stock from ${previousStock} to ${item.currentStock} ${item.unit}. Reason: ${reason || 'Manual adjustment'}`,
    });

    res.status(200).json({
      success: true,
      message: `Stock adjusted successfully. Current: ${item.currentStock} ${item.unit}`,
      data: item,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteInventoryItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = isValidObjectId(id) ? await InventoryItem.findByIdAndDelete(id) : null;
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Inventory item not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Inventory item deleted.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
