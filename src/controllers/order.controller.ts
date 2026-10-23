import { Response } from 'express';
import { Order, IOrder } from '../models/Order.model.js';
import { Table } from '../models/Table.model.js';
import { MenuItem } from '../models/MenuItem.model.js';
import { InventoryItem } from '../models/Inventory.model.js';
import { AuthenticatedRequest, OrderStatus, OrderType } from '../types/index.js';
import {
  emitOrderUpdate,
  emitKitchenNewOrder,
  emitOrderReadyForWaiter,
  emitOrderReadyForDelivery,
  emitWaiterClaimedOrder,
  emitDeliveryClaimedOrder,
  emitTableStatusChange,
  emitLowStockAlert,
} from '../sockets/socketHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { notify } from '../services/notification.service.js';
import { getRestaurantSettings } from '../services/settings.service.js';
import { evaluateCoupon, consumeCoupon, CouponError } from '../services/coupon.service.js';
import { normalizePaymentMethod, recordPaymentForOrder } from '../services/payment.service.js';
import { escapeRegex, formattedTime, isStaffRole, isValidObjectId, nextSequence } from '../utils/helpers.js';

const ORDER_TYPES: OrderType[] = ['dine-in', 'takeaway', 'delivery'];
const VALID_SEATS = ['S1', 'S2', 'S3', 'S4'];
const ACTIVE_STATUSES: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'served', 'picked_up', 'out_for_delivery'];

const fail = (res: Response, status: number, message: string) => {
  res.status(status).json({ success: false, message });
};

const handleError = (res: Response, error: any) => {
  const status = error?.status || (error?.name === 'ValidationError' || error?.name === 'CastError' ? 400 : 500);
  res.status(status).json({ success: false, message: error?.message || 'Server error' });
};

const actorOf = (req: AuthenticatedRequest) => ({
  userId: req.user?.userId,
  name: req.user?.name,
  role: req.user?.role,
});

/** Next order number (#1029, #1030, …) — atomic, never collides even after deletions. */
const nextOrderNumber = async (): Promise<string> => {
  const seq = await nextSequence('order', async () => {
    const orders = await Order.find({ orderNumber: /^#\d+$/ }).select('orderNumber').lean();
    return orders.reduce((max, o) => Math.max(max, parseInt(o.orderNumber.slice(1), 10) || 0), 1024);
  });
  return `#${seq}`;
};

const loadOrder = async (res: Response, id: string): Promise<IOrder | null> => {
  if (!isValidObjectId(id)) {
    fail(res, 400, 'Invalid order id');
    return null;
  }
  const order = await Order.findById(id);
  if (!order) {
    fail(res, 404, 'Order not found');
    return null;
  }
  return order;
};

const isOwner = (req: AuthenticatedRequest, order: IOrder): boolean =>
  !!req.user &&
  (order.customerId === req.user.userId ||
    (!!order.customerEmail && order.customerEmail.toLowerCase() === req.user.email.toLowerCase()));

// ─── Inventory: deducted exactly once per order (when the kitchen marks it ready) ───
const deductInventoryForOrder = async (order: IOrder) => {
  if (order.inventoryDeducted) return;
  order.inventoryDeducted = true;
  try {
    for (const item of order.items) {
      if (!item.menuItemId || !isValidObjectId(item.menuItemId)) continue;
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem?.recipe?.length) continue;
      for (const recipeItem of menuItem.recipe) {
        const invItem = await InventoryItem.findOne({
          name: { $regex: `^${escapeRegex(recipeItem.inventoryItemName)}$`, $options: 'i' },
        });
        if (!invItem) continue;
        const previousStatus = invItem.status;
        invItem.currentStock = Math.max(0, +(invItem.currentStock - recipeItem.amount * item.quantity).toFixed(3));
        await invItem.save();
        if (invItem.status !== 'in_stock' && invItem.status !== previousStatus) {
          emitLowStockAlert(invItem);
          await notify({
            title: invItem.status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock Alert',
            message: `${invItem.name} is ${invItem.status === 'out_of_stock' ? 'out of stock' : 'running low'} (${invItem.currentStock} ${invItem.unit} left)`,
            type: 'inventory',
            roles: ['kitchen'],
          });
        }
      }
    }
  } catch (err) {
    console.error('Error auto-deducting inventory:', err);
  }
};

// ─── Tables: occupy chosen seats / release them when the order ends ───
const occupyTableForOrder = async (order: IOrder, seats: string[]) => {
  if (order.orderType !== 'dine-in' || !order.tableNumber) return;
  const table = await Table.findOne({ number: order.tableNumber });
  if (!table) return;
  table.status = 'occupied';
  table.currentOrderId = order._id.toString();
  table.seats.forEach((s) => {
    if (seats.includes(s.seatNumber)) {
      s.status = 'occupied';
      s.currentCustomerName = order.customerName;
      s.orderId = order._id.toString();
      s.reservationId = undefined;
    }
  });
  await table.save();
  emitTableStatusChange(table);
};

const releaseTableForOrder = async (order: IOrder, reason: 'completed' | 'cancelled') => {
  if (order.orderType !== 'dine-in' || !order.tableNumber) return;
  const table = await Table.findOne({ number: order.tableNumber });
  if (!table) return;
  const orderId = order._id.toString();
  table.seats.forEach((s) => {
    if (s.orderId === orderId) {
      s.status = 'available';
      s.orderId = undefined;
      s.currentCustomerName = undefined;
    }
  });
  const stillOccupied = table.seats.find((s) => s.status === 'occupied');
  const stillReserved = table.seats.some((s) => s.status === 'reserved');
  if (stillOccupied) {
    table.status = 'occupied';
    table.currentOrderId = stillOccupied.orderId || (table.currentOrderId === orderId ? undefined : table.currentOrderId);
  } else {
    table.currentOrderId = undefined;
    if (table.status === 'occupied') {
      table.status = reason === 'completed' ? 'cleaning' : stillReserved ? 'reserved' : 'available';
    }
  }
  await table.save();
  emitTableStatusChange(table);
};

// ─── CREATE ───
export const createOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const isCustomer = user.role === 'customer';
    const { customerName, customerPhone, customerEmail, notes, address, couponCode } = req.body;
    const orderType: OrderType = ORDER_TYPES.includes(req.body.orderType) ? req.body.orderType : 'dine-in';
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const rawSeats: unknown = req.body.seats ?? req.body.selectedSeats ?? [];
    const seats = Array.from(new Set((Array.isArray(rawSeats) ? rawSeats : []).map(String))).filter((s) =>
      VALID_SEATS.includes(s)
    );

    const name = String(customerName || (isCustomer ? user.name : '') || '').trim();
    if (!name || rawItems.length === 0) {
      fail(res, 400, 'Customer name and order items are required.');
      return;
    }
    if (orderType === 'delivery' && !String(address || req.body.deliveryAddress || '').trim()) {
      fail(res, 400, 'Delivery address is required for delivery orders.');
      return;
    }

    // Prices always come from the database — never from the browser
    let subtotal = 0;
    const orderItems: IOrder['items'] = [];
    for (const raw of rawItems) {
      const menuItemId = String(raw.menuItemId || raw.id || '');
      const quantity = Math.floor(Number(raw.quantity) || 0);
      if (!isValidObjectId(menuItemId)) {
        fail(res, 400, `"${raw.name || 'Item'}" is not a valid menu item. Please refresh the menu and try again.`);
        return;
      }
      if (quantity < 1 || quantity > 99) {
        fail(res, 400, `Invalid quantity for "${raw.name || 'item'}".`);
        return;
      }
      const menuItem = await MenuItem.findById(menuItemId);
      if (!menuItem) {
        fail(res, 400, `"${raw.name || 'Item'}" is no longer on the menu.`);
        return;
      }
      if (!menuItem.available) {
        fail(res, 400, `"${menuItem.name}" is currently unavailable.`);
        return;
      }
      const basePrice =
        menuItem.discountPrice !== undefined && menuItem.discountPrice !== null && menuItem.discountPrice > 0
          ? menuItem.discountPrice
          : menuItem.price;

      // Modifiers: only options that exist on this menu item, priced from the database
      const requestedMods: any[] = Array.isArray(raw.modifiers) ? raw.modifiers : [];
      const allOptions = (menuItem.modifiers || []).flatMap((m) => m.options || []);
      const modifiers = requestedMods
        .map((m) => {
          const modName = typeof m === 'string' ? m : m?.name;
          const option = allOptions.find((o) => o.name === modName || o.id === m?.id);
          return option ? { name: option.name, price: option.price || 0 } : null;
        })
        .filter(Boolean) as { name: string; price: number }[];

      const unitPrice = basePrice + modifiers.reduce((s, m) => s + m.price, 0);
      subtotal += unitPrice * quantity;
      orderItems.push({ menuItemId, name: menuItem.name, quantity, price: basePrice, modifiers });
    }

    // Dine-in: validate table & seats and make sure nobody else is sitting there
    let tableNumber: number | undefined;
    if (orderType === 'dine-in') {
      tableNumber = Number(req.body.tableNumber);
      if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 25) {
        fail(res, 400, 'Please choose a valid table (T1–T25) for dine-in orders.');
        return;
      }
      const table = await Table.findOne({ number: tableNumber });
      if (!table) {
        fail(res, 400, `Table T${tableNumber} does not exist.`);
        return;
      }
      if (table.status === 'out_of_service' || table.status === 'cleaning') {
        fail(res, 409, `Table T${tableNumber} is not available right now (${table.status.replace(/_/g, ' ')}).`);
        return;
      }
      if (isCustomer && seats.length === 0) {
        fail(res, 400, 'Please select at least one seat.');
        return;
      }
      const blocked = table.seats.filter((s) => seats.includes(s.seatNumber) && s.status === 'occupied');
      if (blocked.length) {
        fail(res, 409, `Seat(s) ${blocked.map((s) => s.seatNumber).join(', ')} on T${tableNumber} are already occupied.`);
        return;
      }
    }

    // Coupon is re-validated on the server and its usage counted
    let discount = 0;
    let appliedCoupon: any = null;
    if (couponCode) {
      try {
        const result = await evaluateCoupon(couponCode, subtotal);
        discount = result.discount;
        appliedCoupon = result.coupon;
      } catch (err: any) {
        if (err instanceof CouponError) {
          fail(res, err.status, err.message);
          return;
        }
        throw err;
      }
    }

    const settings = await getRestaurantSettings();
    const taxRate = Number(settings.taxRate) || 0;
    const tax = Math.round((subtotal * taxRate) / 100);
    const deliveryFee = orderType === 'delivery' ? Number(settings.deliveryFee) || 0 : 0;
    const total = Math.max(0, subtotal - discount + tax + deliveryFee);

    // Payment: online card / mobile banking / bank transfer go through the demo Stripe page and are paid now.
    // Cash is collected later (at the counter, by the waiter, or by the rider) — POS records it right after.
    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
    const paidOnline = isCustomer && paymentMethod !== 'cash';
    if (paidOnline && !req.body.stripePaymentIntentId) {
      fail(res, 400, 'Online payment was not completed. Please try again.');
      return;
    }

    if (appliedCoupon && !(await consumeCoupon(appliedCoupon._id))) {
      fail(res, 400, 'Coupon usage limit has been reached.');
      return;
    }

    const order = new Order({
      orderNumber: await nextOrderNumber(),
      customerName: name,
      customerPhone: customerPhone || undefined,
      customerEmail: isCustomer ? user.email : customerEmail ? String(customerEmail).toLowerCase().trim() : undefined,
      customerId: isCustomer ? user.userId : undefined,
      orderType,
      tableNumber,
      seats: orderType === 'dine-in' ? seats : [],
      items: orderItems,
      subtotal,
      discount,
      couponCode: appliedCoupon?.code,
      tax,
      deliveryFee,
      total,
      paymentMethod,
      paymentStatus: 'pending',
      status: 'new',
      notes,
      address: orderType === 'delivery' ? String(address || req.body.deliveryAddress).trim() : undefined,
      waiterId: user.role === 'waiter' ? user.userId : undefined,
      waiterName: user.role === 'waiter' ? user.name : undefined,
      timeline: [
        {
          time: formattedTime(),
          status: 'new',
          label: isStaffRole(user.role) ? `Order Created by ${user.name} (${user.role})` : 'Order Placed',
        },
      ],
    });

    if (paidOnline) {
      await recordPaymentForOrder(order, {
        method: paymentMethod,
        collectedBy: actorOf(req),
        stripePaymentIntentId: req.body.stripePaymentIntentId,
      });
    }

    await order.save();
    await occupyTableForOrder(order, seats);

    emitOrderUpdate(order);
    emitKitchenNewOrder(order);

    await notify({
      title: 'New Order Received',
      message: `Order ${order.orderNumber} (${order.orderType}${order.tableNumber ? `, T${order.tableNumber}` : ''}) from ${order.customerName} — ৳${order.total}, ${order.paymentStatus === 'paid' ? 'paid' : 'payment pending'}`,
      type: 'order',
      roles: ['kitchen', 'cashier'],
      orderId: order._id.toString(),
      tableNumber: order.tableNumber,
      customerId: order.customerId,
      customerTitle: 'Order Placed',
      customerMessage: `Your order ${order.orderNumber} has been received and sent to the kitchen.`,
      actorId: user.userId,
    });

    res.status(201).json({ success: true, message: 'Order created successfully', data: order });
  } catch (error: any) {
    handleError(res, error);
  }
};

// ─── READ ───
export const getAllOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, orderType, paymentStatus, search, email } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const filter: any = {};

    if (status) {
      const list = String(status).split(',').map((s) => s.trim()).filter(Boolean);
      filter.status = list.length > 1 ? { $in: list } : list[0];
    }
    if (req.query.active === 'true') filter.status = { $in: ACTIVE_STATUSES };
    if (orderType) filter.orderType = String(orderType);
    if (paymentStatus) filter.paymentStatus = String(paymentStatus);

    const and: any[] = [];
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: 'i' };
      and.push({ $or: [{ orderNumber: rx }, { customerName: rx }, { customerPhone: rx }] });
    }

    if (req.user!.role === 'customer') {
      // Customers only ever see their own orders
      const ownEmail = `^${escapeRegex((req.user!.email || '').trim())}$`;
      and.push({ $or: [{ customerId: req.user!.userId }, { customerEmail: { $regex: ownEmail, $options: 'i' } }] });
    } else if (email) {
      and.push({ customerEmail: { $regex: `^${escapeRegex(String(email).trim())}$`, $options: 'i' } });
    }
    if (and.length) filter.$and = and;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, count: orders.length, total, page, data: orders });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const getOrderById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orderNumber = id.startsWith('#') ? id : `#${id}`;
    const order = await Order.findOne(isValidObjectId(id) ? { _id: id } : { orderNumber });
    if (!order) {
      fail(res, 404, 'Order not found');
      return;
    }
    if (req.user!.role === 'customer' && !isOwner(req, order)) {
      fail(res, 404, 'Order not found');
      return;
    }
    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    handleError(res, error);
  }
};

// ─── KITCHEN ───
export const startPreparingOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const order = await loadOrder(res, req.params.id);
    if (!order) return;
    if (!['new', 'confirmed'].includes(order.status)) {
      fail(res, 409, `Order ${order.orderNumber} is already ${order.status.replace(/_/g, ' ')}.`);
      return;
    }

    order.status = 'preparing';
    order.kitchenStaffId = req.user?.userId;
    order.kitchenStaffName = req.user?.name || 'Kitchen Chef';
    order.timeline.push({
      time: formattedTime(),
      status: 'preparing',
      label: `Kitchen Started Preparation (${order.kitchenStaffName})`,
    });
    await order.save();
    emitOrderUpdate(order);

    await notify({
      title: 'Kitchen Started Preparing',
      message: `${order.kitchenStaffName} started preparing Order ${order.orderNumber}`,
      type: 'kitchen',
      roles: [],
      orderId: order._id.toString(),
      tableNumber: order.tableNumber,
      customerId: order.customerId,
      customerTitle: 'Your food is being prepared 🍳',
      customerMessage: `The kitchen started preparing your order ${order.orderNumber}.`,
      actorId: req.user?.userId,
    });

    res.status(200).json({ success: true, message: 'Order status updated to preparing', data: order });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const markOrderReady = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const order = await loadOrder(res, req.params.id);
    if (!order) return;
    if (order.status !== 'preparing') {
      fail(res, 409, `Only orders that are being prepared can be marked ready (Order ${order.orderNumber} is ${order.status.replace(/_/g, ' ')}).`);
      return;
    }

    order.status = 'ready';
    const labels: Record<OrderType, string> = {
      'dine-in': 'Order Ready for Table Serving',
      takeaway: 'Order Packed & Ready for Takeaway',
      delivery: 'Order Ready for Delivery Pickup',
    };
    order.timeline.push({ time: formattedTime(), status: 'ready', label: labels[order.orderType] });

    await deductInventoryForOrder(order);
    await order.save();
    emitOrderUpdate(order);

    const base = { orderId: order._id.toString(), tableNumber: order.tableNumber, customerId: order.customerId, actorId: req.user?.userId };
    if (order.orderType === 'takeaway') {
      await notify({
        ...base,
        title: 'Takeaway Order Ready',
        message: `Takeaway Order ${order.orderNumber} is packed and ready for handover.`,
        type: 'kitchen',
        roles: ['cashier'],
        customerTitle: 'Your takeaway is ready 🥡',
        customerMessage: `Order ${order.orderNumber} is ready! Please collect it at the counter.`,
      });
    } else if (order.orderType === 'delivery') {
      emitOrderReadyForDelivery(order);
      await notify({
        ...base,
        title: 'Order Ready for Delivery',
        message: `Delivery Order ${order.orderNumber} is ready for rider pickup.`,
        type: 'delivery',
        roles: ['delivery'],
        customerTitle: 'Your order is ready 📦',
        customerMessage: `Order ${order.orderNumber} is packed and waiting for a rider.`,
      });
    } else {
      emitOrderReadyForWaiter(order);
      await notify({
        ...base,
        title: 'Order Ready for Serving',
        message: `Order ${order.orderNumber} (Table T${order.tableNumber || '?'}) is ready to be served.`,
        type: 'kitchen',
        roles: ['waiter'],
        customerTitle: 'Your food is ready 🍽️',
        customerMessage: `Order ${order.orderNumber} is ready and will be served to your table shortly.`,
      });
    }

    res.status(200).json({ success: true, message: 'Order marked as ready', data: order });
  } catch (error: any) {
    handleError(res, error);
  }
};

// ─── WAITER ───
export const waiterClaimFood = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const order = await loadOrder(res, req.params.id);
    if (!order) return;
    const waiterName = req.user!.name;
    const waiterId = req.user!.userId;

    if (order.orderType !== 'dine-in') {
      fail(res, 400, 'Waiters can only take Dine-In orders.');
      return;
    }
    if (order.status !== 'ready') {
      fail(res, 409, `Order ${order.orderNumber} is not ready to be taken (${order.status.replace(/_/g, ' ')}).`);
      return;
    }
    // Atomic claim — two waiters clicking at once can't both get it
    const claimed = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: 'ready',
        $or: [{ waiterId: waiterId }, { waiterId: { $exists: false } }, { waiterId: null }],
      },
      {
        $set: { waiterId, waiterName },
        $push: { timeline: { time: formattedTime(), status: 'ready', label: `Order Claimed by Waiter ${waiterName}` } },
      },
      { new: true }
    );
    if (!claimed || claimed.waiterId !== waiterId) {
      const fresh = await Order.findById(order._id);
      fail(res, 409, `Food already claimed by waiter ${fresh?.waiterName || 'another waiter'}.`);
      return;
    }

    emitWaiterClaimedOrder(claimed, waiterName);
    emitOrderUpdate(claimed);
    await notify({
      title: 'Food Taken by Waiter',
      message: `${waiterName} took Order ${claimed.orderNumber} to Table T${claimed.tableNumber || '?'}`,
      type: 'kitchen',
      roles: ['kitchen'],
      orderId: claimed._id.toString(),
      tableNumber: claimed.tableNumber,
      actorId: waiterId,
    });

    res.status(200).json({ success: true, message: `Food assigned to waiter ${waiterName}`, data: claimed });
  } catch (error: any) {
    handleError(res, error);
  }
};

// ─── DELIVERY ───
export const deliveryPickupFood = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const order = await loadOrder(res, req.params.id);
    if (!order) return;
    const deliveryName = req.user!.name;
    const deliveryStaffId = req.user!.userId;

    if (order.orderType !== 'delivery') {
      fail(res, 400, 'Only delivery orders can be picked up by a rider.');
      return;
    }
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, status: 'ready', $or: [{ deliveryStaffId: { $exists: false } }, { deliveryStaffId: null }, { deliveryStaffId }] },
      {
        $set: { status: 'picked_up', deliveryStaffId, deliveryStaffName: deliveryName },
        $push: { timeline: { time: formattedTime(), status: 'picked_up', label: `Order Picked Up by ${deliveryName}` } },
      },
      { new: true }
    );
    if (!claimed) {
      fail(
        res,
        409,
        order.deliveryStaffName && order.deliveryStaffId !== deliveryStaffId
          ? `Order was already picked up by ${order.deliveryStaffName}.`
          : `Order ${order.orderNumber} is not ready for pickup (${order.status.replace(/_/g, ' ')}).`
      );
      return;
    }

    emitDeliveryClaimedOrder(claimed, deliveryName);
    emitOrderUpdate(claimed);
    await notify({
      title: 'Delivery Picked Up',
      message: `Rider ${deliveryName} picked up Order ${claimed.orderNumber}`,
      type: 'delivery',
      roles: ['kitchen'],
      orderId: claimed._id.toString(),
      customerId: claimed.customerId,
      customerTitle: 'Rider picked up your order 🛵',
      customerMessage: `${deliveryName} picked up order ${claimed.orderNumber}.`,
      actorId: deliveryStaffId,
    });

    res.status(200).json({ success: true, message: `Food picked up by ${deliveryName}`, data: claimed });
  } catch (error: any) {
    handleError(res, error);
  }
};

const assertRider = (req: AuthenticatedRequest, res: Response, order: IOrder): boolean => {
  const role = req.user!.role;
  if (role === 'delivery' && order.deliveryStaffId && order.deliveryStaffId !== req.user!.userId) {
    fail(res, 403, `This order is assigned to ${order.deliveryStaffName}.`);
    return false;
  }
  return true;
};

export const deliveryMarkOutForDelivery = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const order = await loadOrder(res, req.params.id);
    if (!order) return;
    if (order.orderType !== 'delivery' || order.status !== 'picked_up') {
      fail(res, 409, `Order ${order.orderNumber} must be picked up before it can go out for delivery.`);
      return;
    }
    if (!assertRider(req, res, order)) return;

    order.status = 'out_for_delivery';
    order.timeline.push({ time: formattedTime(), status: 'out_for_delivery', label: 'Out for Delivery to Customer' });
    await order.save();
    emitOrderUpdate(order);

    await notify({
      title: 'Order Out for Delivery',
      message: `Order ${order.orderNumber} is on the way with ${order.deliveryStaffName || 'the rider'}`,
      type: 'delivery',
      roles: [],
      orderId: order._id.toString(),
      customerId: order.customerId,
      customerTitle: 'Your order is on the way 🛵',
      customerMessage: `Order ${order.orderNumber} is out for delivery.`,
      actorId: req.user?.userId,
    });

    res.status(200).json({ success: true, message: 'Order marked as out for delivery', data: order });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const deliveryMarkDelivered = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const order = await loadOrder(res, req.params.id);
    if (!order) return;
    if (order.orderType !== 'delivery' || !['picked_up', 'out_for_delivery'].includes(order.status)) {
      fail(res, 409, `Order ${order.orderNumber} has not been picked up yet.`);
      return;
    }
    if (!assertRider(req, res, order)) return;

    order.status = 'delivered';
    order.completedAt = new Date();
    order.timeline.push({ time: formattedTime(), status: 'delivered', label: 'Delivered Successfully to Customer' });

    // Cash on delivery: the rider collected the money
    if (order.paymentStatus !== 'paid') {
      await recordPaymentForOrder(order, { method: order.paymentMethod || 'cash', collectedBy: actorOf(req) });
    }
    await deductInventoryForOrder(order); // no-op if already deducted at "ready"
    await order.save();
    emitOrderUpdate(order);

    await notify({
      title: 'Order Delivered',
      message: `Order ${order.orderNumber} was delivered by ${order.deliveryStaffName || req.user?.name}`,
      type: 'delivery',
      roles: ['cashier'],
      orderId: order._id.toString(),
      customerId: order.customerId,
      customerTitle: 'Order delivered 🏠',
      customerMessage: `Order ${order.orderNumber} has been delivered. Enjoy your meal!`,
      actorId: req.user?.userId,
    });

    res.status(200).json({ success: true, message: 'Order marked as delivered successfully', data: order });
  } catch (error: any) {
    handleError(res, error);
  }
};

// ─── SERVED / COMPLETED / CANCELLED ───
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const order = await loadOrder(res, req.params.id);
    if (!order) return;
    const status = String(req.body.status || '') as OrderStatus;
    const role = req.user!.role;
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    const management = role === 'admin' || role === 'manager';

    if (!['served', 'completed', 'cancelled'].includes(status)) {
      fail(res, 400, 'Status must be served, completed or cancelled. Use the kitchen / delivery actions for other steps.');
      return;
    }

    if (role === 'customer') {
      if (!isOwner(req, order)) {
        fail(res, 404, 'Order not found');
        return;
      }
      const canPickUp = status === 'completed' && order.orderType === 'takeaway' && order.status === 'ready';
      const canCancel = status === 'cancelled' && order.status === 'new';
      if (!canPickUp && !canCancel) {
        fail(res, 403, 'You can only confirm pickup of a ready takeaway order, or cancel an order before the kitchen starts it.');
        return;
      }
      if (canPickUp && order.paymentStatus !== 'paid') {
        fail(res, 409, `Please pay ৳${order.total} at the counter — the cashier will hand over your order.`);
        return;
      }
    }

    // Allowed transitions
    if (status === 'served') {
      if (!['waiter', 'admin', 'manager'].includes(role)) {
        fail(res, 403, 'Only waiters can mark food as served.');
        return;
      }
      if (order.orderType !== 'dine-in' || order.status !== 'ready') {
        fail(res, 409, `Only ready dine-in orders can be served (Order ${order.orderNumber} is ${order.status.replace(/_/g, ' ')}).`);
        return;
      }
      if (role === 'waiter' && order.waiterId && order.waiterId !== req.user!.userId) {
        fail(res, 403, `This order was taken by ${order.waiterName}.`);
        return;
      }
    }

    if (status === 'completed') {
      const allowed =
        (order.orderType === 'dine-in' && order.status === 'served' && ['waiter', 'cashier', 'admin', 'manager'].includes(role)) ||
        (order.orderType === 'takeaway' && order.status === 'ready' && ['cashier', 'kitchen', 'admin', 'manager', 'customer'].includes(role)) ||
        (order.orderType === 'delivery' && order.status === 'delivered' && management);
      if (!allowed) {
        fail(res, 409, `Order ${order.orderNumber} can't be completed from "${order.status.replace(/_/g, ' ')}" by a ${role}.`);
        return;
      }
    }

    if (status === 'cancelled') {
      const finished = ['completed', 'delivered', 'cancelled', 'served', 'picked_up', 'out_for_delivery'].includes(order.status);
      if (finished) {
        fail(res, 409, `Order ${order.orderNumber} is already ${order.status.replace(/_/g, ' ')} and can't be cancelled.`);
        return;
      }
      if (!['admin', 'manager', 'cashier', 'customer'].includes(role)) {
        fail(res, 403, 'Only a cashier or manager can cancel orders.');
        return;
      }
    }

    order.status = status;
    if (notes) order.notes = order.notes ? `${order.notes}\n${notes}` : notes;

    const label =
      status === 'served'
        ? `Order Served to Table by ${req.user!.name}`
        : status === 'cancelled'
        ? `Order Cancelled by ${role === 'customer' ? 'customer' : req.user!.name}`
        : order.orderType === 'takeaway'
        ? `Takeaway Handed Over${role === 'customer' ? ' (confirmed by customer)' : ` by ${req.user!.name}`}`
        : `Order Completed by ${req.user!.name}`;
    order.timeline.push({ time: formattedTime(), status, label });

    if (status === 'served') {
      order.waiterId = order.waiterId || req.user!.userId;
      order.waiterName = order.waiterName || req.user!.name;
    }

    if (status === 'completed') {
      order.completedAt = new Date();
      // Pay-at-counter / pay-at-table cash orders are settled when the order is closed by staff
      if (order.paymentStatus !== 'paid' && role !== 'customer') {
        await recordPaymentForOrder(order, { method: order.paymentMethod || 'cash', collectedBy: actorOf(req) });
      }
      await deductInventoryForOrder(order);
      await releaseTableForOrder(order, 'completed');
    }

    if (status === 'cancelled') {
      order.cancelledAt = new Date();
      if (order.paymentStatus === 'paid') {
        order.paymentStatus = 'refunded';
        order.timeline.push({ time: formattedTime(), status: 'cancelled', label: `Payment of ৳${order.total} marked for refund` });
      }
      await releaseTableForOrder(order, 'cancelled');
    }

    await order.save();
    emitOrderUpdate(order);

    const base = { orderId: order._id.toString(), tableNumber: order.tableNumber, actorId: req.user!.userId };
    if (status === 'served') {
      await notify({
        ...base,
        title: 'Order Served',
        message: `Order ${order.orderNumber} was served to Table T${order.tableNumber || '?'} by ${req.user!.name}.`,
        type: 'table',
        roles: [],
        customerId: order.customerId,
        customerTitle: 'Food served 🍽️',
        customerMessage: `Order ${order.orderNumber} has been served. Enjoy your meal!`,
      });
    } else if (status === 'completed') {
      await notify({
        ...base,
        title: order.orderType === 'takeaway' ? 'Takeaway Handed Over' : 'Order Completed',
        message: `Order ${order.orderNumber} is completed.`,
        type: 'order',
        roles: order.orderType === 'takeaway' && role === 'customer' ? ['cashier'] : [],
        customerId: role === 'customer' ? undefined : order.customerId,
        customerTitle: 'Order completed ✅',
        customerMessage: `Thank you! Order ${order.orderNumber} is complete.`,
      });
    } else {
      const roles = ['kitchen', 'cashier'];
      if (order.orderType === 'dine-in') roles.push('waiter');
      if (order.orderType === 'delivery') roles.push('delivery');
      await notify({
        ...base,
        title: 'Order Cancelled',
        message: `Order ${order.orderNumber} was cancelled${role === 'customer' ? ' by the customer' : ` by ${req.user!.name}`}.`,
        type: 'order',
        roles,
        customerId: role === 'customer' ? undefined : order.customerId,
        customerTitle: 'Order cancelled',
        customerMessage: `Your order ${order.orderNumber} was cancelled.${order.paymentStatus === 'refunded' ? ' Your payment will be refunded.' : ''}`,
      });
    }

    await AuditLog.create({
      userId: req.user!.userId,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'UPDATE_ORDER_STATUS',
      entity: 'Order',
      entityId: order._id.toString(),
      details: `Order ${order.orderNumber} status changed to ${status}`,
    });

    res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    handleError(res, error);
  }
};
