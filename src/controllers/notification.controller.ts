import { Response } from 'express';
import { Notification } from '../models/Notification.model.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role;
    const filter: any = {};

    // Admin & manager see all notifications
    // Other roles only see notifications targeted to their role
    if (role && role !== 'admin' && role !== 'manager') {
      filter.$or = [
        // New system: role is in targetRoles array
        { targetRoles: role },
        // Legacy: recipientRole matches
        { recipientRole: role },
        // Notifications with no targeting at all (legacy/general)
        {
          $and: [
            { targetRoles: { $size: 0 } },
            { recipientRole: { $exists: false } },
          ],
        },
        {
          $and: [
            { targetRoles: { $exists: false } },
            { recipientRole: { $exists: false } },
          ],
        },
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
      targetRoles: n.targetRoles || [],
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
    const role = req.user?.role;
    const filter: any = { read: false };

    // Non-admin/manager should only mark their own notifications as read
    if (role && role !== 'admin' && role !== 'manager') {
      filter.$or = [
        { targetRoles: role },
        { recipientRole: role },
      ];
    }

    await Notification.updateMany(filter, { read: true });

    const io = (global as any).io || (await import('../sockets/socketHandler.js')).getIO();
    if (io) {
      // Emit only to the user's role room so other panels are unaffected
      if (role) {
        io.to(`role:${role}`).emit('notification:read_all');
      }
    }

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const clearAllNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role;
    const filter: any = {};

    // Non-admin/manager should only clear their own notifications
    if (role && role !== 'admin' && role !== 'manager') {
      filter.$or = [
        { targetRoles: role },
        { recipientRole: role },
      ];
    }

    await Notification.deleteMany(filter);

    const io = (global as any).io || (await import('../sockets/socketHandler.js')).getIO();
    if (io) {
      if (role) {
        io.to(`role:${role}`).emit('notification:cleared_all');
      }
    }

    res.status(200).json({ success: true, message: 'All notifications cleared' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
