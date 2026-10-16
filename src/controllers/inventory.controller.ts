import { Request, Response } from 'express';
import { InventoryItem } from '../models/Inventory.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { emitLowStockAlert } from '../sockets/socketHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { Notification } from '../models/Notification.model.js';

export const getInventoryItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, category, search } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) filter.name = { $regex: search as string, $options: 'i' };

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

    res.status(201).json({ success: true, message: 'Inventory item created', data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInventoryItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const item = await InventoryItem.findById(id);
    if (!item) {
      res.status(404).json({ success: false, message: 'Inventory item not found.' });
      return;
    }

    Object.assign(item, req.body);
    await item.save();

    if (item.status === 'low_stock' || item.status === 'out_of_stock') {
      emitLowStockAlert(item);
      await Notification.create({
        title: 'Low Stock Alert',
        message: `${item.name} stock is low (${item.currentStock} ${item.unit} remaining)`,
        type: 'inventory',
        recipientRole: 'manager',
      });
    }

    res.status(200).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adjustStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { changeAmount, reason } = req.body; // positive to add, negative to reduce

    const item = await InventoryItem.findById(id);
    if (!item) {
      res.status(404).json({ success: false, message: 'Inventory item not found.' });
      return;
    }

    const previousStock = item.currentStock;
    item.currentStock = Math.max(0, item.currentStock + Number(changeAmount));
    await item.save();

    if (item.status === 'low_stock' || item.status === 'out_of_stock') {
      emitLowStockAlert(item);
    }

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
    await InventoryItem.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Inventory item deleted.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
