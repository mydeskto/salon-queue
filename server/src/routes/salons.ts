import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { bills, chairs, employees, getDb, salons, tokens, users } from '../../db/src';
import {
  createSalonSchema,
  updateSalonSchema,
  type PlatformOverview,
  type Salon,
  type SalonWithStats,
} from '../../shared/src';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { conflict, notFound } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';

export const salonsRouter = Router();

function toSalon(row: typeof salons.$inferSelect): Salon {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    logoUrl: row.logoUrl,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Self-service branding for the calling salon_admin's own salon (name, logo,
 * address, phone) — deliberately cannot touch `status`, which is a platform
 * (super_admin) decision. Mounted before the super_admin gate below.
 */
salonsRouter.get(
  '/me',
  authenticate,
  requireRole('salon_admin'),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, null);
    const salon = await getDb().query.salons.findFirst({ where: eq(salons.id, salonId) });
    if (!salon) {
      throw notFound('Salon not found');
    }
    res.json(toSalon(salon));
  }),
);

salonsRouter.patch(
  '/me',
  authenticate,
  requireRole('salon_admin'),
  // .omit strips `status` from the schema entirely, so a client-supplied
  // status field is silently dropped before this handler ever runs — only
  // the super_admin :salonId PATCH route below can change salon status.
  validateBody(updateSalonSchema.omit({ status: true })),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, null);
    const [row] = await getDb()
      .update(salons)
      .set(req.body as Partial<typeof salons.$inferInsert>)
      .where(eq(salons.id, salonId))
      .returning();
    if (!row) {
      throw notFound('Salon not found');
    }
    res.json(toSalon(row));
  }),
);

salonsRouter.use(authenticate, requireRole('super_admin'));

function generatePassword(): string {
  return randomBytes(9).toString('base64url');
}

async function salonStats(): Promise<Map<string, Omit<SalonWithStats, keyof Salon>>> {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const employeeCounts = await db
    .select({ salonId: employees.salonId, count: sql<number>`count(*)::int` })
    .from(employees)
    .groupBy(employees.salonId);
  const chairCounts = await db
    .select({ salonId: chairs.salonId, count: sql<number>`count(*)::int` })
    .from(chairs)
    .groupBy(chairs.salonId);
  const tokenCounts = await db
    .select({ salonId: tokens.salonId, count: sql<number>`count(*)::int` })
    .from(tokens)
    .where(gte(tokens.createdAt, startOfDay))
    .groupBy(tokens.salonId);
  const revenueRows = await db
    .select({ salonId: bills.salonId, total: sql<string>`coalesce(sum(${bills.total}), 0)::text` })
    .from(bills)
    .where(gte(bills.createdAt, startOfDay))
    .groupBy(bills.salonId);

  const stats = new Map<string, Omit<SalonWithStats, keyof Salon>>();
  const ensure = (salonId: string) => {
    const existing = stats.get(salonId) ?? {
      employeeCount: 0,
      chairCount: 0,
      tokensToday: 0,
      revenueToday: '0.00',
    };
    stats.set(salonId, existing);
    return existing;
  };

  for (const row of employeeCounts) ensure(row.salonId).employeeCount = Number(row.count);
  for (const row of chairCounts) ensure(row.salonId).chairCount = Number(row.count);
  for (const row of tokenCounts) ensure(row.salonId).tokensToday = Number(row.count);
  for (const row of revenueRows) ensure(row.salonId).revenueToday = Number(row.total).toFixed(2);

  return stats;
}

salonsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const rows = await db.select().from(salons).orderBy(asc(salons.name));
    const stats = await salonStats();
    const payload: SalonWithStats[] = rows.map((row) => ({
      ...toSalon(row),
      employeeCount: stats.get(row.id)?.employeeCount ?? 0,
      chairCount: stats.get(row.id)?.chairCount ?? 0,
      tokensToday: stats.get(row.id)?.tokensToday ?? 0,
      revenueToday: stats.get(row.id)?.revenueToday ?? '0.00',
    }));
    res.json(payload);
  }),
);

/**
 * Platform-level aggregates only — the super admin deliberately cannot read
 * customer-level rows inside a tenant (project brief §7 D).
 */
salonsRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const rows = await db.select().from(salons).orderBy(asc(salons.name));
    const stats = await salonStats();

    const [tokenTotals] = await db
      .select({
        today: sql<number>`count(*) filter (where ${tokens.createdAt} >= ${startOfDay})::int`,
        month: sql<number>`count(*) filter (where ${tokens.createdAt} >= ${startOfMonth})::int`,
      })
      .from(tokens);

    const [revenueTotals] = await db
      .select({
        today: sql<string>`coalesce(sum(${bills.total}) filter (where ${bills.createdAt} >= ${startOfDay}), 0)::text`,
        month: sql<string>`coalesce(sum(${bills.total}) filter (where ${bills.createdAt} >= ${startOfMonth}), 0)::text`,
      })
      .from(bills);

    const payload: PlatformOverview = {
      totalSalons: rows.length,
      activeSalons: rows.filter((row) => row.status === 'active').length,
      suspendedSalons: rows.filter((row) => row.status === 'suspended').length,
      tokensToday: Number(tokenTotals.today),
      tokensThisMonth: Number(tokenTotals.month),
      revenueToday: Number(revenueTotals.today).toFixed(2),
      revenueThisMonth: Number(revenueTotals.month).toFixed(2),
      salons: rows.map((row) => ({
        ...toSalon(row),
        employeeCount: stats.get(row.id)?.employeeCount ?? 0,
        chairCount: stats.get(row.id)?.chairCount ?? 0,
        tokensToday: stats.get(row.id)?.tokensToday ?? 0,
        revenueToday: stats.get(row.id)?.revenueToday ?? '0.00',
      })),
    };
    res.json(payload);
  }),
);

salonsRouter.post(
  '/',
  validateBody(createSalonSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const input = req.body as {
      name: string;
      address?: string;
      phone?: string;
      logoUrl?: string;
      adminName: string;
      adminEmail: string;
      adminPassword?: string;
    };

    const email = input.adminEmail.toLowerCase().trim();
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      throw conflict('A user with this email already exists');
    }

    const password = input.adminPassword ?? generatePassword();
    const salon = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(salons)
        .values({
          name: input.name,
          address: input.address ?? null,
          phone: input.phone ?? null,
          logoUrl: input.logoUrl ?? null,
          createdBy: req.user!.id,
        })
        .returning();

      await tx.insert(users).values({
        salonId: created.id,
        name: input.adminName,
        email,
        passwordHash: bcrypt.hashSync(password, 10),
        role: 'salon_admin',
      });

      return created;
    });

    res.status(201).json({
      salon: toSalon(salon),
      adminCredentials: { email, password },
    });
  }),
);

salonsRouter.patch(
  '/:salonId',
  validateBody(updateSalonSchema),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()
      .update(salons)
      .set(req.body as Partial<typeof salons.$inferInsert>)
      .where(eq(salons.id, req.params.salonId))
      .returning();
    if (!row) {
      throw notFound('Salon not found');
    }
    res.json(toSalon(row));
  }),
);

salonsRouter.delete(
  '/:salonId',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salon = await db.query.salons.findFirst({ where: eq(salons.id, req.params.salonId) });
    if (!salon) {
      throw notFound('Salon not found');
    }

    const [{ activeTokens }] = await db
      .select({ activeTokens: sql<number>`count(*)::int` })
      .from(tokens)
      .where(
        and(
          eq(tokens.salonId, salon.id),
          sql`${tokens.status} in ('waiting', 'in_service', 'awaiting_payment')`,
        ),
      );
    if (Number(activeTokens) > 0) {
      throw conflict('Salon still has active tokens; suspend it instead');
    }

    await db.delete(salons).where(eq(salons.id, salon.id));
    res.json({ ok: true });
  }),
);
