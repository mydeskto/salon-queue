import { Router } from 'express';
import { and, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import {
  billItems,
  bills,
  chairs,
  employees,
  getDb,
  services as servicesTable,
  tokens,
  users,
} from '@salon/db';
import type {
  CustomerDirectoryRow,
  EmployeeStat,
  SalonOverviewReport,
  ServiceStat,
} from '@salon/shared';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { asyncHandler } from '../lib/validate';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

function resolveRange(req: { query: Record<string, unknown> }) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  defaultFrom.setHours(0, 0, 0, 0);

  const from = req.query.from ? new Date(String(req.query.from)) : defaultFrom;
  const to = req.query.to ? new Date(String(req.query.to)) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { from: defaultFrom, to: now };
  }
  return { from, to };
}

reportsRouter.get(
  '/overview',
  requireRole('salon_admin', 'receptionist', 'super_admin'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    const { from, to } = resolveRange(req);
    const inRange = and(
      eq(tokens.salonId, salonId),
      gte(tokens.createdAt, from),
      lte(tokens.createdAt, to),
    );

    const [totals] = await db
      .select({
        totalTokens: sql<number>`count(*)::int`,
        completedTokens: sql<number>`count(*) filter (where ${tokens.status} = 'completed')::int`,
        cancelledTokens: sql<number>`count(*) filter (where ${tokens.status} = 'cancelled')::int`,
        averageWaitMinutes: sql<number>`coalesce(avg(extract(epoch from (${tokens.serviceStartedAt} - ${tokens.createdAt})) / 60) filter (where ${tokens.serviceStartedAt} is not null), 0)::float`,
        averageServiceMinutes: sql<number>`coalesce(avg(extract(epoch from (${tokens.serviceCompletedAt} - ${tokens.serviceStartedAt})) / 60) filter (where ${tokens.serviceCompletedAt} is not null), 0)::float`,
        serviceMinutesTotal: sql<number>`coalesce(sum(extract(epoch from (${tokens.serviceCompletedAt} - ${tokens.serviceStartedAt})) / 60) filter (where ${tokens.serviceCompletedAt} is not null), 0)::float`,
      })
      .from(tokens)
      .where(inRange);

    const [revenue] = await db
      .select({ total: sql<string>`coalesce(sum(${bills.total}), 0)::text` })
      .from(bills)
      .where(and(eq(bills.salonId, salonId), gte(bills.createdAt, from), lte(bills.createdAt, to)));

    const [{ chairCount }] = await db
      .select({ chairCount: sql<number>`count(*)::int` })
      .from(chairs)
      .where(and(eq(chairs.salonId, salonId), sql`${chairs.status} <> 'disabled'`));

    const peakHours = await db
      .select({
        hour: sql<number>`extract(hour from ${tokens.createdAt})::int`,
        tokens: sql<number>`count(*)::int`,
      })
      .from(tokens)
      .where(inRange)
      .groupBy(sql`extract(hour from ${tokens.createdAt})`)
      .orderBy(desc(sql`count(*)`))
      .limit(24);

    const revenueByDay = await db
      .select({
        date: sql<string>`to_char(${bills.createdAt}, 'YYYY-MM-DD')`,
        revenue: sql<string>`coalesce(sum(${bills.total}), 0)::text`,
        tokens: sql<number>`count(*)::int`,
      })
      .from(bills)
      .where(and(eq(bills.salonId, salonId), gte(bills.createdAt, from), lte(bills.createdAt, to)))
      .groupBy(sql`to_char(${bills.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${bills.createdAt}, 'YYYY-MM-DD')`);

    const employeeRows = await db
      .select({
        employeeId: employees.id,
        employeeName: users.name,
        customersServed: sql<number>`count(distinct ${tokens.id})::int`,
        revenue: sql<string>`coalesce(sum(${bills.total}), 0)::text`,
        averageServiceMinutes: sql<number>`coalesce(avg(extract(epoch from (${tokens.serviceCompletedAt} - ${tokens.serviceStartedAt})) / 60), 0)::float`,
        servicesCompleted: sql<number>`coalesce(count(${billItems.id}), 0)::int`,
      })
      .from(employees)
      .innerJoin(users, eq(users.id, employees.userId))
      .leftJoin(
        tokens,
        and(
          eq(tokens.employeeId, employees.id),
          eq(tokens.status, 'completed'),
          gte(tokens.createdAt, from),
          lte(tokens.createdAt, to),
        ),
      )
      .leftJoin(bills, eq(bills.tokenId, tokens.id))
      .leftJoin(billItems, eq(billItems.billId, bills.id))
      .where(eq(employees.salonId, salonId))
      .groupBy(employees.id, users.name)
      .orderBy(users.name);

    const serviceRows = await db
      .select({
        serviceId: servicesTable.id,
        serviceName: servicesTable.name,
        timesPerformed: sql<number>`count(${billItems.id})::int`,
        revenue: sql<string>`coalesce(sum(${billItems.price}), 0)::text`,
      })
      .from(servicesTable)
      .leftJoin(billItems, eq(billItems.serviceId, servicesTable.id))
      .leftJoin(
        bills,
        and(eq(bills.id, billItems.billId), gte(bills.createdAt, from), lte(bills.createdAt, to)),
      )
      .where(eq(servicesTable.salonId, salonId))
      .groupBy(servicesTable.id, servicesTable.name)
      .orderBy(desc(sql`count(${billItems.id})`));

    const rangeMinutes = Math.max((to.getTime() - from.getTime()) / 60000, 1);
    const capacityMinutes = Math.max(Number(chairCount), 1) * rangeMinutes;

    const payload: SalonOverviewReport = {
      from: from.toISOString(),
      to: to.toISOString(),
      totalTokens: Number(totals.totalTokens),
      completedTokens: Number(totals.completedTokens),
      cancelledTokens: Number(totals.cancelledTokens),
      totalRevenue: Number(revenue.total).toFixed(2),
      averageWaitMinutes: Math.round(Number(totals.averageWaitMinutes)),
      averageServiceMinutes: Math.round(Number(totals.averageServiceMinutes)),
      chairUtilizationPercent:
        Math.round((Number(totals.serviceMinutesTotal) / capacityMinutes) * 1000) / 10,
      cancellationRatePercent:
        Number(totals.totalTokens) === 0
          ? 0
          : Math.round((Number(totals.cancelledTokens) / Number(totals.totalTokens)) * 1000) / 10,
      peakHours: peakHours.map((row) => ({ hour: Number(row.hour), tokens: Number(row.tokens) })),
      revenueByDay: revenueByDay.map((row) => ({
        date: row.date,
        revenue: Number(row.revenue).toFixed(2),
        tokens: Number(row.tokens),
      })),
      employees: employeeRows.map<EmployeeStat>((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        customersServed: Number(row.customersServed),
        servicesCompleted: Number(row.servicesCompleted),
        revenue: Number(row.revenue).toFixed(2),
        averageServiceMinutes: Math.round(Number(row.averageServiceMinutes)),
      })),
      services: serviceRows.map<ServiceStat>((row) => ({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        timesPerformed: Number(row.timesPerformed),
        revenue: Number(row.revenue).toFixed(2),
      })),
    };

    res.json(payload);
  }),
);

reportsRouter.get(
  '/customers',
  requireRole('salon_admin'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);

    const rows = await db
      .select({
        customerPhone: tokens.customerPhone,
        customerName: sql<string>`max(${tokens.customerName})`,
        visits: sql<number>`count(*)::int`,
        totalSpend: sql<string>`coalesce(sum(${bills.total}), 0)::text`,
        lastVisitAt: sql<string>`max(${tokens.createdAt})::text`,
      })
      .from(tokens)
      .leftJoin(bills, eq(bills.tokenId, tokens.id))
      .where(and(eq(tokens.salonId, salonId), isNotNull(tokens.customerPhone)))
      .groupBy(tokens.customerPhone)
      .orderBy(desc(sql`count(*)`))
      .limit(500);

    const payload: CustomerDirectoryRow[] = rows.map((row) => ({
      customerPhone: row.customerPhone ?? '',
      customerName: row.customerName,
      visits: Number(row.visits),
      totalSpend: Number(row.totalSpend).toFixed(2),
      lastVisitAt: row.lastVisitAt,
    }));
    res.json(payload);
  }),
);

/** Receptionist shift summary: what this desk has billed today. */
reportsRouter.get(
  '/my-shift',
  requireRole('receptionist', 'salon_admin'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [row] = await db
      .select({
        billCount: sql<number>`count(*)::int`,
        revenue: sql<string>`coalesce(sum(${bills.total}), 0)::text`,
      })
      .from(bills)
      .where(
        and(
          eq(bills.salonId, salonId),
          eq(bills.receptionistId, req.user!.id),
          gte(bills.createdAt, startOfDay),
        ),
      );

    const [tokenRow] = await db
      .select({ tokensToday: sql<number>`count(*)::int` })
      .from(tokens)
      .where(and(eq(tokens.salonId, salonId), gte(tokens.createdAt, startOfDay)));

    res.json({
      billCount: Number(row.billCount),
      revenue: Number(row.revenue).toFixed(2),
      tokensToday: Number(tokenRow.tokensToday),
    });
  }),
);
