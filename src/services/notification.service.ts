import { Notification, INotification } from '../models/Notification.model.js';
import { emitToActorInRooms, emitToRooms, roleRoom, userRoom } from '../sockets/socketHandler.js';

export type NotificationType = INotification['type'];

export interface NotifyInput {
  title: string;
  message: string;
  type: NotificationType;
  /** Staff roles that should see this (admin & manager are always added). Empty = no staff copy. */
  roles?: string[];
  /** Also send a customer-facing copy to this user (the customer who owns the order / reservation). */
  customerId?: string;
  /** Optional separate wording for the customer copy */
  customerTitle?: string;
  customerMessage?: string;
  orderId?: string;
  reservationId?: string;
  tableNumber?: number;
  /** The user who triggered the event — their bell updates instantly too, but without a popup (`self: true`). */
  actorId?: string;
  /** Set false to skip the automatic admin/manager copy (rare). */
  includeManagement?: boolean;
}

export const serializeNotification = (n: any, userId?: string) => ({
  id: n._id.toString(),
  title: n.title,
  message: n.message,
  type: n.type,
  read: userId ? (n.readBy || []).includes(userId) : false,
  time: n.time,
  createdAt: n.createdAt,
  orderId: n.orderId,
  reservationId: n.reservationId,
  tableNumber: n.tableNumber,
  targetRoles: n.targetRoles || [],
});

/**
 * Single entry point for every notification in the app.
 * - Saves exactly one document per audience (staff copy and/or one customer's copy)
 * - Pushes exactly one live `notification` event per audience (no per-role loops → no duplicates)
 * - Customer copies go to that customer only, never to all customers
 */
export const notify = async (input: NotifyInput): Promise<void> => {
  try {
    const exceptRooms = input.actorId ? [userRoom(input.actorId)] : [];

    const staffRoles = Array.from(
      new Set([...(input.roles || []), ...(input.includeManagement === false ? [] : ['admin', 'manager'])])
    ).filter((r) => r !== 'customer');

    if (staffRoles.length) {
      const staffDoc = await Notification.create({
        title: input.title,
        message: input.message,
        type: input.type,
        targetRoles: staffRoles,
        orderId: input.orderId,
        reservationId: input.reservationId,
        tableNumber: input.tableNumber,
        time: 'Just now',
      });
      const payload = serializeNotification(staffDoc);
      emitToRooms(staffRoles.map(roleRoom), 'notification', payload, exceptRooms);
      // the person who made the change sees it in their bell right away (no refresh needed)
      if (input.actorId) await emitToActorInRooms(input.actorId, staffRoles.map(roleRoom), 'notification', { ...payload, self: true });
    }

    if (input.customerId) {
      const customerDoc = await Notification.create({
        title: input.customerTitle || input.title,
        message: input.customerMessage || input.message,
        type: input.type,
        targetRoles: ['customer'],
        recipientRole: 'customer',
        recipientId: input.customerId,
        orderId: input.orderId,
        reservationId: input.reservationId,
        tableNumber: input.tableNumber,
        time: 'Just now',
      });
      const payload = serializeNotification(customerDoc);
      emitToRooms([userRoom(input.customerId)], 'notification', payload, exceptRooms);
      if (input.actorId && input.actorId === input.customerId) {
        emitToRooms([userRoom(input.customerId)], 'notification', { ...payload, self: true });
      }
    }
  } catch (err) {
    console.error('[Notification] Failed to create/emit notification:', err);
  }
};

/** Mongo filter for the notifications a given user is allowed to see. */
export const audienceFilter = (user: { userId: string; role: string }) => {
  if (user.role === 'customer') {
    return { recipientId: user.userId };
  }
  return {
    $or: [
      { targetRoles: user.role },
      { recipientId: user.userId },
      // legacy notifications created before role targeting existed (seed data) → staff only
      {
        $and: [
          { $or: [{ targetRoles: { $exists: false } }, { targetRoles: { $size: 0 } }] },
          { recipientRole: { $in: [null, user.role] } },
          { recipientId: { $exists: false } },
        ],
      },
      { recipientRole: user.role, recipientId: { $exists: false } },
    ],
  };
};
