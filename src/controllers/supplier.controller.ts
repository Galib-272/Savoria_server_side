import { Request, Response } from 'express';
import { Supplier } from '../models/Supplier.model.js';
import { Purchase } from '../models/Purchase.model.js';
import { InventoryItem } from '../models/Inventory.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { escapeRegex, isValidObjectId, nextSequence, pick } from '../utils/helpers.js';

// --- SUPPLIERS ---
export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    const formatted = suppliers.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      company: s.company,
      phone: s.phone,
      email: s.email,
      address: s.address,
      products: s.products,
      status: s.status,
    }));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, company, phone, email, address, products, status = 'active' } = req.body;
    if (!name || !company || !phone || !email || !address) {
      res.status(400).json({ success: false, message: 'All supplier fields are required.' });
      return;
    }

    const supplier = await Supplier.create({ name, company, phone, email, address, products: products || [], status });
    res.status(201).json({ success: true, message: 'Supplier created', data: supplier });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid supplier id' });
      return;
    }
    const updates = pick(req.body, ['name', 'company', 'phone', 'email', 'address', 'products', 'status']);
    const supplier = await Supplier.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!supplier) {
      res.status(404).json({ success: false, message: 'Supplier not found' });
      return;
    }
    res.status(200).json({ success: true, data: supplier });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid supplier id' });
      return;
    }
    await Supplier.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Supplier deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- PURCHASES ---
export const getPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });
    const formatted = purchases.map((p) => ({
      id: p._id.toString(),
      purchaseNumber: p.purchaseNumber,
      supplierName: p.supplierName,
      items: p.items,
      total: p.total,
      date: p.date,
      status: p.status,
    }));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPurchase = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { supplierName, items, total, date, status = 'completed' } = req.body;

    if (!supplierName || !items || !items.length || !total) {
      res.status(400).json({ success: false, message: 'Supplier name, items, and total are required.' });
      return;
    }

    const cleanItems = (Array.isArray(items) ? items : [])
      .map((i: any) => ({ name: String(i.name || '').trim(), quantity: Number(i.quantity), unit: String(i.unit || '').trim(), cost: Number(i.cost) }))
      .filter((i: any) => i.name && i.unit && i.quantity > 0 && i.cost >= 0);
    if (cleanItems.length === 0) {
      res.status(400).json({ success: false, message: 'Add at least one item with a name, unit, quantity and cost.' });
      return;
    }
    const seq = await nextSequence('purchase', async () => {
      const all = await Purchase.find({ purchaseNumber: /^#P\d+$/ }).select('purchaseNumber').lean();
      return all.reduce((max, p) => Math.max(max, parseInt(p.purchaseNumber.slice(2), 10) || 0), 101);
    });
    const purchaseNumber = `#P${seq}`;

    const purchase = await Purchase.create({
      purchaseNumber,
      supplierName,
      items: cleanItems,
      total: Number(total),
      date: date || new Date().toISOString().split('T')[0],
      status,
    });

    // If completed, automatically update inventory items
    if (status === 'completed') {
      for (const item of cleanItems) {
        const inv = await InventoryItem.findOne({ name: { $regex: `^${escapeRegex(item.name)}$`, $options: 'i' } });
        if (inv) {
          inv.currentStock += Number(item.quantity);
          await inv.save();
        }
      }
    }

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'admin',
      action: 'CREATE_PURCHASE',
      entity: 'Purchase',
      entityId: purchase._id.toString(),
      details: `Created purchase order ${purchaseNumber} from ${supplierName} (Total: ৳${total})`,
    });

    res.status(201).json({ success: true, message: 'Purchase created successfully', data: purchase });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
