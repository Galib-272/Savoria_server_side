import { Request, Response } from 'express';
import { Payment } from '../models/Payment.model.js';
import { Order } from '../models/Order.model.js';
import { stripeClient, isStripeConfigured } from '../config/stripe.js';
import { AuthenticatedRequest } from '../types/index.js';
import { emitKitchenNewOrder, emitOrderUpdate } from '../sockets/socketHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { Notification } from '../models/Notification.model.js';

export const createStripePaymentIntent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId, amount, currency = 'bdt' } = req.body;

    let targetAmount = amount;
    if (!targetAmount && orderId) {
      const order = await Order.findById(orderId);
      if (order) targetAmount = order.total;
    }

    if (!targetAmount) {
      res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
      return;
    }

    // If Stripe is configured with valid API keys
    if (isStripeConfigured() && stripeClient) {
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(targetAmount * 100), // convert to smallest currency unit (cents/poisha)
        currency: currency.toLowerCase(),
        metadata: {
          orderId: orderId || '',
          customerName: req.user?.name || '',
          customerEmail: req.user?.email || '',
        },
      });

      res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
      return;
    }

    // In local development if Stripe keys are not yet provided in .env
    res.status(200).json({
      success: true,
      clientSecret: `mock_pi_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
      paymentIntentId: `pi_mock_${Date.now()}`,
      mock: true,
      message: 'Running in development mode with simulated Stripe client secret. Add STRIPE_SECRET_KEY in .env for live Stripe gateway.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      orderId,
      paymentMethod = 'cash',
      amount,
      splitPayments,
      notes,
      stripePaymentIntentId,
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    const payAmount = amount || order.total;
    const count = await Payment.countDocuments();
    const receiptNumber = `REC-${1000 + count}`;

    const cashierName = req.user?.role === 'cashier'
      ? req.user.name
      : req.body.cashierName || (req.user?.name ? `${req.user.name} (Online)` : 'Customer (Online)');

    const payment = await Payment.create({
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      amount: payAmount,
      paymentMethod,
      paymentStatus: 'paid',
      cashierId: req.user?.userId,
      cashierName,
      receiptNumber,
      stripePaymentIntentId,
      splitPayments: splitPayments || [],
      notes,
    });

    // Update order payment status
    order.paymentStatus = 'paid';
    order.paymentMethod = paymentMethod;
    order.cashierId = req.user?.userId;
    order.cashierName = cashierName;
    order.paidAt = new Date();

    // Move status to confirmed if it was new
    if (order.status === 'new') {
      order.status = 'confirmed';
    }

    order.timeline.push({
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'confirmed',
      label: `Payment Completed (৳${payAmount}) by ${order.cashierName} [Receipt: ${receiptNumber}]`,
    });

    await order.save();

    // Send notifications to kitchen and cashier
    emitKitchenNewOrder(order);
    emitOrderUpdate(order);

    const io = (global as any).io || (await import('../sockets/socketHandler.js')).getIO();
    if (io) {
      io.emit('payment:created', payment);
    }

    await Notification.create({
      title: 'New Order to Prepare',
      message: `Order ${order.orderNumber} is PAID (৳${order.total}). Ready for kitchen preparation.`,
      type: 'kitchen',
      orderId: order._id.toString(),
      tableNumber: order.tableNumber,
      recipientRole: 'kitchen',
    });

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Cashier',
      userRole: req.user?.role || 'cashier',
      action: 'PROCESS_PAYMENT',
      entity: 'Payment',
      entityId: payment._id.toString(),
      details: `Processed payment of ৳${payAmount} for ${order.orderNumber} via ${paymentMethod}`,
    });

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully and routed to Kitchen',
      receiptNumber,
      payment,
      order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllPayments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { paymentMethod, page = 1, limit = 50 } = req.query;
    const filter: any = {};
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const skip = (Number(page) - 1) * Number(limit);
    const payments = await Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      page: Number(page),
      data: payments,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReceiptByOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const payment = await Payment.findOne({
      $or: [{ orderId }, { orderNumber: orderId }, { receiptNumber: orderId }],
    });

    if (!payment) {
      res.status(404).json({ success: false, message: 'Receipt not found.' });
      return;
    }

    const order = await Order.findById(payment.orderId);

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
        subtotal: order?.subtotal || payment.amount,
        tax: order?.tax || 0,
        discount: order?.discount || 0,
        deliveryFee: order?.deliveryFee || 0,
        total: order?.total || payment.amount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
