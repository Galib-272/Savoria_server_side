import { Response } from 'express';
import { Table } from '../models/Table.model.js';
import { emitTableStatusChange, sanitizeTableForPublic } from '../sockets/socketHandler.js';
import { AuthenticatedRequest, SeatStatus, TableStatus } from '../types/index.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { isStaffRole, isValidObjectId } from '../utils/helpers.js';
import { syncTodaysReservedSeats } from './reservation.controller.js';

const TABLE_STATUSES: TableStatus[] = ['available', 'occupied', 'reserved', 'cleaning', 'out_of_service'];
const SEAT_STATUSES: SeatStatus[] = ['available', 'occupied', 'reserved'];

export const getAllTables = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await syncTodaysReservedSeats();
    const tables = await Table.find().sort({ number: 1 });
    // Guests and customers see seat availability only — never other diners' names or order ids
    const data = isStaffRole(req.user?.role) ? tables : tables.map(sanitizeTableForPublic);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTableById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid table id' });
      return;
    }
    const table = await Table.findById(id);
    if (!table) {
      res.status(404).json({ success: false, message: 'Table not found' });
      return;
    }
    res.status(200).json({ success: true, data: isStaffRole(req.user?.role) ? table : sanitizeTableForPublic(table) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTableStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, waiterName } = req.body;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid table id' });
      return;
    }
    if (status && !TABLE_STATUSES.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid table status' });
      return;
    }

    const table = await Table.findById(id);
    if (!table) {
      res.status(404).json({ success: false, message: 'Table not found' });
      return;
    }

    const previousStatus = table.status;
    if (status) table.status = status;
    if (waiterName !== undefined) table.waiterName = waiterName;

    if (status === 'available') {
      table.seats.forEach((seat) => {
        // Keep seats that belong to a confirmed reservation; free everything else
        if (seat.status === 'reserved' && seat.reservationId) return;
        seat.status = 'available';
        seat.currentCustomerName = undefined;
        seat.orderId = undefined;
      });
      table.currentOrderId = undefined;
      if (table.seats.some((s) => s.status === 'reserved')) table.status = 'reserved';
    } else if (status === 'occupied') {
      table.seats.forEach((seat) => {
        if (seat.status === 'available') seat.status = 'occupied';
      });
    }

    await table.save();
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
    const { id, seatNumber } = req.params;
    const { status, customerName } = req.body;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid table id' });
      return;
    }
    if (status && !SEAT_STATUSES.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid seat status' });
      return;
    }

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
    if (status === 'available') {
      seat.currentCustomerName = undefined;
      seat.orderId = undefined;
      seat.reservationId = undefined;
    } else if (customerName !== undefined) {
      seat.currentCustomerName = customerName;
    }

    const anyOccupied = table.seats.some((s) => s.status === 'occupied');
    const anyReserved = table.seats.some((s) => s.status === 'reserved');
    if (!['cleaning', 'out_of_service'].includes(table.status)) {
      table.status = anyOccupied ? 'occupied' : anyReserved ? 'reserved' : 'available';
    }

    await table.save();
    emitTableStatusChange(table);

    res.status(200).json({ success: true, message: `Seat ${seatNumber} updated successfully on ${table.tableName}`, data: table });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignWaiter = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { waiterName, waiterId } = req.body;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid table id' });
      return;
    }
    const table = await Table.findById(id);
    if (!table) {
      res.status(404).json({ success: false, message: 'Table not found' });
      return;
    }
    table.waiterName = waiterName;
    table.currentWaiterId = waiterId;
    await table.save();
    emitTableStatusChange(table);
    res.status(200).json({ success: true, message: `Assigned waiter ${waiterName} to table ${table.tableName}`, data: table });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
