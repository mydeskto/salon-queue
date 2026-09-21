import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { chairs, employees, getDb, tokens } from '../../db/src';
import {
  TOKEN_STATUSES,
  assignTokenSchema,
  canTransition,
  kioskCheckInSchema,
  type TokenStatus,
} from '../../shared/src';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { badRequest, conflict, notFound } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';
import { realtime } from '../realtime';
import {
  assignWaitingTokens,
  broadcastChair,
  checkIn,
  computeQueue,
  publishQueue,
} from '../services/queue';
import { getTokenSummary, listTokenSummaries } from '../services/tokens';

export const tokensRouter = Router();

tokensRouter.use(authenticate);

const STAFF = ['salon_admin', 'receptionist', 'employee', 'super_admin'] as const;
const WRITERS = ['salon_admin', 'receptionist'] as const;

tokensRouter.get(
  '/',
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    const requested = String(req.query.status ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean) as TokenStatus[];

    const invalid = requested.filter((status) => !TOKEN_STATUSES.includes(status));
    if (invalid.length > 0) {
      throw badRequest(`Unknown token status: ${invalid.join(', ')}`);
    }

    const statuses = requested.length > 0 ? requested : ['waiting', 'in_service', 'awaiting_payment'];
    const list = await listTokenSummaries(getDb(), salonId, statuses as TokenStatus[]);
    res.json(list);
  }),
);

tokensRouter.get(
  '/queue',
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    res.json({ salonId, waiting: await computeQueue(getDb(), salonId) });
  }),
);

tokensRouter.get(
  '/:tokenId',
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const summary = await getTokenSummary(getDb(), req.params.tokenId);
    if (!summary) {
      throw notFound('Token not found');
    }
    resolveSalonId(req, summary.salonId);
    res.json(summary);
  }),
);

/** Walk-in created at the reception desk rather than the kiosk. */
tokensRouter.post(
  '/',
  requireRole(...WRITERS),
  validateBody(kioskCheckInSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as {
      salonId: string;
      serviceIds: string[];
      customerName?: string;
      customerPhone?: string;
      requestedEmployeeId?: string;
    };
    const salonId = resolveSalonId(req, input.salonId);
    const outcome = await checkIn({
      salonId,
      serviceIds: input.serviceIds,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      requestedEmployeeId: input.requestedEmployeeId ?? null,
      source: 'reception',
    });
    res.status(201).json(outcome);
  }),
);

tokensRouter.patch(
  '/:tokenId/status',
  requireRole(...WRITERS),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const nextStatus = (req.body as { status?: TokenStatus }).status;
    if (!nextStatus || !TOKEN_STATUSES.includes(nextStatus)) {
      throw badRequest('status must be one of: ' + TOKEN_STATUSES.join(', '));
    }

    const token = await db.query.tokens.findFirst({ where: eq(tokens.id, req.params.tokenId) });
    if (!token) {
      throw notFound('Token not found');
    }
    const salonId = resolveSalonId(req, token.salonId);

    if (!canTransition(token.status, nextStatus)) {
      throw conflict(`Cannot move token from ${token.status} to ${nextStatus}`);
    }
    if (nextStatus === 'completed') {
      throw conflict('Complete a token by creating its bill at reception');
    }
    if (nextStatus === 'in_service' && !token.chairId) {
      throw conflict('Assign a chair before starting service');
    }

    const now = new Date();
    await db
      .update(tokens)
      .set({
        status: nextStatus,
        serviceStartedAt: nextStatus === 'in_service' ? now : token.serviceStartedAt,
        serviceCompletedAt:
          nextStatus === 'awaiting_payment' ? now : token.serviceCompletedAt,
      })
      .where(eq(tokens.id, token.id));

    let freedChairId: string | null = null;
    if (nextStatus === 'cancelled' && token.chairId) {
      await db
        .update(chairs)
        .set({ status: 'free', currentTokenId: null })
        .where(eq(chairs.id, token.chairId));
      freedChairId = token.chairId;
    }

    const summary = await getTokenSummary(db, token.id);
    if (summary) {
      realtime.tokenStatusChanged({ salonId, token: summary, previousStatus: token.status });
    }
    if (token.chairId) {
      await broadcastChair(db, token.chairId);
    }
    if (freedChairId) {
      await assignWaitingTokens(salonId);
    } else {
      await publishQueue(salonId);
    }

    res.json(summary);
  }),
);

/** Manual override: move a waiting token onto a specific chair/stylist. */
tokensRouter.post(
  '/:tokenId/assign',
  requireRole(...WRITERS),
  validateBody(assignTokenSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { chairId, employeeId } = req.body as { chairId: string; employeeId?: string };

    const token = await db.query.tokens.findFirst({ where: eq(tokens.id, req.params.tokenId) });
    if (!token) {
      throw notFound('Token not found');
    }
    const salonId = resolveSalonId(req, token.salonId);
    if (token.status !== 'waiting') {
      throw conflict('Only waiting tokens can be assigned');
    }

    const chair = await db.query.chairs.findFirst({
      where: and(eq(chairs.id, chairId), eq(chairs.salonId, salonId)),
    });
    if (!chair) {
      throw notFound('Chair not found');
    }
    if (chair.status !== 'free' || chair.currentTokenId) {
      throw conflict('Chair is not free');
    }

    if (employeeId) {
      const employee = await db.query.employees.findFirst({
        where: and(eq(employees.id, employeeId), eq(employees.salonId, salonId)),
      });
      if (!employee) {
        throw notFound('Employee not found');
      }
    }

    const previousChairId = token.chairId;
    await db.transaction(async (tx) => {
      await tx
        .update(tokens)
        .set({ chairId, employeeId: employeeId ?? chair.currentEmployeeId ?? null })
        .where(eq(tokens.id, token.id));
      await tx
        .update(chairs)
        .set({
          status: 'occupied',
          currentTokenId: token.id,
          currentEmployeeId: employeeId ?? chair.currentEmployeeId ?? null,
        })
        .where(eq(chairs.id, chairId));
      if (previousChairId && previousChairId !== chairId) {
        await tx
          .update(chairs)
          .set({ status: 'free', currentTokenId: null })
          .where(eq(chairs.id, previousChairId));
      }
    });

    const summary = await getTokenSummary(db, token.id);
    if (summary) {
      realtime.tokenStatusChanged({ salonId, token: summary, previousStatus: token.status });
    }
    await broadcastChair(db, chairId);
    if (previousChairId && previousChairId !== chairId) {
      await broadcastChair(db, previousChairId);
    }
    await publishQueue(salonId);

    res.json(summary);
  }),
);
