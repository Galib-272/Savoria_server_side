import { Payment } from '../models/Payment.model.js';
import { IOrder } from '../models/Order.model.js';
import { PaymentMethod } from '../types/index.js';
import { emitPaymentCreated } from '../sockets/socketHandler.js';
import { formattedTime, nextSequence } from '../utils/helpers.js';

const maxNumberIn = (values: string[], pattern: RegExp, fallback: number): number =>
  values.reduce((max, v) => {
    const m = String(v || '').match(pattern);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, fallback);

/** Next unique receipt number (REC-1002, REC-1003, …) — atomic, safe under concurrent payments. */
export const generateUniqueReceiptNumber = async (): Promise<string> => {
  const seq = await nextSequence('receipt', async () => {
    const existing = await Payment.find({ receiptNumber: /^REC-\d+$/ }).select('receiptNumber').lean();
    return maxNumberIn(existing.map((p) => p.receiptNumber), /^REC-(\d+)$/, 1001);
  });
  return `REC-${seq}`;
};

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'mobile_banking', 'bank_transfer', 'stripe'];

export const normalizePaymentMethod = (value: unknown): PaymentMethod => {
  const v = String(value || 'cash').toLowerCase().replace(/\s+/g, '_') as PaymentMethod;
  return PAYMENT_METHODS.includes(v) ? v : 'cash';
};

interface RecordPaymentInput {
  method: PaymentMethod;
  amount?: number;
  collectedBy?: { userId?: string; name?: string; role?: string };
  stripePaymentIntentId?: string;
  splitPayments?: any[];
  notes?: string;
}

/**
 * Records ONE payment for an order and marks the order paid (caller saves the order).
 * Throws if the order is already paid, so a sale can never be counted twice.
 */
export const recordPaymentForOrder = async (order: IOrder, input: RecordPaymentInput) => {
  if (order.paymentStatus === 'paid') {
    const err: any = new Error(`Order ${order.orderNumber} is already paid.`);
    err.status = 409;
    throw err;
  }

  const receiptNumber = await generateUniqueReceiptNumber();
  const amount = Number(input.amount) > 0 ? Number(input.amount) : order.total;
  const collectorName = input.collectedBy?.name
    ? input.collectedBy.role === 'customer'
      ? `${input.collectedBy.name} (Online)`
      : input.collectedBy.name
    : 'Online Checkout';

  const payment = await Payment.create({
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    amount,
    paymentMethod: input.method,
    paymentStatus: 'paid',
    cashierId: input.collectedBy?.role && input.collectedBy.role !== 'customer' ? input.collectedBy.userId : undefined,
    cashierName: collectorName,
    receiptNumber,
    stripePaymentIntentId: input.stripePaymentIntentId,
    splitPayments: Array.isArray(input.splitPayments) ? input.splitPayments : [],
    notes: input.notes,
  });

  order.paymentStatus = 'paid';
  order.paymentMethod = input.method;
  order.paidAt = new Date();
  if (input.stripePaymentIntentId) order.stripePaymentIntentId = input.stripePaymentIntentId;
  if (input.collectedBy?.role && input.collectedBy.role !== 'customer') {
    order.cashierId = input.collectedBy.userId;
    order.cashierName = input.collectedBy.name;
  }
  order.timeline.push({
    time: formattedTime(),
    status: order.status,
    label: `Payment Received (৳${amount}) via ${input.method.replace('_', ' ')} — ${collectorName} [${receiptNumber}]`,
  });

  emitPaymentCreated(payment);
  return payment;
};
