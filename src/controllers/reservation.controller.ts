import { Request, Response } from 'express';
import { Reservation } from '../models/Reservation.model.js';
import { Table } from '../models/Table.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { emitTableStatusChange } from '../sockets/socketHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';

export const createReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      date,
      time,
      guests,
      tableNumber,
      seats = ['S1'],
      specialRequest,
    } = req.body;

    if (!customerName || !customerPhone || !date || !time || !tableNumber) {
      res.status(400).json({
        success: false,
        message: 'Customer name, phone, date, time, and table number are required.',
      });
      return;
    }

    if (tableNumber < 1 || tableNumber > 25) {
      res.status(400).json({ success: false, message: 'Table number must be between 1 and 25 (T1-T25).' });
      return;
    }

    // Critical Requirement: Prevent two customers from reserving the same seat for overlapping reservation periods!
    const existingConflict = await Reservation.findOne({
      date,
      time,
      tableNumber,
      status: { $in: ['pending', 'confirmed'] },
      seats: { $in: seats },
    });

    if (existingConflict) {
      const conflictingSeats = existingConflict.seats.filter((s) => seats.includes(s));
      res.status(409).json({
        success: false,
        message: `Conflict: Seat(s) ${conflictingSeats.join(', ')} on Table T${tableNumber} is already reserved for ${date} at ${time}. Please select another seat or time.`,
      });
      return;
    }

    const reservation = await Reservation.create({
      customerName,
      customerPhone,
      customerEmail: customerEmail || req.user?.email,
      customerId: req.user?.userId,
      date,
      time,
      guests: Number(guests) || seats.length,
      tableNumber: Number(tableNumber),
      seats,
      specialRequest,
      status: 'confirmed',
    });

    // Update table seat status
    const table = await Table.findOne({ number: tableNumber });
    if (table) {
      table.seats.forEach((seat) => {
        if (seats.includes(seat.seatNumber)) {
          seat.status = 'reserved';
          seat.currentCustomerName = customerName;
          seat.reservationId = reservation._id.toString();
        }
      });
      table.status = 'reserved';
      await table.save();
      emitTableStatusChange(table);
    }

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || customerName,
      userRole: req.user?.role || 'customer',
      action: 'CREATE_RESERVATION',
      entity: 'Reservation',
      entityId: reservation._id.toString(),
      details: `Reserved Table T${tableNumber} seats ${seats.join(',')} for ${customerName} on ${date} at ${time}`,
    });

    res.status(201).json({
      success: true,
      message: 'Reservation confirmed successfully',
      data: reservation,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, status, tableNumber } = req.query;
    const filter: any = {};

    if (date) filter.date = date;
    if (status) filter.status = status;
    if (tableNumber) filter.tableNumber = Number(tableNumber);

    const reservations = await Reservation.find(filter).sort({ date: -1, time: -1 });

    const formatted = reservations.map((r) => ({
      id: r._id.toString(),
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      date: r.date,
      time: r.time,
      guests: r.guests,
      tableNumber: r.tableNumber,
      seats: r.seats,
      specialRequest: r.specialRequest,
      status: r.status,
    }));

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReservationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Reservation not found.' });
      return;
    }

    reservation.status = status;
    await reservation.save();

    // If cancelled or completed, free up table seats
    if (status === 'cancelled' || status === 'completed') {
      const table = await Table.findOne({ number: reservation.tableNumber });
      if (table) {
        table.seats.forEach((seat) => {
          if (reservation.seats.includes(seat.seatNumber) && seat.reservationId === id) {
            seat.status = 'available';
            seat.currentCustomerName = undefined;
            seat.reservationId = undefined;
          }
        });
        const anyReserved = table.seats.some((s) => s.status === 'reserved');
        if (!anyReserved && table.status === 'reserved') {
          table.status = 'available';
        }
        await table.save();
        emitTableStatusChange(table);
      }
    }

    res.status(200).json({ success: true, message: 'Reservation status updated', data: reservation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
