import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  bills,
  employeeServices,
  employees,
  getDb,
  services as servicesTable,
  tokenServices,
  tokens,
  users,
} from '../../db/src';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  type Employee,
  type EmployeeHistoryRow,
} from '../../shared/src';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { badRequest, conflict, notFound } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';
import { isOnShift } from '../services/queue';

export const employeesRouter = Router();

employeesRouter.use(authenticate);

async function listEmployees(salonId: string, employeeId?: string): Promise<Employee[]> {
  const db = getDb();
  const conditions = [eq(employees.salonId, salonId)];
  if (employeeId) {
    conditions.push(eq(employees.id, employeeId));
  }

  const rows = await db
    .select({
      id: employees.id,
      userId: employees.userId,
      salonId: employees.salonId,
      name: users.name,
      email: users.email,
      phone: users.phone,
      shiftStart: employees.shiftStart,
      shiftEnd: employees.shiftEnd,
      isActive: employees.isActive,
    })
    .from(employees)
    .innerJoin(users, eq(users.id, employees.userId))
    .where(and(...conditions))
    .orderBy(asc(users.name));

  if (rows.length === 0) {
    return [];
  }

  const specialties = await db
    .select({ employeeId: employeeServices.employeeId, serviceId: employeeServices.serviceId })
    .from(employeeServices)
    .where(
      inArray(
        employeeServices.employeeId,
        rows.map((row) => row.id),
      ),
    );

  const byEmployee = new Map<string, string[]>();
  for (const row of specialties) {
    byEmployee.set(row.employeeId, [...(byEmployee.get(row.employeeId) ?? []), row.serviceId]);
  }

  return rows.map((row) => ({
    ...row,
    serviceIds: byEmployee.get(row.id) ?? [],
    onShift: row.isActive && isOnShift(row.shiftStart, row.shiftEnd),
  }));
}

async function replaceSpecialties(employeeId: string, salonId: string, serviceIds: string[]) {
  const db = getDb();
  if (serviceIds.length > 0) {
    const valid = await db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(and(eq(servicesTable.salonId, salonId), inArray(servicesTable.id, serviceIds)));
    if (valid.length !== serviceIds.length) {
      throw badRequest('One or more services do not belong to this salon');
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(employeeServices).where(eq(employeeServices.employeeId, employeeId));
    if (serviceIds.length > 0) {
      await tx
        .insert(employeeServices)
        .values(serviceIds.map((serviceId) => ({ employeeId, serviceId })));
    }
  });
}

employeesRouter.get(
  '/',
  requireRole('salon_admin', 'receptionist', 'super_admin'),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    res.json(await listEmployees(salonId));
  }),
);

employeesRouter.post(
  '/',
  requireRole('salon_admin'),
  validateBody(createEmployeeSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const input = req.body as {
      name: string;
      email: string;
      phone?: string;
      password: string;
      serviceIds: string[];
      shiftStart?: string;
      shiftEnd?: string;
    };

    const email = input.email.toLowerCase().trim();
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      throw conflict('A user with this email already exists');
    }

    const employeeId = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          salonId,
          name: input.name,
          email,
          phone: input.phone ?? null,
          passwordHash: bcrypt.hashSync(input.password, 10),
          role: 'employee',
        })
        .returning({ id: users.id });

      const [employee] = await tx
        .insert(employees)
        .values({
          userId: user.id,
          salonId,
          shiftStart: input.shiftStart ?? null,
          shiftEnd: input.shiftEnd ?? null,
        })
        .returning({ id: employees.id });

      return employee.id;
    });

    await replaceSpecialties(employeeId, salonId, input.serviceIds ?? []);
    const [created] = await listEmployees(salonId, employeeId);
    res.status(201).json(created);
  }),
);

employeesRouter.patch(
  '/:employeeId',
  requireRole('salon_admin'),
  validateBody(updateEmployeeSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const input = req.body as {
      name?: string;
      phone?: string | null;
      password?: string;
      serviceIds?: string[];
      shiftStart?: string | null;
      shiftEnd?: string | null;
      isActive?: boolean;
    };

    const employee = await db.query.employees.findFirst({
      where: and(eq(employees.id, req.params.employeeId), eq(employees.salonId, salonId)),
    });
    if (!employee) {
      throw notFound('Employee not found');
    }

    await db.transaction(async (tx) => {
      const userUpdate: Record<string, unknown> = {};
      if (input.name !== undefined) userUpdate.name = input.name;
      if (input.phone !== undefined) userUpdate.phone = input.phone;
      if (input.password) userUpdate.passwordHash = bcrypt.hashSync(input.password, 10);
      if (input.isActive !== undefined) userUpdate.isActive = input.isActive;
      if (Object.keys(userUpdate).length > 0) {
        await tx.update(users).set(userUpdate).where(eq(users.id, employee.userId));
      }

      const employeeUpdate: Record<string, unknown> = {};
      if (input.shiftStart !== undefined) employeeUpdate.shiftStart = input.shiftStart;
      if (input.shiftEnd !== undefined) employeeUpdate.shiftEnd = input.shiftEnd;
      if (input.isActive !== undefined) employeeUpdate.isActive = input.isActive;
      if (Object.keys(employeeUpdate).length > 0) {
        await tx.update(employees).set(employeeUpdate).where(eq(employees.id, employee.id));
      }
    });

    if (input.serviceIds) {
      await replaceSpecialties(employee.id, salonId, input.serviceIds);
    }

    const [updated] = await listEmployees(salonId, employee.id);
    res.json(updated);
  }),
);

/** Full service history for one employee, used by the admin detail page. */
employeesRouter.get(
  '/:employeeId/history',
  requireRole('salon_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);

    const employee = await db.query.employees.findFirst({
      where: and(eq(employees.id, req.params.employeeId), eq(employees.salonId, salonId)),
    });
    if (!employee) {
      throw notFound('Employee not found');
    }

    const rows = await db
      .select({
        tokenId: tokens.id,
        tokenNumber: tokens.tokenNumber,
        customerName: tokens.customerName,
        total: bills.total,
        completedAt: tokens.serviceCompletedAt,
        paidAt: tokens.paidAt,
      })
      .from(tokens)
      .leftJoin(bills, eq(bills.tokenId, tokens.id))
      .where(and(eq(tokens.salonId, salonId), eq(tokens.employeeId, employee.id)))
      .orderBy(desc(tokens.createdAt))
      .limit(500);

    const serviceRows = await db
      .select({ tokenId: tokenServices.tokenId, name: servicesTable.name })
      .from(tokenServices)
      .innerJoin(servicesTable, eq(servicesTable.id, tokenServices.serviceId))
      .where(
        inArray(
          tokenServices.tokenId,
          rows.map((row) => row.tokenId),
        ),
      );

    const byToken = new Map<string, string[]>();
    for (const row of serviceRows) {
      byToken.set(row.tokenId, [...(byToken.get(row.tokenId) ?? []), row.name]);
    }

    const history: EmployeeHistoryRow[] = rows.map((row) => ({
      tokenId: row.tokenId,
      tokenNumber: row.tokenNumber,
      customerName: row.customerName,
      services: byToken.get(row.tokenId) ?? [],
      total: row.total ?? '0.00',
      completedAt: row.completedAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
    }));

    res.json(history);
  }),
);
