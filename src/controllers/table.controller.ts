import { Request, Response } from 'express';
import { Table } from '../models/Table.model.js';
import { emitTableStatusChange } from '../sockets/socketHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditLog } from '../models/AuditLog.model.js';

export const getAllTables = async (req: Request, res: Response): Promise<void> => {
  try {
    const tables = await Table.find().sort({ number: 1 });
    res.status(200).json({ success: true, count: tables.length, data: tables });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTableById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const table = await Table.findById(id);
    if (!table) {
      res.status(404).json({ success: false, message: 'Table not found' });
      return;
    }
    res.status(200).json({ success: true, data: table });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTableStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, waiterName, currentOrderId } = req.body;

    const table = await Table.findById(id);
    if (!table) {
      res.status(404).json({ success: false, message: 'Table not found' });
      return;
    }

    const previousStatus = table.status;
    if (status) table.status = status;
    if (waiterName !== undefined) table.waiterName = waiterName;
    if (currentOrderId !== undefined) table.currentOrderId = currentOrderId;

    // If table becomes available or cleaning, update seat statuses
    if (status === 'available') {
      table.seats.forEach((seat) => {
        seat.status = 'available';
        seat.currentCustomerName = undefined;
        seat.orderId = undefined;
        seat.reservationId = undefined;
      });
      table.currentOrderId = undefined;
    } else if (status === 'occupied') {
      // Mark seats occupied
      table.seats.forEach((seat) => {
        if (seat.status === 'available') {
          seat.status = 'occupied';
        }
      });
    }

    await table.save();

    // Emit real-time table status update
    emitTableStatusChange(table);

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'waiter',
      action: 'UPDATE_TABLE_STATUS',
      entity: 'Table',
      entityId: table._id.toString(),
      details: `Table ${table.tableName} changed status from ${previousStatus} to ${table.status}`,
    });

    res.status(200).json({ success: true, message: 'Table updated successfully', data: table });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSeatStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, seatNumber } = req.params; // seatNumber: S1, S2, S3, S4
    const { status, customerName, orderId, reservationId } = req.body;

    const table = await Table.findById(id);
    if (!table) {
      res.status(404).json({ success: false, message: 'Table not found' });
      return;
    }

    const seat = table.seats.find((s) => s.seatNumber === seatNumber);
    if (!seat) {
      res.status(404).json({ success: false, message: `Seat ${seatNumber} not found on table ${table.tableName}` });
      return;
    }

    if (status) seat.status = status;
    if (customerName !== undefined) seat.currentCustomerName = customerName;
    if (orderId !== undefined) seat.orderId = orderId;
    if (reservationId !== undefined) seat.reservationId = reservationId;

    // Check if all seats are occupied or available to auto-adjust table status
    const allOccupied = table.seats.every((s) => s.status === 'occupied');
    const allAvailable = table.seats.every((s) => s.status === 'available');

    if (allOccupied) {
      table.status = 'occupied';
    } else if (allAvailable && table.status === 'occupied') {
      table.status = 'available';
    }

    await table.save();

    // Emit real-time table status update
    emitTableStatusChange(table);

    res.status(200).json({
      success: true,
      message: `Seat ${seatNumber} updated successfully on ${table.tableName}`,
      data: table,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignWaiter = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { waiterName, waiterId } = req.body;

    const table = await Table.findById(id);
    if (!table) {
      res.status(404).json({ success: false, message: 'Table not found' });
      return;
    }

    table.waiterName = waiterName;
    table.currentWaiterId = waiterId;
    await table.save();

    emitTableStatusChange(table);

    res.status(200).json({
      success: true,
      message: `Assigned waiter ${waiterName} to table ${table.tableName}`,
      data: table,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
