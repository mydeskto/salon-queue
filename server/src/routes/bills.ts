import { Router } from 'express';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import {
  billItems,
  bills,
  chairs,
  dailyEmployeeStats,
  employees,
  getDb,
  salons,
  services as servicesTable,
  tokenServices,
  tokens,
  users,
  type Database,
} from '../../db/src';
import { createBillSchema, type Bill, type PaymentMethod } from '../../shared/src';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { badRequest, conflict, notFound } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';
import { realtime } from '../realtime';
import { assignWaitingTokens, broadcastChair } from '../services/queue';
import { getTokenSummary } from '../services/tokens';
import { printBill, printingEnabled, renderBillText, type ReceiptPayload } from '../services/printing';

export const billsRouter = Router();

billsRouter.use(authenticate);

const BILLERS = ['receptionist', 'salon_admin'] as const;
const READERS = ['receptionist', 'salon_admin', 'super_admin'] as const;

function round2(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

async function loadBill(db: Database, billId: string): Promise<Bill | null> {
  const receptionist = users;
  const [row] = await db
    .select({
      id: bills.id,
      salonId: bills.salonId,
      tokenId: bills.tokenId,
      tokenNumber: tokens.tokenNumber,
      customerName: tokens.customerName,
      receptionistId: bills.receptionistId,
      receptionistName: receptionist.name,
      subtotal: bills.subtotal,
      discount: bills.discount,
      tax: bills.tax,
      total: bills.total,
      paymentMethod: bills.paymentMethod,
      printedAt: bills.printedAt,
      createdAt: bills.createdAt,
      employeeUserId: employees.userId,
    })
    .from(bills)
    .innerJoin(tokens, eq(tokens.id, bills.tokenId))
    .leftJoin(receptionist, eq(receptionist.id, bills.receptionistId))
    .leftJoin(employees, eq(employees.id, tokens.employeeId))
    .where(eq(bills.id, billId));

  if (!row) {
    return null;
  }

  const items = await db
    .select({ serviceId: billItems.serviceId, name: billItems.name, price: billItems.price })
    .from(billItems)
    .where(eq(billItems.billId, billId));

  let employeeName: string | null = null;
  if (row.employeeUserId) {
    const employeeUser = await db.query.users.findFirst({
      where: eq(users.id, row.employeeUserId),
    });
    employeeName = employeeUser?.name ?? null;
  }

  return {
    id: row.id,
    salonId: row.salonId,
    tokenId: row.tokenId,
    tokenNumber: row.tokenNumber,
    receptionistId: row.receptionistId ?? '',
    receptionistName: row.receptionistName ?? 'Unknown',
    customerName: row.customerName,
    employeeName,
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    total: row.total,
    paymentMethod: row.paymentMethod,
    printedAt: row.printedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    items,
  };
}

async function buildReceipt(db: Database, bill: Bill): Promise<ReceiptPayload> {
  const salon = await db.query.salons.findFirst({ where: eq(salons.id, bill.salonId) });
  const token = await getTokenSummary(db, bill.tokenId);
  return {
    salonName: salon?.name ?? 'Salon',
    salonAddress: salon?.address ?? null,
    salonPhone: salon?.phone ?? null,
    tokenNumber: bill.tokenNumber,
    customerName: bill.customerName,
    employeeName: bill.employeeName,
    chairLabel: token?.chairLabel ?? null,
    receptionistName: bill.receptionistName,
    items: bill.items.map((item) => ({ name: item.name, price: item.price })),
    subtotal: bill.subtotal,
    discount: bill.discount,
    tax: bill.tax,
    total: bill.total,
    paymentMethod: bill.paymentMethod,
    issuedAt: new Date(bill.createdAt),
  };
}

billsRouter.post(
  '/',
  requireRole(...BILLERS),
  validateBody(createBillSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const input = req.body as {
      tokenId: string;
      discount: string;
      taxRate: number;
      paymentMethod: PaymentMethod;
      items?: Array<{ serviceId: string; price: string }>;
    };

    const token = await db.query.tokens.findFirst({ where: eq(tokens.id, input.tokenId) });
    if (!token) {
      throw notFound('Token not found');
    }
    const salonId = resolveSalonId(req, token.salonId);
    if (token.status !== 'awaiting_payment') {
      throw conflict(`Token must be awaiting_payment (currently ${token.status})`);
    }

    const bookedServices = await db
      .select({
        serviceId: tokenServices.serviceId,
        name: servicesTable.name,
        price: tokenServices.priceAtBooking,
      })
      .from(tokenServices)
      .innerJoin(servicesTable, eq(servicesTable.id, tokenServices.serviceId))
      .where(eq(tokenServices.tokenId, token.id));

    const bookedById = new Map(bookedServices.map((row) => [row.serviceId, row]));
    const requestedItems = input.items ?? bookedServices.map((row) => ({
      serviceId: row.serviceId,
      price: row.price,
    }));

    // Items not already booked on the token can still be billed — the
    // receptionist may add a service the customer decided on at checkout.
    // Look those up from the salon's active catalogue instead of rejecting.
    const extraServiceIds = requestedItems
      .map((item) => item.serviceId)
      .filter((serviceId) => !bookedById.has(serviceId));
    const extraServices = extraServiceIds.length
      ? await db
          .select({ id: servicesTable.id, name: servicesTable.name, isActive: servicesTable.isActive })
          .from(servicesTable)
          .where(and(eq(servicesTable.salonId, salonId), inArray(servicesTable.id, extraServiceIds)))
      : [];
    const extraById = new Map(extraServices.map((row) => [row.id, row]));

    const lineItems = requestedItems.map((item) => {
      const booked = bookedById.get(item.serviceId);
      if (booked) {
        return { serviceId: item.serviceId, name: booked.name, price: item.price };
      }
      const extra = extraById.get(item.serviceId);
      if (!extra || !extra.isActive) {
        throw badRequest(`Service ${item.serviceId} is not part of this token or salon`);
      }
      return { serviceId: item.serviceId, name: extra.name, price: item.price };
    });

    const subtotal = lineItems.reduce((sum, item) => sum + Number(item.price), 0);
    const discount = Number(input.discount ?? '0');
    if (discount < 0 || discount > subtotal) {
      throw badRequest('Discount must be between 0 and the subtotal');
    }
    const taxable = subtotal - discount;
    const tax = (taxable * (input.taxRate ?? 0)) / 100;
    const total = taxable + tax;

    const now = new Date();
    const billId = await db.transaction(async (tx) => {
      const [bill] = await tx
        .insert(bills)
        .values({
          tokenId: token.id,
          salonId,
          receptionistId: req.user!.id,
          subtotal: round2(subtotal),
          discount: round2(discount),
          tax: round2(tax),
          total: round2(total),
          paymentMethod: input.paymentMethod,
        })
        .returning({ id: bills.id });

      await tx.insert(billItems).values(
        lineItems.map((item) => ({
          billId: bill.id,
          serviceId: item.serviceId,
          name: item.name,
          price: round2(Number(item.price)),
        })),
      );

      await tx
        .update(tokens)
        .set({ status: 'completed', paidAt: now })
        .where(eq(tokens.id, token.id));

      if (token.chairId) {
        await tx
          .update(chairs)
          .set({ status: 'free', currentTokenId: null })
          .where(eq(chairs.id, token.chairId));
      }

      if (token.employeeId) {
        const serviceMinutes =
          token.serviceStartedAt && token.serviceCompletedAt
            ? Math.max(
                1,
                Math.round(
                  (token.serviceCompletedAt.getTime() - token.serviceStartedAt.getTime()) / 60000,
                ),
              )
            : 0;

        await tx
          .insert(dailyEmployeeStats)
          .values({
            salonId,
            employeeId: token.employeeId,
            statDate: now.toISOString().slice(0, 10),
            customersServed: 1,
            servicesCompleted: lineItems.length,
            revenueGenerated: round2(total),
            averageServiceMinutes: serviceMinutes,
          })
          .onConflictDoUpdate({
            target: [dailyEmployeeStats.employeeId, dailyEmployeeStats.statDate],
            set: {
              customersServed: sql`${dailyEmployeeStats.customersServed} + 1`,
              servicesCompleted: sql`${dailyEmployeeStats.servicesCompleted} + ${lineItems.length}`,
              revenueGenerated: sql`${dailyEmployeeStats.revenueGenerated} + ${round2(total)}`,
              averageServiceMinutes: sql`
                ((${dailyEmployeeStats.averageServiceMinutes} * ${dailyEmployeeStats.customersServed}) + ${serviceMinutes})
                / (${dailyEmployeeStats.customersServed} + 1)`,
              updatedAt: now,
            },
          });
      }

      return bill.id;
    });

    const bill = await loadBill(db, billId);
    if (!bill) {
      throw notFound('Bill not found after creation');
    }

    const receipt = await buildReceipt(db, bill);
    const printResult = printingEnabled()
      ? await printBill(receipt)
      : { printed: false, reason: 'ESC/POS printing is disabled; use browser print' };

    if (printResult.printed) {
      await db.update(bills).set({ printedAt: new Date() }).where(eq(bills.id, bill.id));
      bill.printedAt = new Date().toISOString();
    }

    const summary = await getTokenSummary(db, token.id);
    if (summary) {
      realtime.tokenStatusChanged({
        salonId,
        token: summary,
        previousStatus: 'awaiting_payment',
      });
    }
    realtime.billCompleted({
      salonId,
      billId: bill.id,
      tokenId: bill.tokenId,
      total: bill.total,
      paymentMethod: bill.paymentMethod,
      completedAt: bill.createdAt,
    });

    if (token.chairId) {
      await broadcastChair(db, token.chairId);
    }
    await assignWaitingTokens(salonId);

    res.status(201).json({ bill, receiptText: renderBillText(receipt), print: printResult });
  }),
);

billsRouter.get(
  '/',
  requireRole(...READERS),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const conditions = [eq(bills.salonId, salonId)];
    if (from && !Number.isNaN(from.getTime())) {
      conditions.push(gte(bills.createdAt, from));
    }
    if (to && !Number.isNaN(to.getTime())) {
      conditions.push(lte(bills.createdAt, to));
    }

    const rows = await db
      .select({ id: bills.id })
      .from(bills)
      .where(and(...conditions))
      .orderBy(desc(bills.createdAt))
      .limit(200);

    const list = await Promise.all(rows.map((row) => loadBill(db, row.id)));
    res.json(list.filter((bill): bill is Bill => bill !== null));
  }),
);

billsRouter.get(
  '/:billId',
  requireRole(...READERS),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const bill = await loadBill(db, req.params.billId);
    if (!bill) {
      throw notFound('Bill not found');
    }
    resolveSalonId(req, bill.salonId);
    const receipt = await buildReceipt(db, bill);
    res.json({ bill, receiptText: renderBillText(receipt) });
  }),
);

billsRouter.post(
  '/:billId/print',
  requireRole(...BILLERS),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const bill = await loadBill(db, req.params.billId);
    if (!bill) {
      throw notFound('Bill not found');
    }
    resolveSalonId(req, bill.salonId);

    const receipt = await buildReceipt(db, bill);
    const printResult = printingEnabled()
      ? await printBill(receipt)
      : { printed: false, reason: 'ESC/POS printing is disabled; use browser print' };

    if (printResult.printed) {
      await db.update(bills).set({ printedAt: new Date() }).where(eq(bills.id, bill.id));
    }

    res.json({ print: printResult, receiptText: renderBillText(receipt) });
  }),
);
