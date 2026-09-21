import { Router } from 'express';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  appointmentServices,
  appointments,
  employees,
  getDb,
  services as servicesTable,
  users,
} from '@salon/db';
import type { Appointment, AppointmentStatus } from '@salon/shared';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { badRequest, conflict, notFound } from '../lib/errors';
import { asyncHandler } from '../lib/validate';
import { checkIn } from '../services/queue';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);

async function loadAppointments(salonId: string, ids?: string[]): Promise<Appointment[]> {
  const db = getDb();
  const conditions = [eq(appointments.salonId, salonId)];
  if (ids) {
    conditions.push(inArray(appointments.id, ids));
  }

  const rows = await db
    .select({
      id: appointments.id,
      salonId: appointments.salonId,
      customerName: appointments.customerName,
      customerPhone: appointments.customerPhone,
      scheduledFor: appointments.scheduledFor,
      status: appointments.status,
      requestedEmployeeId: appointments.requestedEmployeeId,
      requestedEmployeeName: users.name,
      notes: appointments.notes,
      tokenId: appointments.tokenId,
    })
    .from(appointments)
    .leftJoin(employees, eq(employees.id, appointments.requestedEmployeeId))
    .leftJoin(users, eq(users.id, employees.userId))
    .where(and(...conditions))
    .orderBy(asc(appointments.scheduledFor));

  if (rows.length === 0) {
    return [];
  }

  const serviceRows = await db
    .select({
      appointmentId: appointmentServices.appointmentId,
      serviceId: servicesTable.id,
      name: servicesTable.name,
      price: servicesTable.price,
      durationMinutes: servicesTable.durationMinutes,
    })
    .from(appointmentServices)
    .innerJoin(servicesTable, eq(servicesTable.id, appointmentServices.serviceId))
    .where(
      inArray(
        appointmentServices.appointmentId,
        rows.map((row) => row.id),
      ),
    );

  const byAppointment = new Map<string, Appointment['services']>();
  for (const row of serviceRows) {
    byAppointment.set(row.appointmentId, [
      ...(byAppointment.get(row.appointmentId) ?? []),
      {
        serviceId: row.serviceId,
        name: row.name,
        price: row.price,
        durationMinutes: row.durationMinutes,
      },
    ]);
  }

  return rows.map((row) => ({
    ...row,
    scheduledFor: row.scheduledFor.toISOString(),
    services: byAppointment.get(row.id) ?? [],
  }));
}

appointmentsRouter.get(
  '/',
  requireRole('salon_admin', 'receptionist', 'employee', 'super_admin'),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    const status = req.query.status ? String(req.query.status) : null;
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    let list = await loadAppointments(salonId);
    if (status) {
      list = list.filter((item) => item.status === (status as AppointmentStatus));
    }
    if (from && !Number.isNaN(from.getTime())) {
      list = list.filter((item) => new Date(item.scheduledFor) >= from);
    }
    if (to && !Number.isNaN(to.getTime())) {
      list = list.filter((item) => new Date(item.scheduledFor) <= to);
    }
    res.json(list);
  }),
);

/** Reception converts a booking into a live queue token. */
appointmentsRouter.post(
  '/:appointmentId/check-in',
  requireRole('salon_admin', 'receptionist'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, req.params.appointmentId),
    });
    if (!appointment) {
      throw notFound('Appointment not found');
    }
    const salonId = resolveSalonId(req, appointment.salonId);
    if (appointment.status !== 'scheduled') {
      throw conflict(`Appointment is already ${appointment.status}`);
    }

    const serviceIds = (
      await db
        .select({ serviceId: appointmentServices.serviceId })
        .from(appointmentServices)
        .where(eq(appointmentServices.appointmentId, appointment.id))
    ).map((row) => row.serviceId);

    if (serviceIds.length === 0) {
      throw badRequest('Appointment has no services');
    }

    const outcome = await checkIn({
      salonId,
      serviceIds,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      requestedEmployeeId: appointment.requestedEmployeeId,
      source: 'appointment',
      appointmentId: appointment.id,
    });

    await db
      .update(appointments)
      .set({ status: 'checked_in', tokenId: outcome.token.id })
      .where(eq(appointments.id, appointment.id));

    res.status(201).json(outcome);
  }),
);

appointmentsRouter.patch(
  '/:appointmentId',
  requireRole('salon_admin', 'receptionist'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const status = (req.body as { status?: AppointmentStatus }).status;
    if (!status || !['cancelled', 'no_show', 'scheduled'].includes(status)) {
      throw badRequest('status must be scheduled, cancelled or no_show');
    }

    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, req.params.appointmentId),
    });
    if (!appointment) {
      throw notFound('Appointment not found');
    }
    const salonId = resolveSalonId(req, appointment.salonId);
    if (appointment.status === 'checked_in') {
      throw conflict('Appointment already checked in');
    }

    await db
      .update(appointments)
      .set({ status })
      .where(and(eq(appointments.id, appointment.id), eq(appointments.salonId, salonId)));

    const [updated] = await loadAppointments(salonId, [appointment.id]);
    res.json(updated);
  }),
);
