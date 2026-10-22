import { Response } from 'express';
import { Notification } from '../models/Notification.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { audienceFilter, serializeNotification } from '../services/notification.service.js';
import { emitToRooms, userRoom } from '../sockets/socketHandler.js';
import { isValidObjectId } from '../utils/helpers.js';

const visibleFilter = (req: AuthenticatedRequest) => ({
  ...audienceFilter({ userId: req.user!.userId, role: req.user!.role }),
  clearedBy: { $ne: req.user!.userId },
});

export const getNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find(visibleFilter(req)).sort({ createdAt: -1 }).limit(50);
    const data = notifications.map((n) => serializeNotification(n, req.user!.userId));
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid notification id' });
      return;
    }
    // Read state is per user — marking it read never affects anyone else's panel
    const result = await Notification.updateOne(
      { _id: id, ...visibleFilter(req) },
      { $addToSet: { readBy: req.user!.userId } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }
    emitToRooms([userRoom(req.user!.userId)], 'notification:read_one', { id });
    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany(visibleFilter(req), { $addToSet: { readBy: req.user!.userId } });
    emitToRooms([userRoom(req.user!.userId)], 'notification:read_all', {});
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const clearAllNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // "Clear" hides the notifications for this user only; other staff/customers keep theirs
    await Notification.updateMany(visibleFilter(req), { $addToSet: { clearedBy: req.user!.userId } });
    emitToRooms([userRoom(req.user!.userId)], 'notification:cleared_all', {});
    res.status(200).json({ success: true, message: 'All notifications cleared' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
