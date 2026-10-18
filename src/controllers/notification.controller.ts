import { Response } from 'express';
import { Notification } from '../models/Notification.model.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role;
    const filter: any = {};

    // Return notifications applicable to this user's role or general (admin and manager see all)
    if (role && role !== 'admin' && role !== 'manager') {
      filter.$or = [
        { recipientRole: role },
        { recipientRole: { $exists: false } },
        { recipientRole: null },
      ];
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(30);

    const formatted = notifications.map((n) => ({
      id: n._id.toString(),
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      time: n.time || 'Just now',
      orderId: n.orderId,
    }));

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { read: true });

    const io = (global as any).io || (await import('../sockets/socketHandler.js')).getIO();
    if (io) {
      io.emit('notification:read_one', { id });
    }

    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ read: false }, { read: true });

    const io = (global as any).io || (await import('../sockets/socketHandler.js')).getIO();
    if (io) {
      io.emit('notification:read_all');
    }

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const clearAllNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await Notification.deleteMany({});

    const io = (global as any).io || (await import('../sockets/socketHandler.js')).getIO();
    if (io) {
      io.emit('notification:cleared_all');
    }

    res.status(200).json({ success: true, message: 'All notifications cleared' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
