import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog.model.js';

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, entity, search, page = 1, limit = 50 } = req.query;
    const filter: any = {};

    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (search) {
      filter.$or = [
        { userName: { $regex: search as string, $options: 'i' } },
        { action: { $regex: search as string, $options: 'i' } },
        { details: { $regex: search as string, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(Number(limit));
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
