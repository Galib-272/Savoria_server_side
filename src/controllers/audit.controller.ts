import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog.model.js';
import { escapeRegex } from '../utils/helpers.js';

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, entity, search } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const filter: any = {};

    if (action) filter.action = String(action);
    if (entity) filter.entity = String(entity);
    if (search) {
      filter.$or = [
        { userName: { $regex: escapeRegex(search), $options: 'i' } },
        { action: { $regex: escapeRegex(search), $options: 'i' } },
        { details: { $regex: escapeRegex(search), $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await AuditLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page: Number(page),
      data: logs,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
