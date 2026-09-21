import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  chairs,
  employees,
  services as servicesTable,
  tokenServices,
  tokens,
  users,
  type Database,
} from '@salon/db';
import type { TokenStatus, TokenSummary } from '@salon/shared';

type Db = Database;

function money(sum: number): string {
  return sum.toFixed(2);
}

const tokenSelection = {
  id: tokens.id,
  salonId: tokens.salonId,
  tokenNumber: tokens.tokenNumber,
  customerName: tokens.customerName,
  customerPhone: tokens.customerPhone,
  chairId: tokens.chairId,
  chairLabel: chairs.label,
  employeeId: tokens.employeeId,
  employeeName: users.name,
  status: tokens.status,
  createdAt: tokens.createdAt,
  serviceStartedAt: tokens.serviceStartedAt,
  serviceCompletedAt: tokens.serviceCompletedAt,
  paidAt: tokens.paidAt,
};

interface TokenRow {
  id: string;
  salonId: string;
  tokenNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  chairId: string | null;
  chairLabel: string | null;
  employeeId: string | null;
  employeeName: string | null;
  status: TokenStatus;
  createdAt: Date;
  serviceStartedAt: Date | null;
  serviceCompletedAt: Date | null;
  paidAt: Date | null;
}

async function attachServices(db: Db, rows: TokenRow[]): Promise<TokenSummary[]> {
  if (rows.length === 0) {
    return [];
  }
  const serviceRows = await db
    .select({
      tokenId: tokenServices.tokenId,
      serviceId: tokenServices.serviceId,
      name: servicesTable.name,
      price: tokenServices.priceAtBooking,
      durationMinutes: tokenServices.durationAtBooking,
    })
    .from(tokenServices)
    .innerJoin(servicesTable, eq(servicesTable.id, tokenServices.serviceId))
    .where(
      inArray(
        tokenServices.tokenId,
        rows.map((row) => row.id),
      ),
    );

  const byToken = new Map<string, TokenSummary['services']>();
  for (const row of serviceRows) {
    const list = byToken.get(row.tokenId) ?? [];
    list.push({
      serviceId: row.serviceId,
      name: row.name,
      price: row.price,
      durationMinutes: row.durationMinutes,
    });
    byToken.set(row.tokenId, list);
  }

  return rows.map((row) => {
    const tokenServiceList = byToken.get(row.id) ?? [];
    return {
      id: row.id,
      salonId: row.salonId,
      tokenNumber: row.tokenNumber,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      chairId: row.chairId,
      chairLabel: row.chairLabel,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      status: row.status,
      services: tokenServiceList,
      totalPrice: money(tokenServiceList.reduce((sum, s) => sum + Number(s.price), 0)),
      estimatedDurationMinutes: tokenServiceList.reduce((sum, s) => sum + s.durationMinutes, 0),
      createdAt: row.createdAt.toISOString(),
      serviceStartedAt: row.serviceStartedAt?.toISOString() ?? null,
      serviceCompletedAt: row.serviceCompletedAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
    };
  });
}

export async function getTokenSummary(db: Db, tokenId: string): Promise<TokenSummary | null> {
  const rows = await db
    .select(tokenSelection)
    .from(tokens)
    .leftJoin(chairs, eq(chairs.id, tokens.chairId))
    .leftJoin(employees, eq(employees.id, tokens.employeeId))
    .leftJoin(users, eq(users.id, employees.userId))
    .where(eq(tokens.id, tokenId));

  const [summary] = await attachServices(db, rows as TokenRow[]);
  return summary ?? null;
}

export async function listTokenSummaries(
  db: Db,
  salonId: string,
  statuses: TokenStatus[],
): Promise<TokenSummary[]> {
  const rows = await db
    .select(tokenSelection)
    .from(tokens)
    .leftJoin(chairs, eq(chairs.id, tokens.chairId))
    .leftJoin(employees, eq(employees.id, tokens.employeeId))
    .leftJoin(users, eq(users.id, employees.userId))
    .where(and(eq(tokens.salonId, salonId), inArray(tokens.status, statuses)))
    .orderBy(asc(tokens.createdAt));

  return attachServices(db, rows as TokenRow[]);
}
