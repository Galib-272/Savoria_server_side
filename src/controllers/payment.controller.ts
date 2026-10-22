import { Response } from 'express';
import { Payment } from '../models/Payment.model.js';
import { Order } from '../models/Order.model.js';
import { stripeClient, isStripeConfigured } from '../config/stripe.js';
import { AuthenticatedRequest } from '../types/index.js';
import { emitOrderUpdate } from '../sockets/socketHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { notify } from '../services/notification.service.js';
import { normalizePaymentMethod, recordPaymentForOrder } from '../services/payment.service.js';
import { isValidObjectId } from '../utils/helpers.js';

export { generateUniqueReceiptNumber } from '../services/payment.service.js';

export const createStripePaymentIntent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId, currency = 'bdt' } = req.body;
    let targetAmount = Number(req.body.amount);

    if (!(targetAmount > 0) && orderId && isValidObjectId(orderId)) {
      const order = await Order.findById(orderId);
      if (order) targetAmount = order.total;
    }
    if (!(targetAmount > 0)) {
      res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
      return;
    }

    if (isStripeConfigured() && stripeClient) {
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(targetAmount * 100),
        currency: String(currency).toLowerCase(),
        metadata: { orderId: orderId || '', customerName: req.user?.name || '', customerEmail: req.user?.email || '' },
      });
      res.status(200).json({ success: true, clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
      return;
    }

    // Demo mode: no real money is charged, any amount is accepted
    const id = `pi_demo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    res.status(200).json({
      success: true,
      clientSecret: `${id}_secret_demo`,
      paymentIntentId: id,
      mock: true,
      message: 'Demo payment mode — no real money is charged.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Cashier collects payment for an existing order (POS sale or pay-at-counter order). */
export const processPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId, splitPayments, notes, stripePaymentIntentId } = req.body;
    if (!isValidObjectId(orderId)) {
      res.status(400).json({ success: false, message: 'Invalid order id.' });
      return;
    }
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }
    if (order.status === 'cancelled') {
      res.status(409).json({ success: false, message: 'This order was cancelled.' });
      return;
    }

    const payment = await recordPaymentForOrder(order, {
      method: normalizePaymentMethod(req.body.paymentMethod),
      amount: order.total, // amount is always the order total
      collectedBy: { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
      splitPayments,
      notes,
      stripePaymentIntentId,
    });
    await order.save();
    emitOrderUpdate(order);

    await notify({
      title: 'Payment Received',
      message: `৳${payment.amount} received for Order ${order.orderNumber} via ${payment.paymentMethod.replace('_', ' ')} (${payment.receiptNumber})`,
      type: 'payment',
      roles: ['cashier'],
      orderId: order._id.toString(),
      actorId: req.user!.userId,
    });

    await AuditLog.create({
      userId: req.user!.userId,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'PROCESS_PAYMENT',
      entity: 'Payment',
      entityId: payment._id.toString(),
      details: `Processed payment of ৳${payment.amount} for ${order.orderNumber} via ${payment.paymentMethod}`,
    });

    res.status(200).json({ success: true, message: 'Payment processed successfully', receiptNumber: payment.receiptNumber, payment, order });
  } catch (error: any) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const getAllPayments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { paymentMethod } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const filter: any = {};
    if (paymentMethod) filter.paymentMethod = String(paymentMethod);

    const [payments, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Payment.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, count: payments.length, total, page, data: payments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReceiptByOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const key = String(req.params.orderId);
    const payment = await Payment.findOne({ $or: [{ orderId: key }, { orderNumber: key }, { receiptNumber: key }] });
    if (!payment) {
      res.status(404).json({ success: false, message: 'Receipt not found.' });
      return;
    }
    const order = isValidObjectId(payment.orderId) ? await Order.findById(payment.orderId) : null;

    // Customers may only open receipts of their own orders
    if (req.user!.role === 'customer') {
      const owns =
        order &&
        (order.customerId === req.user!.userId ||
          (order.customerEmail || '').toLowerCase() === req.user!.email.toLowerCase());
      if (!owns) {
        res.status(404).json({ success: false, message: 'Receipt not found.' });
        return;
      }
    }

    res.status(200).json({
      success: true,
      receipt: {
        receiptNumber: payment.receiptNumber,
        orderNumber: payment.orderNumber,
        date: payment.createdAt,
        cashier: payment.cashierName,
        paymentMethod: payment.paymentMethod,
        amount: payment.amount,
        splitPayments: payment.splitPayments,
        items: order?.items || [],
        subtotal: order?.subtotal ?? payment.amount,
        tax: order?.tax ?? 0,
        discount: order?.discount ?? 0,
        deliveryFee: order?.deliveryFee ?? 0,
        total: order?.total ?? payment.amount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
