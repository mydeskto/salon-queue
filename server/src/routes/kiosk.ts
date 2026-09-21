import { Router } from 'express';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import {
  appointmentServices,
  appointments,
  chairs,
  getDb,
  salons,
  services as servicesTable,
  tokens,
} from '../../db/src';
import {
  createAppointmentSchema,
  kioskCheckInSchema,
  type Appointment,
  type CheckInResult,
  type KioskSalonInfo,
  type Service,
} from '../../shared/src';
import { badRequest, conflict, notFound } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';
import { checkIn, computeQueue, listKioskEmployees } from '../services/queue';
import { getTokenSummary } from '../services/tokens';
import { printTokenTicket, printingEnabled } from '../services/printing';

export const kioskRouter = Router();

function toService(row: typeof servicesTable.$inferSelect): Service {
  return {
    id: row.id,
    salonId: row.salonId,
    name: row.name,
    description: row.description,
    category: row.category,
    price: row.price,
    durationMinutes: row.durationMinutes,
    isActive: row.isActive,
  };
}

/** Public salon directory so a kiosk can be pointed at the right tenant. */
kioskRouter.get(
  '/salons',
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const rows = await db
      .select({ id: salons.id, name: salons.name, address: salons.address })
      .from(salons)
      .where(eq(salons.status, 'active'))
      .orderBy(asc(salons.name));
    res.json(rows);
  }),
);

kioskRouter.get(
  '/:salonId',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = req.params.salonId;
    const salon = await db.query.salons.findFirst({ where: eq(salons.id, salonId) });
    if (!salon) {
      throw notFound('Salon not found');
    }
    if (salon.status !== 'active') {
      throw conflict('Salon is suspended');
    }

    const serviceRows = await db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.salonId, salonId), eq(servicesTable.isActive, true)))
      .orderBy(asc(servicesTable.category), asc(servicesTable.name));

    const [{ freeChairs }] = await db
      .select({ freeChairs: sql<number>`count(*)::int` })
      .from(chairs)
      .where(
        and(eq(chairs.salonId, salonId), eq(chairs.status, 'free'), isNull(chairs.currentTokenId)),
      );

    const [{ waitingCount }] = await db
      .select({ waitingCount: sql<number>`count(*)::int` })
      .from(tokens)
      .where(and(eq(tokens.salonId, salonId), eq(tokens.status, 'waiting'), isNull(tokens.chairId)));

    const payload: KioskSalonInfo = {
      salon: {
        id: salon.id,
        name: salon.name,
        address: salon.address,
        phone: salon.phone,
        logoUrl: salon.logoUrl,
      },
      services: serviceRows.map(toService),
      employees: await listKioskEmployees(db, salonId),
      freeChairs: Number(freeChairs),
      waitingCount: Number(waitingCount),
    };
    res.json(payload);
  }),
);

kioskRouter.get(
  '/:salonId/queue',
  asyncHandler(async (req, res) => {
    const waiting = await computeQueue(getDb(), req.params.salonId);
    res.json({ salonId: req.params.salonId, waiting });
  }),
);

kioskRouter.post(
  '/check-in',
  validateBody(kioskCheckInSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const input = req.body as {
      salonId: string;
      serviceIds: string[];
      customerName?: string;
      customerPhone?: string;
      requestedEmployeeId?: string;
      appointmentId?: string;
    };

    if (input.appointmentId) {
      const appointment = await db.query.appointments.findFirst({
        where: eq(appointments.id, input.appointmentId),
      });
      if (!appointment || appointment.salonId !== input.salonId) {
        throw notFound('Appointment not found');
      }
      if (appointment.status !== 'scheduled') {
        throw conflict(`Appointment is already ${appointment.status}`);
      }
    }

    const outcome = await checkIn({
      salonId: input.salonId,
      serviceIds: input.serviceIds,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      requestedEmployeeId: input.requestedEmployeeId ?? null,
      source: input.appointmentId ? 'appointment' : 'kiosk',
      appointmentId: input.appointmentId ?? null,
    });

    if (input.appointmentId) {
      await db
        .update(appointments)
        .set({ status: 'checked_in', tokenId: outcome.token.id })
        .where(eq(appointments.id, input.appointmentId));
    }

    if (printingEnabled()) {
      const salon = await db.query.salons.findFirst({ where: eq(salons.id, input.salonId) });
      void printTokenTicket({
        salonName: salon?.name ?? 'Salon',
        tokenNumber: outcome.token.tokenNumber,
        chairLabel: outcome.token.chairLabel,
        employeeName: outcome.token.employeeName,
        services: outcome.token.services.map((service) => service.name),
        estimatedWaitMinutes: outcome.estimatedWaitMinutes,
        queuePosition: outcome.queuePosition,
        issuedAt: new Date(),
      });
    }

    const result: CheckInResult = {
      token: outcome.token,
      source: input.appointmentId ? 'appointment' : 'kiosk',
      queuePosition: outcome.queuePosition,
      estimatedWaitMinutes: outcome.estimatedWaitMinutes,
    };
    res.status(201).json(result);
  }),
);

kioskRouter.get(
  '/tokens/:tokenId',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const summary = await getTokenSummary(db, req.params.tokenId);
    if (!summary) {
      throw notFound('Token not found');
    }
    const waiting = await computeQueue(db, summary.salonId);
    const entry = waiting.find((item) => item.tokenId === summary.id) ?? null;
    res.json({
      token: summary,
      queuePosition: entry?.position ?? null,
      estimatedWaitMinutes: entry?.estimatedWaitMinutes ?? 0,
    });
  }),
);

/** Advance booking (project brief §9 Q3) — public, phone-number identified. */
kioskRouter.post(
  '/appointments',
  validateBody(createAppointmentSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const input = req.body as {
      salonId: string;
      serviceIds: string[];
      customerName: string;
      customerPhone: string;
      scheduledFor: string;
      requestedEmployeeId?: string;
      notes?: string;
    };

    const salon = await db.query.salons.findFirst({ where: eq(salons.id, input.salonId) });
    if (!salon || salon.status !== 'active') {
      throw notFound('Salon not found');
    }

    const scheduledFor = new Date(input.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() - 60_000) {
      throw badRequest('scheduledFor must be a future date/time');
    }

    const validServices = await db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(and(eq(servicesTable.salonId, input.salonId), eq(servicesTable.isActive, true)));
    const validIds = new Set(validServices.map((row) => row.id));
    if (!input.serviceIds.every((id) => validIds.has(id))) {
      throw badRequest('One or more services are unavailable for this salon');
    }

    const appointment = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(appointments)
        .values({
          salonId: input.salonId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          scheduledFor,
          requestedEmployeeId: input.requestedEmployeeId ?? null,
          notes: input.notes ?? null,
        })
        .returning();
      await tx.insert(appointmentServices).values(
        input.serviceIds.map((serviceId) => ({
          appointmentId: created.id,
          serviceId,
        })),
      );
      return created;
    });

    const serviceRows = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.salonId, input.salonId));
    const serviceById = new Map(serviceRows.map((row) => [row.id, row]));

    const payload: Appointment = {
      id: appointment.id,
      salonId: appointment.salonId,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      scheduledFor: appointment.scheduledFor.toISOString(),
      status: appointment.status,
      requestedEmployeeId: appointment.requestedEmployeeId,
      requestedEmployeeName: null,
      notes: appointment.notes,
      tokenId: appointment.tokenId,
      services: input.serviceIds.map((serviceId) => {
        const service = serviceById.get(serviceId)!;
        return {
          serviceId,
          name: service.name,
          price: service.price,
          durationMinutes: service.durationMinutes,
        };
      }),
    };

    res.status(201).json(payload);
  }),
);

/** Lets a returning customer find their booking at the kiosk by phone number. */
kioskRouter.get(
  '/:salonId/appointments',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const phone = String(req.query.phone ?? '').trim();
    if (phone.length < 4) {
      throw badRequest('phone query parameter is required');
    }

    const rows = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, req.params.salonId),
          eq(appointments.customerPhone, phone),
          eq(appointments.status, 'scheduled'),
        ),
      )
      .orderBy(asc(appointments.scheduledFor));

    const serviceRows = await db
      .select({
        appointmentId: appointmentServices.appointmentId,
        serviceId: servicesTable.id,
        name: servicesTable.name,
        price: servicesTable.price,
        durationMinutes: servicesTable.durationMinutes,
      })
      .from(appointmentServices)
      .innerJoin(servicesTable, eq(servicesTable.id, appointmentServices.serviceId));

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

    res.json(
      rows.map<Appointment>((row) => ({
        id: row.id,
        salonId: row.salonId,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        scheduledFor: row.scheduledFor.toISOString(),
        status: row.status,
        requestedEmployeeId: row.requestedEmployeeId,
        requestedEmployeeName: null,
        notes: row.notes,
        tokenId: row.tokenId,
        services: byAppointment.get(row.id) ?? [],
      })),
    );
  }),
);
