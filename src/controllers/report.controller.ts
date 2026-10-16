import { Request, Response } from 'express';
import { Order } from '../models/Order.model.js';
import { User } from '../models/User.model.js';
import { Table } from '../models/Table.model.js';
import { Reservation } from '../models/Reservation.model.js';
import { InventoryItem } from '../models/Inventory.model.js';
import { Payment } from '../models/Payment.model.js';
import { Expense } from '../models/Expense.model.js';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: 'completed' });
    const pendingOrders = await Order.countDocuments({ status: { $in: ['new', 'confirmed'] } });
    const preparingOrders = await Order.countDocuments({ status: 'preparing' });
    const readyOrders = await Order.countDocuments({ status: 'ready' });
    const deliveryOrders = await Order.countDocuments({ orderType: 'delivery', status: { $ne: 'completed' } });

    // Calculate revenue from paid orders and payments
    const salesAgg = await Payment.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, totalSales: { $sum: '$amount' } } },
    ]);
    const totalRevenue = salesAgg.length ? salesAgg[0].totalSales : 0;

    // Expenses
    const expenseAgg = await Expense.aggregate([
      { $group: { _id: null, totalExpense: { $sum: '$amount' } } },
    ]);
    const totalExpenses = expenseAgg.length ? expenseAgg[0].totalExpense : 0;

    const customersCount = await User.countDocuments({ role: 'customer' });
    const reservationsCount = await Reservation.countDocuments({ status: { $in: ['confirmed', 'completed'] } });
    const occupiedTables = await Table.countDocuments({ status: 'occupied' });
    const lowStockCount = await InventoryItem.countDocuments({ status: { $in: ['low_stock', 'out_of_stock'] } });

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        estimatedProfit: Math.max(0, totalRevenue - totalExpenses),
        totalOrders,
        completedOrders,
        pendingOrders,
        preparingOrders,
        readyOrders,
        deliveryOrders,
        activeCustomers: customersCount,
        reservationsCount,
        occupiedTables,
        lowStockCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAnalyticsCharts = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Order type breakdown (dine-in, takeaway, delivery)
    const orderTypeAgg = await Order.aggregate([
      { $group: { _id: '$orderType', count: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]);

    // 2. Order status breakdown
    const orderStatusAgg = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // 3. Weekly sales data
    const weeklyData = [
      { day: 'Mon', sales: 12500, orders: 45 },
      { day: 'Tue', sales: 15200, orders: 52 },
      { day: 'Wed', sales: 10800, orders: 38 },
      { day: 'Thu', sales: 18400, orders: 61 },
      { day: 'Fri', sales: 24500, orders: 82 },
      { day: 'Sat', sales: 29800, orders: 95 },
      { day: 'Sun', sales: 26200, orders: 88 },
    ];

    // 4. Popular Food Items
    const popularItemsAgg = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          quantity: { $sum: '$items.quantity' },
          totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 6 },
    ]);

    // 5. Table occupancy breakdown
    const tableStatusAgg = await Table.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        weeklySalesData: weeklyData,
        orderTypes: orderTypeAgg.map((o) => ({ type: o._id, count: o.count, revenue: o.revenue })),
        orderStatuses: orderStatusAgg.map((s) => ({ status: s._id, count: s.count })),
        popularItems: popularItemsAgg.map((p) => ({ name: p._id, quantity: p.quantity, sales: p.totalSales })),
        tableStatuses: tableStatusAgg.map((t) => ({ status: t._id, count: t.count })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
