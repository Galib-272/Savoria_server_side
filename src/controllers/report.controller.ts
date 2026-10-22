import { Request, Response } from 'express';
import { Order } from '../models/Order.model.js';
import { User } from '../models/User.model.js';
import { Table } from '../models/Table.model.js';
import { Reservation } from '../models/Reservation.model.js';
import { InventoryItem } from '../models/Inventory.model.js';
import { Payment } from '../models/Payment.model.js';
import { Expense } from '../models/Expense.model.js';
import { MenuItem } from '../models/MenuItem.model.js';
import { ENV } from '../config/env.js';
import { todayInRestaurantTz } from '../utils/helpers.js';

const TZ = ENV.RESTAURANT_TIMEZONE;
const ACTIVE_STATUSES = ['new', 'confirmed', 'preparing', 'ready', 'served', 'picked_up', 'out_for_delivery'];

/** Start of "today" in the restaurant's timezone, as a Date */
const startOfTodayUtc = (): Date => {
  const today = todayInRestaurantTz();
  // Find the UTC instant whose local date in TZ is `today` at 00:00
  const guess = new Date(`${today}T00:00:00Z`);
  const offsetMinutes =
    (new Date(guess.toLocaleString('en-US', { timeZone: TZ })).getTime() - new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) /
    60000;
  return new Date(guess.getTime() - offsetMinutes * 60000);
};

const sum = async (match: any) => {
  const agg = await Payment.aggregate([{ $match: { paymentStatus: 'paid', ...match } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
  return { total: agg[0]?.total || 0, count: agg[0]?.count || 0 };
};

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const todayStart = startOfTodayUtc();
    const [
      totalOrders,
      completedOrders,
      pendingOrders,
      preparingOrders,
      readyOrders,
      activeOrders,
      deliveryOrders,
      todayOrders,
      revenue,
      todayRevenue,
      expenseAgg,
      customersCount,
      reservationsCount,
      occupiedTables,
      lowStockCount,
      totalTables,
    ] = await Promise.all([
      Order.countDocuments({ status: { $ne: 'cancelled' } }),
      Order.countDocuments({ status: { $in: ['completed', 'delivered'] } }),
      Order.countDocuments({ status: { $in: ['new', 'confirmed'] } }),
      Order.countDocuments({ status: 'preparing' }),
      Order.countDocuments({ status: 'ready' }),
      Order.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
      Order.countDocuments({ orderType: 'delivery', status: { $in: ACTIVE_STATUSES } }),
      Order.countDocuments({ createdAt: { $gte: todayStart }, status: { $ne: 'cancelled' } }),
      sum({}),
      sum({ createdAt: { $gte: todayStart } }),
      Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      User.countDocuments({ role: 'customer' }),
      Reservation.countDocuments({ status: { $in: ['confirmed', 'completed'] } }),
      Table.countDocuments({ status: 'occupied' }),
      InventoryItem.countDocuments({ status: { $in: ['low_stock', 'out_of_stock'] } }),
      Table.countDocuments(),
    ]);
    const totalExpenses = expenseAgg[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: revenue.total,
        todayRevenue: todayRevenue.total,
        todayOrders,
        totalExpenses,
        estimatedProfit: revenue.total - totalExpenses,
        avgOrderValue: revenue.count ? Math.round(revenue.total / revenue.count) : 0,
        totalOrders,
        completedOrders,
        pendingOrders,
        preparingOrders,
        readyOrders,
        activeOrders,
        deliveryOrders,
        activeCustomers: customersCount,
        reservationsCount,
        occupiedTables,
        totalTables,
        lowStockCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile_banking: 'Mobile Banking',
  bank_transfer: 'Bank Transfer',
  stripe: 'Stripe',
};

export const getAnalyticsCharts = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dayOf = (d: Date) => todayInRestaurantTz(new Date(d));

    // 1. Last 7 days: sales from payments, order count from orders
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [recentPayments, recentOrders, expenses] = await Promise.all([
      Payment.find({ paymentStatus: 'paid', createdAt: { $gte: sixMonthsAgo } }).select('amount createdAt').lean(),
      Order.find({ createdAt: { $gte: sevenDaysAgo }, status: { $ne: 'cancelled' } }).select('createdAt').lean(),
      Expense.find().lean(),
    ]);
    const weeklySales = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = todayInRestaurantTz(d);
      weeklySales.push({
        day: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ }),
        date: key,
        sales: recentPayments.filter((p) => dayOf(p.createdAt) === key).reduce((s, p) => s + (p.amount || 0), 0),
        orders: recentOrders.filter((o) => dayOf(o.createdAt) === key).length,
      });
    }

    // 2. Last 6 months: revenue (payments) vs expenses
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
      const key = todayInRestaurantTz(d).slice(0, 7);
      monthlyRevenue.push({
        month: d.toLocaleDateString('en-US', { month: 'short', timeZone: TZ }),
        revenue: recentPayments.filter((p) => dayOf(p.createdAt).slice(0, 7) === key).reduce((s, p) => s + (p.amount || 0), 0),
        expenses: expenses.filter((e) => String(e.date).slice(0, 7) === key).reduce((s, e) => s + (e.amount || 0), 0),
      });
    }

    // 3. Items sold (non-cancelled orders) → popular items & category split
    const soldOrders = await Order.find({ status: { $ne: 'cancelled' } }).select('items').lean();
    const itemTotals = new Map<string, any>();
    for (const o of soldOrders) {
      for (const it of o.items || []) {
        const key = `${it.name}::${it.menuItemId || ''}`;
        const row = itemTotals.get(key) || { _id: { name: it.name, menuItemId: it.menuItemId }, quantity: 0, sales: 0, orders: 0 };
        row.quantity += it.quantity || 0;
        row.sales += (it.price || 0) * (it.quantity || 0);
        row.orders += 1;
        itemTotals.set(key, row);
      }
    }
    const itemsAgg = Array.from(itemTotals.values());
    const menuItems = await MenuItem.find().select('name categoryName').lean();
    const categoryOf = (row: any) =>
      menuItems.find((m) => m._id.toString() === row._id.menuItemId)?.categoryName ||
      menuItems.find((m) => m.name === row._id.name)?.categoryName ||
      'Other';

    const popularMap = new Map<string, { name: string; quantity: number; sales: number; orders: number }>();
    const categoryMap = new Map<string, number>();
    for (const row of itemsAgg) {
      const prev = popularMap.get(row._id.name) || { name: row._id.name, quantity: 0, sales: 0, orders: 0 };
      popularMap.set(row._id.name, { name: row._id.name, quantity: prev.quantity + row.quantity, sales: prev.sales + row.sales, orders: prev.orders + row.orders });
      const cat = categoryOf(row);
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + row.sales);
    }
    const popularItems = Array.from(popularMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 6);
    const categorySales = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // 4. Order types, statuses, payment methods, tables
    const [orderTypeAgg, orderStatusAgg, paymentAgg, tableStatusAgg] = await Promise.all([
      Order.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: '$orderType', count: { $sum: 1 }, revenue: { $sum: '$total' } } }]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Payment.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: '$paymentMethod', value: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Table.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const typeLabel: Record<string, string> = { 'dine-in': 'Dine-In', takeaway: 'Takeaway', delivery: 'Delivery' };

    res.status(200).json({
      success: true,
      data: {
        weeklySales,
        monthlyRevenue,
        categorySales,
        popularItems,
        orderTypes: orderTypeAgg.map((o) => ({ type: o._id, name: typeLabel[o._id] || o._id, value: o.count, count: o.count, revenue: o.revenue })),
        orderStatuses: orderStatusAgg.map((s) => ({ status: s._id, count: s.count })),
        paymentMethods: paymentAgg.map((p) => ({ method: p._id, name: PAYMENT_LABELS[p._id] || p._id, value: p.value, count: p.count })),
        tableStatuses: tableStatusAgg.map((t) => ({ status: t._id, count: t.count })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
