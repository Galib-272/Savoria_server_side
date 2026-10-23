import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { User } from '../models/User.model.js';
import { Order } from '../models/Order.model.js';
import { IUserPayload } from '../types/index.js';
import { STAFF_ROLES, isStaffRole, isValidObjectId } from '../utils/helpers.js';

let ioInstance: Server | null = null;

/**
 * Room naming
 *  - role:<role>   → every signed-in socket of that role (joined by the SERVER only)
 *  - user:<userId> → every socket/tab of one user (joined by the SERVER only)
 *  - order:<id>    → sockets tracking one order (ownership checked)
 *
 * Clients can no longer pick their own role rooms. This is what removes the
 * double / triple notifications and the "other panel" notifications.
 */
export const roleRoom = (role: string) => `role:${role}`;
export const userRoom = (userId: string) => `user:${userId}`;
export const orderRoom = (orderId: string) => `order:${orderId}`;
export const STAFF_ROOMS = STAFF_ROLES.map(roleRoom);

const readToken = (socket: Socket): string | undefined => {
  const authToken = (socket.handshake.auth as any)?.token;
  if (typeof authToken === 'string' && authToken) return authToken;
  const header = socket.handshake.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return undefined;
};

export const initSocket = (io: Server): void => {
  ioInstance = io;

  // Authenticate every connection. Guests may connect (public floor map updates) but join no private rooms.
  io.use(async (socket, next) => {
    const token = readToken(socket);
    if (!token) return next();
    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as IUserPayload;
      const user = await User.findById(decoded.userId).select('name role status');
      if (user && user.status !== 'suspended' && user.status !== 'inactive') {
        socket.data.user = { userId: user._id.toString(), role: user.role, name: user.name };
      }
      return next();
    } catch {
      // Invalid / expired token → treat as guest; the REST API will force a re-login.
      return next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as { userId: string; role: string; name: string } | undefined;

    if (user) {
      socket.join(roleRoom(user.role));
      socket.join(userRoom(user.userId));
    }

    // Legacy event from old clients — ignored on purpose (rooms are assigned by the server).
    socket.on('join_role_room', () => undefined);

    // Track a single order (customer tracking page). Only the owner or staff may join.
    socket.on('join_order_room', async (orderId: string) => {
      if (!user || !isValidObjectId(orderId)) return;
      if (isStaffRole(user.role)) {
        socket.join(orderRoom(orderId));
        return;
      }
      const order = await Order.findById(orderId).select('customerId').lean();
      if (order && order.customerId === user.userId) socket.join(orderRoom(orderId));
    });

    socket.on('leave_order_room', (orderId: string) => {
      if (typeof orderId === 'string') socket.leave(orderRoom(orderId));
    });
  });
};

export const getIO = (): Server | null => ioInstance;

/** Emit ONCE to the union of rooms (Socket.IO de-duplicates sockets that are in several rooms). */
export const emitToRooms = (rooms: string[], event: string, payload: unknown, exceptRooms: string[] = []): void => {
  if (!ioInstance || rooms.length === 0) return;
  const unique = Array.from(new Set(rooms));
  let op = ioInstance.to(unique);
  if (exceptRooms.length) op = op.except(exceptRooms);
  op.emit(event, payload);
};

/**
 * Send an event to the user who caused it, but only to their tabs that belong to one of `rooms`
 * (e.g. an admin who cancels an order is in role:admin, so their own bell updates instantly,
 * while a kitchen user marking an order ready doesn't get the waiter's notification).
 */
export const emitToActorInRooms = async (actorId: string, rooms: string[], event: string, payload: unknown): Promise<void> => {
  if (!ioInstance || !actorId || rooms.length === 0) return;
  const sockets = await ioInstance.in(userRoom(actorId)).fetchSockets();
  for (const s of sockets) {
    if (rooms.some((r) => s.rooms.has(r))) s.emit(event, payload);
  }
};

const toPlain = (doc: any) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

/** Rooms that may receive full order details: all staff, the owning customer, and the order's tracking room. */
const orderAudienceRooms = (order: any): string[] => {
  const rooms = [...STAFF_ROOMS, orderRoom(String(order._id))];
  if (order.customerId) rooms.push(userRoom(String(order.customerId)));
  return rooms;
};

// ─── Order events (data refresh only — the bell/notification list is driven by `notification`) ───
export const emitOrderUpdate = (order: any): void => {
  emitToRooms(orderAudienceRooms(order), 'order:updated', toPlain(order));
};

export const emitKitchenNewOrder = (order: any): void => {
  emitToRooms([roleRoom('kitchen'), roleRoom('admin'), roleRoom('manager')], 'kitchen:new_order', toPlain(order));
};

export const emitOrderReadyForWaiter = (order: any): void => {
  emitToRooms([roleRoom('waiter')], 'waiter:order_ready', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    tableNumber: order.tableNumber,
    seats: order.seats,
  });
};

export const emitOrderReadyForDelivery = (order: any): void => {
  emitToRooms([roleRoom('delivery')], 'delivery:order_ready', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    address: order.address,
  });
};

export const emitWaiterClaimedOrder = (order: any, waiterName: string): void => {
  emitToRooms(STAFF_ROOMS, 'order:waiter_claimed', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    waiterName,
  });
};

export const emitDeliveryClaimedOrder = (order: any, deliveryName: string): void => {
  emitToRooms(STAFF_ROOMS, 'order:delivery_claimed', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    deliveryName,
  });
};

// ─── Tables: staff get full details, everyone else gets an anonymised copy ───
export const sanitizeTableForPublic = (table: any) => {
  const t = toPlain(table);
  return {
    _id: t._id,
    number: t.number,
    tableName: t.tableName,
    capacity: t.capacity,
    section: t.section,
    status: t.status,
    seats: (t.seats || []).map((s: any) => ({ seatNumber: s.seatNumber, status: s.status })),
  };
};

export const emitTableStatusChange = (table: any): void => {
  if (!ioInstance) return;
  ioInstance.to(STAFF_ROOMS).emit('table:updated', toPlain(table));
  ioInstance.except(STAFF_ROOMS).emit('table:updated', sanitizeTableForPublic(table));
};

// ─── Inventory / payments (staff only) ───
export const emitLowStockAlert = (item: any): void => {
  emitToRooms([roleRoom('admin'), roleRoom('manager'), roleRoom('kitchen')], 'inventory:low_stock', toPlain(item));
};

export const emitPaymentCreated = (payment: any): void => {
  emitToRooms([roleRoom('cashier'), roleRoom('admin'), roleRoom('manager')], 'payment:created', toPlain(payment));
};

// ─── Reservations ───
export const emitNewReservationRequest = (reservation: any): void => {
  emitToRooms([roleRoom('waiter'), roleRoom('manager'), roleRoom('admin')], 'reservation:new_request', {
    reservation: toPlain(reservation),
  });
};

export const emitReservationStatusUpdate = (reservation: any): void => {
  const rooms = [roleRoom('waiter'), roleRoom('manager'), roleRoom('admin')];
  if (reservation.customerId) rooms.push(userRoom(String(reservation.customerId)));
  emitToRooms(rooms, 'reservation:status_update', { reservation: toPlain(reservation) });
};
