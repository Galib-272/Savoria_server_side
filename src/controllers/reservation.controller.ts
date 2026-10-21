import { Request, Response } from 'express';
import { Reservation } from '../models/Reservation.model.js';
import { Table } from '../models/Table.model.js';
import { Notification } from '../models/Notification.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { emitTableStatusChange, emitNewReservationRequest, emitReservationStatusUpdate } from '../sockets/socketHandler.js';
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

    // Create reservation with PENDING status (waiter must approve)
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
      status: 'pending',
    });

    // Create notification for all waiters
    const waiterNotification = await Notification.create({
      title: 'New Reservation Request',
      message: `${customerName} requests Table T${tableNumber} (${seats.join(', ')}) on ${date} at ${time} for ${guests} guest(s).${specialRequest ? ' Note: ' + specialRequest : ''}`,
      type: 'reservation',
      targetRoles: ['waiter', 'manager', 'admin'],
      reservationId: reservation._id.toString(),
      tableNumber: Number(tableNumber),
      time: 'Just now',
    });

    // Emit real-time notification to waiter panel
    emitNewReservationRequest(reservation, {
      id: waiterNotification._id.toString(),
      title: waiterNotification.title,
      message: waiterNotification.message,
      type: waiterNotification.type,
      reservationId: reservation._id.toString(),
      tableNumber: Number(tableNumber),
    });

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || customerName,
      userRole: req.user?.role || 'customer',
      action: 'CREATE_RESERVATION',
      entity: 'Reservation',
      entityId: reservation._id.toString(),
      details: `Reservation request for Table T${tableNumber} seats ${seats.join(',')} by ${customerName} on ${date} at ${time} (pending approval)`,
    });

    res.status(201).json({
      success: true,
      message: 'Reservation request submitted successfully. Waiting for approval.',
      data: reservation,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, status, tableNumber, customerId } = req.query;
    const filter: any = {};

    if (date) filter.date = date;
    if (status) filter.status = status;
    if (tableNumber) filter.tableNumber = Number(tableNumber);
    if (customerId) filter.customerId = customerId;

    const reservations = await Reservation.find(filter).sort({ createdAt: -1 });

    const formatted = reservations.map((r) => ({
      id: r._id.toString(),
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      customerId: r.customerId,
      date: r.date,
      time: r.time,
      guests: r.guests,
      tableNumber: r.tableNumber,
      seats: r.seats,
      specialRequest: r.specialRequest,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
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

    const previousStatus = reservation.status;
    reservation.status = status;
    await reservation.save();

    const waiterName = req.user?.name || 'Staff';

    // Handle CONFIRMED (accepted) — update table/seat status
    if (status === 'confirmed') {
      const table = await Table.findOne({ number: reservation.tableNumber });
      if (table) {
        table.seats.forEach((seat) => {
          if (reservation.seats.includes(seat.seatNumber)) {
            seat.status = 'reserved';
            seat.currentCustomerName = reservation.customerName;
            seat.reservationId = reservation._id.toString();
          }
        });
        // Only change table status to reserved if not already occupied
        if (table.status === 'available' || table.status === 'cleaning') {
          table.status = 'reserved';
        }
        await table.save();
        emitTableStatusChange(table);
      }

      // Notify the customer that their reservation was accepted
      const customerNotification = await Notification.create({
        title: 'Reservation Confirmed! ✅',
        message: `Your reservation for Table T${reservation.tableNumber} (${reservation.seats.join(', ')}) on ${reservation.date} at ${reservation.time} has been confirmed by ${waiterName}.`,
        type: 'reservation',
        targetRoles: ['customer'],
        recipientId: reservation.customerId,
        reservationId: reservation._id.toString(),
        tableNumber: reservation.tableNumber,
        time: 'Just now',
      });

      // Also notify other waiters/staff
      const staffNotification = await Notification.create({
        title: 'Reservation Confirmed',
        message: `${waiterName} confirmed reservation for ${reservation.customerName} — Table T${reservation.tableNumber} on ${reservation.date} at ${reservation.time}.`,
        type: 'reservation',
        targetRoles: ['waiter', 'manager', 'admin'],
        reservationId: reservation._id.toString(),
        tableNumber: reservation.tableNumber,
        time: 'Just now',
      });

      emitReservationStatusUpdate(reservation, {
        id: customerNotification._id.toString(),
        title: customerNotification.title,
        message: customerNotification.message,
        type: 'reservation',
        reservationId: reservation._id.toString(),
        status: 'confirmed',
      });
    }

    // Handle CANCELLED (rejected) — free seats if they were reserved
    if (status === 'cancelled') {
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
        const anyOccupied = table.seats.some((s) => s.status === 'occupied');
        if (!anyReserved && !anyOccupied && (table.status === 'reserved')) {
          table.status = 'available';
        }
        await table.save();
        emitTableStatusChange(table);
      }

      // Notify the customer that their reservation was rejected
      const customerNotification = await Notification.create({
        title: 'Reservation Declined ❌',
        message: `Sorry, your reservation for Table T${reservation.tableNumber} on ${reservation.date} at ${reservation.time} has been declined by ${waiterName}. Please try another table or time.`,
        type: 'reservation',
        targetRoles: ['customer'],
        recipientId: reservation.customerId,
        reservationId: reservation._id.toString(),
        tableNumber: reservation.tableNumber,
        time: 'Just now',
      });

      // Also notify other waiters/staff
      await Notification.create({
        title: 'Reservation Declined',
        message: `${waiterName} declined reservation for ${reservation.customerName} — Table T${reservation.tableNumber} on ${reservation.date} at ${reservation.time}.`,
        type: 'reservation',
        targetRoles: ['waiter', 'manager', 'admin'],
        reservationId: reservation._id.toString(),
        tableNumber: reservation.tableNumber,
        time: 'Just now',
      });

      emitReservationStatusUpdate(reservation, {
        id: customerNotification._id.toString(),
        title: customerNotification.title,
        message: customerNotification.message,
        type: 'reservation',
        reservationId: reservation._id.toString(),
        status: 'cancelled',
      });
    }

    // Handle COMPLETED — free up table seats
    if (status === 'completed') {
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
        const anyOccupied = table.seats.some((s) => s.status === 'occupied');
        if (!anyReserved && !anyOccupied) {
          table.status = 'available';
        }
        await table.save();
        emitTableStatusChange(table);
      }
    }

    await AuditLog.create({
      userId: req.user?.userId,
      userName: waiterName,
      userRole: req.user?.role || 'waiter',
      action: 'UPDATE_RESERVATION_STATUS',
      entity: 'Reservation',
      entityId: id,
      details: `Reservation for ${reservation.customerName} Table T${reservation.tableNumber} changed from ${previousStatus} to ${status} by ${waiterName}`,
    });

    res.status(200).json({ success: true, message: `Reservation ${status}`, data: reservation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
