import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  chairs,
  employeeServices,
  employees,
  getDb,
  salons,
  services as servicesTable,
  tokenServices,
  tokens,
  users,
  type Database,
} from '../../db/src';
import type {
  ChairStatusChangedEvent,
  QueueEntry,
  TokenSource,
  TokenSummary,
} from '../../shared/src';
import { badRequest, conflict, notFound } from '../lib/errors';
import { realtime } from '../realtime';
import { getTokenSummary } from './tokens';

type Db = Database;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Token statuses that still hold a chair/employee. */
const ACTIVE_STATUSES = ['waiting', 'in_service', 'awaiting_payment'] as const;

export interface CheckInInput {
  salonId: string;
  serviceIds: string[];
  customerName?: string | null;
  customerPhone?: string | null;
  requestedEmployeeId?: string | null;
  source: TokenSource;
  appointmentId?: string | null;
}

export interface CheckInOutcome {
  token: TokenSummary;
  queuePosition: number | null;
  estimatedWaitMinutes: number;
}

interface Assignment {
  chairId: string;
  chairLabel: string;
  employeeId: string | null;
}

function pad(sequence: number): string {
  return sequence.toString().padStart(3, '0');
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseClock(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

export function isOnShift(
  shiftStart: string | null,
  shiftEnd: string | null,
  now = new Date(),
): boolean {
  const start = parseClock(shiftStart);
  const end = parseClock(shiftEnd);
  if (start === null || end === null) {
    return true;
  }
  const current = minutesOfDay(now);
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

async function findAssignment(
  tx: Tx,
  salonId: string,
  serviceIds: string[],
  requestedEmployeeId: string | null,
): Promise<Assignment | null> {
  const freeChairs = await tx
    .select({ id: chairs.id, label: chairs.label, currentEmployeeId: chairs.currentEmployeeId })
    .from(chairs)
    .where(
      and(eq(chairs.salonId, salonId), eq(chairs.status, 'free'), isNull(chairs.currentTokenId)),
    )
    .orderBy(asc(chairs.label));

  if (freeChairs.length === 0) {
    return null;
  }

  const busyRows = await tx
    .select({ employeeId: tokens.employeeId })
    .from(tokens)
    .where(and(eq(tokens.salonId, salonId), inArray(tokens.status, [...ACTIVE_STATUSES])));
  const busyEmployeeIds = new Set(
    busyRows.map((row) => row.employeeId).filter((id): id is string => Boolean(id)),
  );

  const staff = await tx
    .select({
      id: employees.id,
      shiftStart: employees.shiftStart,
      shiftEnd: employees.shiftEnd,
    })
    .from(employees)
    .where(and(eq(employees.salonId, salonId), eq(employees.isActive, true)));

  const specialtyRows = await tx
    .select({ employeeId: employeeServices.employeeId, serviceId: employeeServices.serviceId })
    .from(employeeServices)
    .innerJoin(employees, eq(employees.id, employeeServices.employeeId))
    .where(eq(employees.salonId, salonId));

  const specialtiesByEmployee = new Map<string, Set<string>>();
  for (const row of specialtyRows) {
    const set = specialtiesByEmployee.get(row.employeeId) ?? new Set<string>();
    set.add(row.serviceId);
    specialtiesByEmployee.set(row.employeeId, set);
  }

  const servedTodayRows = await tx
    .select({ employeeId: tokens.employeeId, count: sql<number>`count(*)::int` })
    .from(tokens)
    .where(and(eq(tokens.salonId, salonId), eq(tokens.tokenDate, sql`CURRENT_DATE`)))
    .groupBy(tokens.employeeId);
  const loadByEmployee = new Map(
    servedTodayRows
      .filter((row) => row.employeeId)
      .map((row) => [row.employeeId as string, Number(row.count)]),
  );

  const qualified = staff.filter((member) => {
    if (busyEmployeeIds.has(member.id)) {
      return false;
    }
    if (!isOnShift(member.shiftStart, member.shiftEnd)) {
      return false;
    }
    const specialties = specialtiesByEmployee.get(member.id);
    if (!specialties || specialties.size === 0) {
      // An employee with no declared specialties can perform any service.
      return true;
    }
    return serviceIds.every((serviceId) => specialties.has(serviceId));
  });

  if (requestedEmployeeId) {
    const requested = qualified.find((member) => member.id === requestedEmployeeId);
    if (!requested) {
      // Customer asked for a specific stylist who is not available right now:
      // keep the token queued rather than silently assigning someone else.
      return null;
    }
    const preferredChair =
      freeChairs.find((chair) => chair.currentEmployeeId === requested.id) ?? freeChairs[0];
    return { chairId: preferredChair.id, chairLabel: preferredChair.label, employeeId: requested.id };
  }

  if (qualified.length === 0) {
    return null;
  }

  qualified.sort(
    (a, b) => (loadByEmployee.get(a.id) ?? 0) - (loadByEmployee.get(b.id) ?? 0),
  );
  const chosen = qualified[0];
  const preferredChair =
    freeChairs.find((chair) => chair.currentEmployeeId === chosen.id) ?? freeChairs[0];
  return { chairId: preferredChair.id, chairLabel: preferredChair.label, employeeId: chosen.id };
}

async function occupyChair(tx: Tx, assignment: Assignment, tokenId: string) {
  await tx
    .update(chairs)
    .set({
      status: 'occupied',
      currentTokenId: tokenId,
      currentEmployeeId: assignment.employeeId,
    })
    .where(eq(chairs.id, assignment.chairId));
}

export async function computeQueue(db: Db, salonId: string): Promise<QueueEntry[]> {
  const waiting = await db
    .select({
      tokenId: tokens.id,
      tokenNumber: tokens.tokenNumber,
      requestedEmployeeId: tokens.requestedEmployeeId,
      duration: sql<number>`coalesce(sum(${tokenServices.durationAtBooking}), 30)::int`,
    })
    .from(tokens)
    .leftJoin(tokenServices, eq(tokenServices.tokenId, tokens.id))
    .where(
      and(eq(tokens.salonId, salonId), eq(tokens.status, 'waiting'), isNull(tokens.chairId)),
    )
    .groupBy(tokens.id, tokens.tokenNumber, tokens.requestedEmployeeId, tokens.createdAt)
    .orderBy(asc(tokens.createdAt));

  const [{ activeChairs }] = await db
    .select({ activeChairs: sql<number>`count(*)::int` })
    .from(chairs)
    .where(and(eq(chairs.salonId, salonId), sql`${chairs.status} <> 'disabled'`));

  const capacity = Math.max(Number(activeChairs) || 1, 1);

  let cumulative = 0;
  return waiting.map((row, index) => {
    const entry: QueueEntry = {
      tokenId: row.tokenId,
      tokenNumber: row.tokenNumber,
      position: index + 1,
      estimatedWaitMinutes: Math.round(cumulative / capacity),
      requestedEmployeeId: row.requestedEmployeeId,
    };
    cumulative += Number(row.duration) || 30;
    return entry;
  });
}

async function emitQueueUpdated(db: Db, salonId: string) {
  const waiting = await computeQueue(db, salonId);
  realtime.queueUpdated({ salonId, waiting });
  return waiting;
}

async function chairEvent(db: Db, chairId: string): Promise<ChairStatusChangedEvent | null> {
  const [row] = await db
    .select({
      salonId: chairs.salonId,
      chairId: chairs.id,
      label: chairs.label,
      status: chairs.status,
      currentTokenId: chairs.currentTokenId,
      currentEmployeeId: chairs.currentEmployeeId,
    })
    .from(chairs)
    .where(eq(chairs.id, chairId));
  return row ?? null;
}

export async function broadcastChair(db: Db, chairId: string) {
  const event = await chairEvent(db, chairId);
  if (event) {
    realtime.chairStatusChanged(event);
  }
}

export async function checkIn(input: CheckInInput): Promise<CheckInOutcome> {
  const db = getDb();

  const { tokenId, assignedChairId } = await db.transaction(async (tx) => {
    // Serialize check-ins per salon so token numbers and chair grabs cannot race.
    const [salon] = await tx
      .select({ id: salons.id, status: salons.status })
      .from(salons)
      .where(eq(salons.id, input.salonId))
      .for('update');

    if (!salon) {
      throw notFound('Salon not found');
    }
    if (salon.status !== 'active') {
      throw conflict('Salon is suspended');
    }

    const chosenServices = await tx
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.salonId, input.salonId),
          inArray(servicesTable.id, input.serviceIds),
          eq(servicesTable.isActive, true),
        ),
      );

    if (chosenServices.length !== input.serviceIds.length) {
      throw badRequest('One or more services are unavailable for this salon');
    }

    if (input.requestedEmployeeId) {
      const [requested] = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.id, input.requestedEmployeeId),
            eq(employees.salonId, input.salonId),
            eq(employees.isActive, true),
          ),
        );
      if (!requested) {
        throw badRequest('Requested employee is not available at this salon');
      }
    }

    const [{ nextSequence }] = await tx
      .select({
        nextSequence: sql<number>`coalesce(max(${tokens.sequence}), 0)::int + 1`,
      })
      .from(tokens)
      .where(and(eq(tokens.salonId, input.salonId), eq(tokens.tokenDate, sql`CURRENT_DATE`)));

    const sequence = Number(nextSequence);
    const assignment = await findAssignment(
      tx,
      input.salonId,
      input.serviceIds,
      input.requestedEmployeeId ?? null,
    );

    const [token] = await tx
      .insert(tokens)
      .values({
        salonId: input.salonId,
        tokenNumber: `A-${pad(sequence)}`,
        sequence,
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ?? null,
        chairId: assignment?.chairId ?? null,
        employeeId: assignment?.employeeId ?? null,
        requestedEmployeeId: input.requestedEmployeeId ?? null,
        source: input.source,
      })
      .returning({ id: tokens.id });

    await tx.insert(tokenServices).values(
      chosenServices.map((service) => ({
        tokenId: token.id,
        serviceId: service.id,
        priceAtBooking: service.price,
        durationAtBooking: service.durationMinutes,
      })),
    );

    if (assignment) {
      await occupyChair(tx, assignment, token.id);
    }

    return { tokenId: token.id, assignedChairId: assignment?.chairId ?? null };
  });

  const summary = await getTokenSummary(db, tokenId);
  if (!summary) {
    throw notFound('Token not found after creation');
  }

  const waiting = await emitQueueUpdated(db, input.salonId);
  const entry = waiting.find((item) => item.tokenId === tokenId) ?? null;

  realtime.tokenCreated({
    salonId: input.salonId,
    token: summary,
    queuePosition: entry?.position ?? null,
    estimatedWaitMinutes: entry?.estimatedWaitMinutes ?? 0,
  });

  if (assignedChairId) {
    await broadcastChair(db, assignedChairId);
  }

  return {
    token: summary,
    queuePosition: entry?.position ?? null,
    estimatedWaitMinutes: entry?.estimatedWaitMinutes ?? 0,
  };
}

/**
 * Drains the waiting list onto any free chairs. Called whenever a chair frees
 * up, a chair is added/enabled, or a token is cancelled.
 */
export async function assignWaitingTokens(salonId: string): Promise<void> {
  const db = getDb();

  const assigned = await db.transaction(async (tx) => {
    await tx.select({ id: salons.id }).from(salons).where(eq(salons.id, salonId)).for('update');

    const waitingTokens = await tx
      .select({ id: tokens.id, requestedEmployeeId: tokens.requestedEmployeeId })
      .from(tokens)
      .where(
        and(eq(tokens.salonId, salonId), eq(tokens.status, 'waiting'), isNull(tokens.chairId)),
      )
      .orderBy(asc(tokens.createdAt));

    const results: Array<{ tokenId: string; chairId: string }> = [];

    for (const waitingToken of waitingTokens) {
      const serviceIds = (
        await tx
          .select({ serviceId: tokenServices.serviceId })
          .from(tokenServices)
          .where(eq(tokenServices.tokenId, waitingToken.id))
      ).map((row) => row.serviceId);

      const assignment = await findAssignment(
        tx,
        salonId,
        serviceIds,
        waitingToken.requestedEmployeeId,
      );
      if (!assignment) {
        continue;
      }

      await tx
        .update(tokens)
        .set({ chairId: assignment.chairId, employeeId: assignment.employeeId })
        .where(eq(tokens.id, waitingToken.id));
      await occupyChair(tx, assignment, waitingToken.id);
      results.push({ tokenId: waitingToken.id, chairId: assignment.chairId });
    }

    return results;
  });

  for (const result of assigned) {
    const summary = await getTokenSummary(db, result.tokenId);
    if (summary) {
      realtime.tokenStatusChanged({
        salonId,
        token: summary,
        previousStatus: 'waiting',
      });
    }
    await broadcastChair(db, result.chairId);
  }

  await emitQueueUpdated(db, salonId);
}

export async function releaseChair(salonId: string, chairId: string) {
  const db = getDb();
  await db
    .update(chairs)
    .set({ status: 'free', currentTokenId: null })
    .where(and(eq(chairs.id, chairId), eq(chairs.salonId, salonId)));
  await broadcastChair(db, chairId);
  await assignWaitingTokens(salonId);
}

export async function publishQueue(salonId: string) {
  return emitQueueUpdated(getDb(), salonId);
}

export async function listKioskEmployees(db: Db, salonId: string) {
  const rows = await db
    .select({
      id: employees.id,
      name: users.name,
      shiftStart: employees.shiftStart,
      shiftEnd: employees.shiftEnd,
    })
    .from(employees)
    .innerJoin(users, eq(users.id, employees.userId))
    .where(and(eq(employees.salonId, salonId), eq(employees.isActive, true)))
    .orderBy(asc(users.name));

  const specialtyRows = await db
    .select({ employeeId: employeeServices.employeeId, serviceId: employeeServices.serviceId })
    .from(employeeServices)
    .innerJoin(employees, eq(employees.id, employeeServices.employeeId))
    .where(eq(employees.salonId, salonId));

  const byEmployee = new Map<string, string[]>();
  for (const row of specialtyRows) {
    byEmployee.set(row.employeeId, [...(byEmployee.get(row.employeeId) ?? []), row.serviceId]);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    serviceIds: byEmployee.get(row.id) ?? [],
    onShift: isOnShift(row.shiftStart, row.shiftEnd),
  }));
}
