import { Response } from 'express';
import { Order, IOrder } from '../models/Order.model.js';
import { Table } from '../models/Table.model.js';
import { MenuItem } from '../models/MenuItem.model.js';
import { InventoryItem } from '../models/Inventory.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import {
  emitOrderUpdate,
  emitKitchenNewOrder,
  emitOrderReadyForWaiter,
  emitOrderReadyForDelivery,
  emitWaiterClaimedOrder,
  emitDeliveryClaimedOrder,
  emitTableStatusChange,
} from '../sockets/socketHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { Notification } from '../models/Notification.model.js';
import { Payment } from '../models/Payment.model.js';
import { generateUniqueReceiptNumber } from './payment.controller.js';

const getFormattedTime = () => {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// Auto deduct inventory recipe ingredients upon order completion
const deductInventoryForOrder = async (order: IOrder) => {
  try {
    for (const item of order.items) {
      if (!item.menuItemId) continue;
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (menuItem && menuItem.recipe && menuItem.recipe.length > 0) {
        for (const recipeItem of menuItem.recipe) {
          const totalDeduct = recipeItem.amount * item.quantity;
          const invItem = await InventoryItem.findOne({ name: recipeItem.inventoryItemName });
          if (invItem) {
            invItem.currentStock = Math.max(0, invItem.currentStock - totalDeduct);
            await invItem.save();
          }
        }
      }
    }
  } catch (err) {
    console.error('Error auto-deducting inventory:', err);
  }
};

export const createOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      orderType,
      tableNumber,
      seats,
      items,
      notes,
      address,
      discount = 0,
    } = req.body;

    if (!customerName || !items || !items.length) {
      res.status(400).json({ success: false, message: 'Customer name and order items are required.' });
      return;
    }

    // Generate unique order number (e.g. #1031)
    const orderCount = await Order.countDocuments();
    const orderNumber = `#${1025 + orderCount}`;

    // Calculate item prices and subtotal
    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      let itemPrice = item.price;
      if (item.modifiers && Array.isArray(item.modifiers)) {
        item.modifiers.forEach((mod: any) => {
          if (typeof mod === 'object' && mod.price) {
            itemPrice += mod.price;
          }
        });
      }
      const lineTotal = itemPrice * (item.quantity || 1);
      subtotal += lineTotal;
      return {
        menuItemId: item.menuItemId || item.id,
        name: item.name,
        quantity: item.quantity || 1,
        price: item.price,
        modifiers: item.modifiers || [],
      };
    });

    const tax = Math.round(subtotal * 0.1); // 10% tax
    const deliveryFee = orderType === 'delivery' ? 50 : 0;
    const total = Math.max(0, subtotal - discount + tax + deliveryFee);

    const paymentMethod = req.body.paymentMethod || 'cash';
    const isCashOrPaid = req.body.paymentStatus === 'paid' || paymentMethod === 'cash';
    const finalPaymentStatus = isCashOrPaid ? 'paid' : 'pending';
    const currentTime = getFormattedTime();

    const order = await Order.create({
      orderNumber,
      customerName,
      customerPhone,
      customerEmail: customerEmail || req.user?.email,
      customerId: req.user?.userId,
      orderType: orderType || 'dine-in',
      tableNumber,
      seats: seats || [],
      items: orderItems,
      subtotal,
      discount,
      tax,
      deliveryFee,
      total,
      paymentMethod,
      paymentStatus: finalPaymentStatus,
      paidAt: isCashOrPaid ? new Date() : undefined,
      status: 'new',
      notes,
      address,
      timeline: [{ time: currentTime, status: 'new', label: isCashOrPaid ? `Order Placed & Paid (৳${total}) via ${paymentMethod}` : 'Order Created' }],
    });

    // If order was paid (Cash or Online Card/Transfer), record the transaction in Payment model
    if (isCashOrPaid) {
      const receiptNumber = await generateUniqueReceiptNumber();
      const payment = await Payment.create({
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        amount: order.total,
        paymentMethod,
        paymentStatus: 'paid',
        cashierName: req.user?.name ? `${req.user.name} (Online)` : 'Customer (Online Checkout)',
        receiptNumber,
        stripePaymentIntentId: req.body.stripePaymentIntentId,
        notes: req.body.notes,
      });

      const io = (global as any).io || (await import('../sockets/socketHandler.js')).getIO();
      if (io) {
        io.emit('payment:created', payment);
      }
    }

    // If dine-in, mark table and seats occupied
    if (orderType === 'dine-in' && tableNumber) {
      const table = await Table.findOne({ number: tableNumber });
      if (table) {
        table.status = 'occupied';
        table.currentOrderId = order._id.toString();
        if (seats && Array.isArray(seats)) {
          table.seats.forEach((s) => {
            if (seats.includes(s.seatNumber)) {
              s.status = 'occupied';
              s.currentCustomerName = customerName;
              s.orderId = order._id.toString();
            }
          });
        }
        await table.save();
        emitTableStatusChange(table);
      }
    }

    // Real-time notification to cashier & kitchen
    emitOrderUpdate(order);

    await Notification.create({
      title: 'New Order Received',
      message: `Order ${order.orderNumber} placed by ${order.customerName} (৳${order.total}) - Payment: ${finalPaymentStatus.toUpperCase()}`,
      type: 'order',
      orderId: order._id.toString(),
      recipientRole: 'cashier',
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, orderType, paymentStatus, search, email, page = 1, limit = 50 } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search as string, $options: 'i' } },
        { customerName: { $regex: search as string, $options: 'i' } },
        { customerPhone: { $regex: search as string, $options: 'i' } },
      ];
    }

    // If customer role, only show customer's own orders (by ID or email)
    if (req.user && req.user.role === 'customer') {
      const userEmail = (req.user.email || '').trim();
      filter.$or = [
        { customerId: req.user.userId },
        { customerEmail: { $regex: `^${userEmail}$`, $options: 'i' } },
      ];
    } else if (email) {
      // Allow explicit email query filter (case-insensitive)
      const targetEmail = (email as string).trim();
      filter.customerEmail = { $regex: `^${targetEmail}$`, $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: Number(page),
      data: orders,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { orderNumber: id }],
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to save Notification to DB and push real-time socket alert to all target roles
const emitSocketAndCreateNotification = async ({
  title,
  message,
  type,
  orderId,
  tableNumber,
  roles = [],
}: {
  title: string;
  message: string;
  type: 'order' | 'kitchen' | 'table' | 'delivery' | 'inventory' | 'payment' | 'system';
  orderId?: string;
  tableNumber?: number;
  roles?: string[];
}) => {
  try {
    const notif = await Notification.create({
      title,
      message,
      type,
      orderId,
      tableNumber,
    });

    const io = (global as any).io || (await import('../sockets/socketHandler.js')).getIO();
    if (io) {
      const payload = {
        id: notif._id.toString(),
        title: notif.title,
        message: notif.message,
        type: notif.type,
        orderId: notif.orderId,
        read: false,
        time: 'Just now',
      };
      const uniqueRoles = Array.from(new Set([...roles, 'admin', 'manager', 'customer']));
      uniqueRoles.forEach((r) => {
        io.to(`role:${r}`).emit('notification', payload);
      });

      // Broadcast globally so all active customer panels, order trackers & notification bells update instantly
      io.emit('notification', payload);

      // Send to specific order room and global customer listeners
      if (orderId) {
        io.to(`order:${orderId}`).emit('notification', payload);
        io.to(`order:${orderId}`).emit('order:customer_update', {
          orderId,
          title,
          message,
          type,
          time: 'Just now',
        });
        io.emit('order:customer_update', {
          orderId,
          title,
          message,
          type,
          time: 'Just now',
        });
      }
    }

    // Also persist customer notification in database for customer panel
    if (orderId) {
      await Notification.create({
        title,
        message,
        type,
        orderId,
        tableNumber,
        recipientRole: 'customer',
      });
    }

    return notif;
  } catch (err) {
    console.error('Failed to create/emit notification:', err);
  }
};

// --- COOK / KITCHEN WORKFLOW ---
export const startPreparingOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    order.status = 'preparing';
    order.kitchenStaffId = req.user?.userId;
    order.kitchenStaffName = req.user?.name || 'Kitchen Chef';
    order.timeline.push({
      time: getFormattedTime(),
      status: 'preparing',
      label: `Kitchen Started Preparation (${order.kitchenStaffName})`,
    });

    await order.save();
    emitOrderUpdate(order);

    // Notification for state change: New -> Preparing
    await emitSocketAndCreateNotification({
      title: 'Kitchen Started Preparing',
      message: `Kitchen started preparing Order ${order.orderNumber}`,
      type: 'kitchen',
      orderId: order._id.toString(),
      tableNumber: order.tableNumber,
      roles: ['waiter', 'cashier', 'admin', 'manager', 'kitchen'],
    });

    res.status(200).json({
      success: true,
      message: 'Order status updated to preparing',
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markOrderReady = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { targetPanel } = req.body; // 'dine-in', 'takeaway', or 'delivery'

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Preserve customer's chosen order type
    const finalType = order.orderType || targetPanel || 'dine-in';
    order.orderType = finalType;
    order.status = 'ready';

    let timelineLabel = 'Order Marked as Ready by Kitchen';
    if (finalType === 'dine-in') timelineLabel = 'Order Marked Ready for Dine-In Table Serving';
    else if (finalType === 'takeaway') timelineLabel = 'Order Marked Ready for Takeaway Handover';
    else if (finalType === 'delivery') timelineLabel = 'Order Marked Ready for Delivery Pickup';

    order.timeline.push({
      time: getFormattedTime(),
      status: 'ready',
      label: timelineLabel,
    });

    await order.save();
    emitOrderUpdate(order);

    // Route notifications based on the customer's chosen order type
    if (finalType === 'takeaway') {
      await emitSocketAndCreateNotification({
        title: 'Takeaway Order Ready',
        message: `Takeaway Order ${order.orderNumber} is packed and ready for customer handover!`,
        type: 'kitchen',
        orderId: order._id.toString(),
        roles: ['waiter', 'cashier', 'admin', 'manager', 'kitchen'],
      });
    } else if (finalType === 'delivery') {
      emitOrderReadyForDelivery(order);
      await emitSocketAndCreateNotification({
        title: 'Order Ready for Delivery',
        message: `Delivery Order ${order.orderNumber} is ready for rider pickup!`,
        type: 'delivery',
        orderId: order._id.toString(),
        roles: ['delivery', 'admin', 'manager', 'kitchen'],
      });
    } else {
      // Default / Dine-In
      emitOrderReadyForWaiter(order);
      await emitSocketAndCreateNotification({
        title: 'Order Ready for Serving',
        message: `Order ${order.orderNumber} (Table ${order.tableNumber || 'N/A'}) is ready for serving!`,
        type: 'kitchen',
        orderId: order._id.toString(),
        tableNumber: order.tableNumber,
        roles: ['waiter', 'admin', 'manager', 'kitchen'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order marked as ready and notification routed successfully',
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- WAITER WORKFLOW ---
export const waiterClaimFood = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const waiterName = req.user?.name || req.body.waiterName || 'Waiter';
    const waiterId = req.user?.userId || req.body.waiterId;

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Waiters can only claim Dine-In orders
    if (order.orderType === 'takeaway' || order.orderType === 'delivery') {
      res.status(400).json({
        success: false,
        message: 'Waiters can only take Dine-In orders. Takeaway and Delivery cannot be claimed by waiters.',
      });
      return;
    }

    // Check if another waiter has already claimed this food
    if (order.waiterId && order.waiterId !== waiterId && order.waiterName) {
      res.status(400).json({
        success: false,
        message: `Food already claimed by waiter ${order.waiterName}. You cannot take this food.`,
      });
      return;
    }

    order.waiterId = waiterId;
    order.waiterName = waiterName;
    // Keep status as 'ready' (claimed/assigned) so waiter can pick it up and then mark it 'served'!
    order.status = 'ready';
    order.timeline.push({
      time: getFormattedTime(),
      status: 'ready',
      label: `Order Claimed by Waiter ${waiterName} (Taking Food)`,
    });

    await order.save();

    // Broadcast to cook panel and all waiters: locks food for others
    emitWaiterClaimedOrder(order, waiterName);
    emitOrderUpdate(order);

    await emitSocketAndCreateNotification({
      title: 'Food Claimed by Waiter',
      message: `Waiter ${waiterName} took Order ${order.orderNumber} to serve to Table ${order.tableNumber || 'N/A'}`,
      type: 'kitchen',
      orderId: order._id.toString(),
      tableNumber: order.tableNumber,
      roles: ['kitchen', 'admin', 'manager', 'cashier'],
    });

    res.status(200).json({
      success: true,
      message: `Food successfully assigned to waiter ${waiterName}`,
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- DELIVERY WORKFLOW ---
export const deliveryPickupFood = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deliveryName = req.user?.name || req.body.deliveryStaffName || 'Delivery Rider';
    const deliveryStaffId = req.user?.userId || req.body.deliveryStaffId;

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (order.deliveryStaffId && order.deliveryStaffId !== deliveryStaffId && order.deliveryStaffName) {
      res.status(400).json({
        success: false,
        message: `Food was already picked up by ${order.deliveryStaffName}`,
      });
      return;
    }

    order.deliveryStaffId = deliveryStaffId;
    order.deliveryStaffName = deliveryName;
    order.status = 'picked_up';
    order.timeline.push({
      time: getFormattedTime(),
      status: 'picked_up',
      label: `Order Picked Up by ${deliveryName}`,
    });

    await order.save();

    emitDeliveryClaimedOrder(order, deliveryName);
    emitOrderUpdate(order);

    await emitSocketAndCreateNotification({
      title: 'Delivery Food Picked Up',
      message: `Order ${order.orderNumber} was picked up by rider ${deliveryName}`,
      type: 'delivery',
      orderId: order._id.toString(),
      roles: ['kitchen', 'admin', 'manager', 'cashier'],
    });

    res.status(200).json({
      success: true,
      message: `Food picked up by ${deliveryName}`,
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deliveryMarkOutForDelivery = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    order.status = 'out_for_delivery';
    order.timeline.push({
      time: getFormattedTime(),
      status: 'out_for_delivery',
      label: 'Out for Delivery to Customer',
    });

    await order.save();
    emitOrderUpdate(order);

    await emitSocketAndCreateNotification({
      title: 'Order Out for Delivery',
      message: `Order ${order.orderNumber} is out for delivery with rider`,
      type: 'delivery',
      orderId: order._id.toString(),
      roles: ['admin', 'manager', 'cashier', 'delivery', 'kitchen'],
    });

    res.status(200).json({
      success: true,
      message: 'Order marked as out for delivery',
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deliveryMarkDelivered = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    order.status = 'delivered';
    order.completedAt = new Date();
    order.timeline.push({
      time: getFormattedTime(),
      status: 'delivered',
      label: 'Delivered Successfully to Customer',
    });

    await order.save();
    emitOrderUpdate(order);

    // Auto deduct inventory
    await deductInventoryForOrder(order);

    await emitSocketAndCreateNotification({
      title: 'Delivery Order Delivered',
      message: `Order ${order.orderNumber} has been delivered successfully to customer`,
      type: 'delivery',
      orderId: order._id.toString(),
      roles: ['kitchen', 'admin', 'manager', 'cashier', 'delivery'],
    });

    res.status(200).json({
      success: true,
      message: 'Order marked as delivered successfully',
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generic complete or cancel order
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    order.status = status;
    if (notes) order.notes = notes;

    const statusLabel =
      status === 'served'
        ? `Order Served to Table by Waiter ${req.user?.name || ''}`.trim()
        : `Status changed to ${status}`;

    order.timeline.push({
      time: getFormattedTime(),
      status,
      label: statusLabel,
    });

    if (status === 'completed' || status === 'served') {
      if (status === 'served' && req.user?.name) {
        order.waiterName = req.user.name;
        order.waiterId = req.user.userId;
      }
    }

    if (status === 'completed') {
      order.completedAt = new Date();
      // Free table if dine-in
      if (order.tableNumber) {
        const table = await Table.findOne({ number: order.tableNumber });
        if (table) {
          table.status = 'cleaning';
          table.currentOrderId = undefined;
          await table.save();
          emitTableStatusChange(table);
        }
      }
      await deductInventoryForOrder(order);
    }

    await order.save();
    emitOrderUpdate(order);

    // State change notifications
    if (status === 'served') {
      await emitSocketAndCreateNotification({
        title: 'Order Served to Table',
        message: `Order ${order.orderNumber} (Table ${order.tableNumber || 'N/A'}) was served by waiter ${req.user?.name || 'Staff'}.`,
        type: 'table',
        orderId: order._id.toString(),
        tableNumber: order.tableNumber,
        roles: ['kitchen', 'admin', 'manager', 'cashier', 'waiter'],
      });
    } else if (status === 'completed') {
      await emitSocketAndCreateNotification({
        title: order.orderType === 'takeaway' ? 'Takeaway Handover Completed' : 'Order Completed',
        message: order.orderType === 'takeaway'
          ? `Takeaway Order ${order.orderNumber} was handed over to customer.`
          : `Order ${order.orderNumber} is marked as completed.`,
        type: 'order',
        orderId: order._id.toString(),
        roles: ['kitchen', 'admin', 'manager', 'cashier', 'waiter'],
      });
    } else if (status === 'cancelled') {
      await emitSocketAndCreateNotification({
        title: 'Order Cancelled',
        message: `Order ${order.orderNumber} was cancelled.`,
        type: 'order',
        orderId: order._id.toString(),
        roles: ['kitchen', 'admin', 'manager', 'cashier', 'waiter'],
      });
    } else {
      await emitSocketAndCreateNotification({
        title: `Order Status: ${status}`,
        message: `Order ${order.orderNumber} status changed to ${status}`,
        type: 'order',
        orderId: order._id.toString(),
        roles: ['kitchen', 'admin', 'manager', 'cashier', 'waiter'],
      });
    }

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'staff',
      action: 'UPDATE_ORDER_STATUS',
      entity: 'Order',
      entityId: order._id.toString(),
      details: `Order ${order.orderNumber} status changed to ${status}`,
    });

    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
