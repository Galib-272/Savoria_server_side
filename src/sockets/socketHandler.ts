import { Server, Socket } from 'socket.io';

let ioInstance: Server | null = null;

export const initSocket = (io: Server): void => {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join room based on role (kitchen, waiter, delivery, cashier, manager, admin, customer)
    socket.on('join_role_room', (role: string) => {
      if (role) {
        socket.join(`role:${role}`);
        console.log(`[Socket.IO] ${socket.id} joined room role:${role}`);
      }
    });

    // Customer tracking specific order
    socket.on('join_order_room', (orderId: string) => {
      if (orderId) {
        socket.join(`order:${orderId}`);
        console.log(`[Socket.IO] ${socket.id} joined room order:${orderId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

export const getIO = (): Server => {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return ioInstance;
};

// Real-time helper emitters
export const emitOrderUpdate = (order: any): void => {
  if (!ioInstance) return;
  // Send to all staff and managers/admin
  ioInstance.emit('order:updated', order);
  // Send to specific order room for customer tracking
  ioInstance.to(`order:${order._id}`).emit('order:customer_update', order);
  ioInstance.to(`order:${order.orderNumber}`).emit('order:customer_update', order);
};

export const emitKitchenNewOrder = (order: any): void => {
  if (!ioInstance) return;
  ioInstance.to('role:kitchen').emit('kitchen:new_order', order);
  ioInstance.to('role:admin').emit('kitchen:new_order', order);
  ioInstance.to('role:manager').emit('kitchen:new_order', order);
  ioInstance.emit('order:updated', order);
};

export const emitOrderReadyForWaiter = (order: any): void => {
  if (!ioInstance) return;
  ioInstance.to('role:waiter').emit('waiter:order_ready', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    tableNumber: order.tableNumber,
    seats: order.seats,
    message: `Order ${order.orderNumber} is READY for Dine-In serving!`,
  });
};

export const emitOrderReadyForDelivery = (order: any): void => {
  if (!ioInstance) return;
  ioInstance.to('role:delivery').emit('delivery:order_ready', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    address: order.address,
    message: `Order ${order.orderNumber} is READY for delivery pickup!`,
  });
};

export const emitWaiterClaimedOrder = (order: any, waiterName: string): void => {
  if (!ioInstance) return;
  ioInstance.emit('order:waiter_claimed', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    waiterName,
    message: `Food assigned to waiter ${waiterName}`,
  });
};

export const emitDeliveryClaimedOrder = (order: any, deliveryName: string): void => {
  if (!ioInstance) return;
  ioInstance.emit('order:delivery_claimed', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    deliveryName,
    message: `Food was picked up by ${deliveryName}`,
  });
};

export const emitTableStatusChange = (table: any): void => {
  if (!ioInstance) return;
  ioInstance.emit('table:updated', table);
};

export const emitLowStockAlert = (item: any): void => {
  if (!ioInstance) return;
  ioInstance.to('role:manager').emit('inventory:low_stock', item);
  ioInstance.to('role:admin').emit('inventory:low_stock', item);
};

// Reservation emitters
export const emitNewReservationRequest = (reservation: any, notification: any): void => {
  if (!ioInstance) return;
  // Notify all waiters, managers, and admins about new reservation request
  ioInstance.to('role:waiter').emit('reservation:new_request', { reservation, notification });
  ioInstance.to('role:manager').emit('reservation:new_request', { reservation, notification });
  ioInstance.to('role:admin').emit('reservation:new_request', { reservation, notification });

  const notifPayload = {
    id: notification.id || notification._id,
    title: notification.title,
    message: notification.message,
    type: 'reservation',
    targetRoles: ['waiter', 'manager', 'admin'],
    reservationId: notification.reservationId,
    tableNumber: notification.tableNumber,
    time: notification.time || 'Just now',
    createdAt: new Date().toISOString(),
  };
  ioInstance.to('role:waiter').emit('notification', notifPayload);
  ioInstance.to('role:manager').emit('notification', notifPayload);
  ioInstance.to('role:admin').emit('notification', notifPayload);
};

export const emitReservationStatusUpdate = (reservation: any, notification: any): void => {
  if (!ioInstance) return;
  // Notify all roles about reservation status change
  ioInstance.to('role:customer').emit('reservation:status_update', { reservation, notification });
  ioInstance.to('role:waiter').emit('reservation:status_update', { reservation, notification });
  ioInstance.to('role:manager').emit('reservation:status_update', { reservation, notification });
  ioInstance.to('role:admin').emit('reservation:status_update', { reservation, notification });

  const notifPayload = {
    id: notification.id || notification._id,
    title: notification.title,
    message: notification.message,
    type: 'reservation',
    targetRoles: ['customer', 'waiter', 'manager', 'admin'],
    recipientId: reservation.customerId,
    reservationId: notification.reservationId,
    tableNumber: notification.tableNumber,
    time: notification.time || 'Just now',
    createdAt: new Date().toISOString(),
  };
  ioInstance.to('role:customer').emit('notification', notifPayload);
  ioInstance.to('role:waiter').emit('notification', notifPayload);
  ioInstance.to('role:manager').emit('notification', notifPayload);
  ioInstance.to('role:admin').emit('notification', notifPayload);
};
