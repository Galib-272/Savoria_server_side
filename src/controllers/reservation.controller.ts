import { Request, Response } from 'express';
import { Reservation, IReservation } from '../models/Reservation.model.js';
import { Table } from '../models/Table.model.js';
import { AuthenticatedRequest, ReservationStatus } from '../types/index.js';
import { emitTableStatusChange, emitNewReservationRequest, emitReservationStatusUpdate } from '../sockets/socketHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { notify } from '../services/notification.service.js';
import { escapeRegex, formattedTime, isStaffRole, isValidObjectId, timeToMinutes, todayInRestaurantTz } from '../utils/helpers.js';

const VALID_SEATS = ['S1', 'S2', 'S3', 'S4'];
/** A reservation blocks its seats for this many minutes either side of its start time */
const SLOT_MINUTES = 120;
const ACTIVE: ReservationStatus[] = ['pending', 'confirmed'];

const formatReservation = (r: IReservation) => ({
  id: r._id.toString(),
  _id: r._id.toString(),
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
});

const overlaps = (a: string, b: string) => Math.abs(timeToMinutes(a) - timeToMinutes(b)) < SLOT_MINUTES;

/** Seats on a table already held by other pending/confirmed reservations whose time overlaps */
const findConflicts = async (date: string, time: string, tableNumber: number, seats: string[], excludeId?: string) => {
  const sameDay = await Reservation.find({
    date,
    tableNumber,
    status: { $in: ACTIVE },
    seats: { $in: seats },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  return sameDay.filter((r) => overlaps(r.time, time));
};

/**
 * Keeps the live floor map in sync with TODAY's confirmed reservations:
 * seats of today's confirmed bookings show as "reserved"; reservations for other days never block seats now.
 */
export const syncTodaysReservedSeats = async (): Promise<void> => {
  const today = todayInRestaurantTz();
  const todays = await Reservation.find({ date: today, status: 'confirmed' }).lean();
  const byTable = new Map<number, typeof todays>();
  todays.forEach((r) => byTable.set(r.tableNumber, [...(byTable.get(r.tableNumber) || []), r]));

  const tables = await Table.find();
  for (const table of tables) {
    let changed = false;
    const tableRes = byTable.get(table.number) || [];
    table.seats.forEach((seat) => {
      const holder = tableRes.find((r) => r.seats.includes(seat.seatNumber));
      if (seat.status === 'reserved' && seat.reservationId && (!holder || holder._id.toString() !== seat.reservationId)) {
        // reservation no longer valid for today → free the seat
        seat.status = 'available';
        seat.reservationId = undefined;
        seat.currentCustomerName = undefined;
        changed = true;
      }
      if (holder && seat.status === 'available') {
        seat.status = 'reserved';
        seat.reservationId = holder._id.toString();
        seat.currentCustomerName = holder.customerName;
        changed = true;
      }
    });
    if (changed) {
      const anyOccupied = table.seats.some((s) => s.status === 'occupied');
      const anyReserved = table.seats.some((s) => s.status === 'reserved');
      if (!['cleaning', 'out_of_service'].includes(table.status)) {
        table.status = anyOccupied ? 'occupied' : anyReserved ? 'reserved' : 'available';
      }
      await table.save();
      emitTableStatusChange(table);
    }
  }
};

const freeReservationSeats = async (reservation: IReservation) => {
  const table = await Table.findOne({ number: reservation.tableNumber });
  if (!table) return;
  const id = reservation._id.toString();
  let changed = false;
  table.seats.forEach((seat) => {
    if (seat.reservationId === id && seat.status === 'reserved') {
      seat.status = 'available';
      seat.currentCustomerName = undefined;
      seat.reservationId = undefined;
      changed = true;
    }
  });
  if (!changed) return;
  const anyReserved = table.seats.some((s) => s.status === 'reserved');
  const anyOccupied = table.seats.some((s) => s.status === 'occupied');
  if (table.status === 'reserved' && !anyReserved && !anyOccupied) table.status = 'available';
  await table.save();
  emitTableStatusChange(table);
};

// ─── CREATE ───
export const createReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { customerName, customerPhone, customerEmail, date, time, specialRequest } = req.body;
    const tableNumber = Number(req.body.tableNumber);
    const seats: string[] = Array.from(new Set((Array.isArray(req.body.seats) ? req.body.seats : []).map(String)));

    if (!customerName || !customerPhone || !date || !time || !tableNumber) {
      res.status(400).json({ success: false, message: 'Customer name, phone, date, time, and table number are required.' });
      return;
    }
    if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 25) {
      res.status(400).json({ success: false, message: 'Table number must be between 1 and 25 (T1-T25).' });
      return;
    }
    if (seats.length === 0 || seats.some((s) => !VALID_SEATS.includes(s))) {
      res.status(400).json({ success: false, message: 'Please select one or more seats (S1–S4).' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || String(date) < todayInRestaurantTz()) {
      res.status(400).json({ success: false, message: 'Please choose today or a future date.' });
      return;
    }
    if (Number.isNaN(timeToMinutes(time))) {
      res.status(400).json({ success: false, message: 'Invalid reservation time.' });
      return;
    }
    if (String(date) === todayInRestaurantTz() && timeToMinutes(time) <= timeToMinutes(formattedTime())) {
      res.status(400).json({ success: false, message: 'That time has already passed today. Please choose a later time.' });
      return;
    }

    const table = await Table.findOne({ number: tableNumber });
    if (!table || table.status === 'out_of_service') {
      res.status(409).json({ success: false, message: `Table T${tableNumber} is not available for reservations.` });
      return;
    }

    const conflicts = await findConflicts(date, time, tableNumber, seats);
    if (conflicts.length) {
      const taken = Array.from(new Set(conflicts.flatMap((c) => c.seats.filter((s) => seats.includes(s)))));
      res.status(409).json({
        success: false,
        message: `Seat(s) ${taken.join(', ')} on Table T${tableNumber} are already booked around ${time} on ${date}. Please pick other seats or another time.`,
      });
      return;
    }

    const isCustomer = req.user!.role === 'customer';
    const guests = Math.max(1, Math.min(Number(req.body.guests) || seats.length, seats.length));
    const reservation = await Reservation.create({
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      customerEmail: isCustomer ? req.user!.email : customerEmail || undefined,
      customerId: isCustomer ? req.user!.userId : undefined,
      date,
      time,
      guests,
      tableNumber,
      seats,
      specialRequest,
      status: isStaffRole(req.user!.role) ? 'confirmed' : 'pending',
    });

    emitNewReservationRequest(reservation);
    if (reservation.status === 'confirmed') await syncTodaysReservedSeats();

    await notify({
      title: reservation.status === 'pending' ? 'New Reservation Request' : 'New Reservation Added',
      message: `${reservation.customerName} — Table T${tableNumber} (${seats.join(', ')}) on ${date} at ${time} for ${guests} guest(s).${specialRequest ? ' Note: ' + specialRequest : ''}`,
      type: 'reservation',
      roles: ['waiter'],
      reservationId: reservation._id.toString(),
      tableNumber,
      actorId: req.user!.userId,
    });

    await AuditLog.create({
      userId: req.user!.userId,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'CREATE_RESERVATION',
      entity: 'Reservation',
      entityId: reservation._id.toString(),
      details: `Reservation for Table T${tableNumber} seats ${seats.join(',')} by ${reservation.customerName} on ${date} at ${time} (${reservation.status})`,
    });

    res.status(201).json({
      success: true,
      message:
        reservation.status === 'pending'
          ? 'Reservation request submitted successfully. Waiting for approval.'
          : 'Reservation created.',
      data: formatReservation(reservation),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── READ ───
export const getReservations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { date, status, tableNumber } = req.query;
    const filter: any = {};
    if (date) filter.date = String(date);
    if (status) filter.status = String(status);
    if (tableNumber) filter.tableNumber = Number(tableNumber);

    if (req.user!.role === 'customer') {
      // Customers only see their own reservations
      filter.$or = [
        { customerId: req.user!.userId },
        { customerEmail: { $regex: `^${escapeRegex(req.user!.email)}$`, $options: 'i' } },
      ];
    }

    const reservations = await Reservation.find(filter).sort({ createdAt: -1 }).limit(500);
    const data = reservations.map(formatReservation);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Public: which seats are already booked for a date/time (no customer details). */
export const getAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const date = String(req.query.date || '');
    const time = String(req.query.time || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(timeToMinutes(time))) {
      res.status(400).json({ success: false, message: 'date (YYYY-MM-DD) and time are required.' });
      return;
    }
    const sameDay = await Reservation.find({ date, status: { $in: ACTIVE } }).lean();
    const booked: Record<number, string[]> = {};
    sameDay
      .filter((r) => overlaps(r.time, time))
      .forEach((r) => {
        booked[r.tableNumber] = Array.from(new Set([...(booked[r.tableNumber] || []), ...r.seats]));
      });
    res.status(200).json({ success: true, data: { date, time, bookedSeats: booked } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── STATUS (staff) ───
const TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  cancelled: [],
  completed: [],
  no_show: [],
};

export const updateReservationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const status = String(req.body.status) as ReservationStatus;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid reservation id.' });
      return;
    }
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Reservation not found.' });
      return;
    }
    const previousStatus = reservation.status;
    if (!(TRANSITIONS[previousStatus] || []).includes(status)) {
      res.status(409).json({ success: false, message: `A ${previousStatus} reservation can't be changed to ${status}.` });
      return;
    }

    if (status === 'confirmed') {
      const conflicts = (await findConflicts(reservation.date, reservation.time, reservation.tableNumber, reservation.seats, id)).filter(
        (c) => c.status === 'confirmed'
      );
      if (conflicts.length) {
        res.status(409).json({
          success: false,
          message: `Those seats are already confirmed for ${conflicts[0].customerName} at ${conflicts[0].time}. Decline this request instead.`,
        });
        return;
      }
    }

    reservation.status = status;
    await reservation.save();

    if (status === 'confirmed') await syncTodaysReservedSeats();
    else await freeReservationSeats(reservation);

    emitReservationStatusUpdate(reservation);

    const staffName = req.user!.name;
    const when = `Table T${reservation.tableNumber} (${reservation.seats.join(', ')}) on ${reservation.date} at ${reservation.time}`;
    if (status === 'confirmed' || status === 'cancelled') {
      const confirmed = status === 'confirmed';
      await notify({
        title: confirmed ? 'Reservation Confirmed' : 'Reservation Declined',
        message: `${staffName} ${confirmed ? 'confirmed' : 'declined'} ${reservation.customerName}'s reservation — ${when}.`,
        type: 'reservation',
        roles: ['waiter'],
        reservationId: reservation._id.toString(),
        tableNumber: reservation.tableNumber,
        customerId: reservation.customerId,
        customerTitle: confirmed ? 'Reservation Confirmed ✅' : 'Reservation Declined ❌',
        customerMessage: confirmed
          ? `Your reservation for ${when} has been confirmed.`
          : `Sorry, your reservation for ${when} could not be accepted. Please try another table or time.`,
        actorId: req.user!.userId,
      });
    }

    await AuditLog.create({
      userId: req.user!.userId,
      userName: staffName,
      userRole: req.user!.role,
      action: 'UPDATE_RESERVATION_STATUS',
      entity: 'Reservation',
      entityId: id,
      details: `Reservation for ${reservation.customerName} Table T${reservation.tableNumber} changed from ${previousStatus} to ${status} by ${staffName}`,
    });

    res.status(200).json({ success: true, message: `Reservation ${status}`, data: formatReservation(reservation) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CANCEL (customer, own reservation) ───
export const cancelOwnReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid reservation id.' });
      return;
    }
    const reservation = await Reservation.findById(id);
    const owns =
      reservation &&
      (reservation.customerId === req.user!.userId ||
        (reservation.customerEmail || '').toLowerCase() === req.user!.email.toLowerCase());
    if (!reservation || !owns) {
      res.status(404).json({ success: false, message: 'Reservation not found.' });
      return;
    }
    if (!ACTIVE.includes(reservation.status)) {
      res.status(409).json({ success: false, message: `This reservation is already ${reservation.status}.` });
      return;
    }

    reservation.status = 'cancelled';
    await reservation.save();
    await freeReservationSeats(reservation);
    emitReservationStatusUpdate(reservation);

    await notify({
      title: 'Reservation Cancelled by Customer',
      message: `${reservation.customerName} cancelled Table T${reservation.tableNumber} on ${reservation.date} at ${reservation.time}.`,
      type: 'reservation',
      roles: ['waiter'],
      reservationId: reservation._id.toString(),
      tableNumber: reservation.tableNumber,
      actorId: req.user!.userId,
    });

    res.status(200).json({ success: true, message: 'Reservation cancelled', data: formatReservation(reservation) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
