import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { chairs, employees, getDb, tokens, users } from '@salon/db';
import { createChairSchema, updateChairSchema, type Chair } from '@salon/shared';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { conflict, notFound } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';
import { assignWaitingTokens, broadcastChair, releaseChair } from '../services/queue';

export const chairsRouter = Router();

chairsRouter.use(authenticate);

async function listChairs(salonId: string): Promise<Chair[]> {
  const rows = await getDb()
    .select({
      id: chairs.id,
      salonId: chairs.salonId,
      label: chairs.label,
      status: chairs.status,
      currentTokenId: chairs.currentTokenId,
      currentTokenNumber: tokens.tokenNumber,
      currentEmployeeId: chairs.currentEmployeeId,
      currentEmployeeName: users.name,
    })
    .from(chairs)
    .leftJoin(tokens, eq(tokens.id, chairs.currentTokenId))
    .leftJoin(employees, eq(employees.id, chairs.currentEmployeeId))
    .leftJoin(users, eq(users.id, employees.userId))
    .where(eq(chairs.salonId, salonId))
    .orderBy(asc(chairs.label));
  return rows;
}

chairsRouter.get(
  '/',
  requireRole('salon_admin', 'receptionist', 'employee', 'super_admin'),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    res.json(await listChairs(salonId));
  }),
);

chairsRouter.post(
  '/',
  requireRole('salon_admin'),
  validateBody(createChairSchema),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, null);
    const [row] = await getDb()
      .insert(chairs)
      .values({ salonId, label: (req.body as { label: string }).label })
      .returning();
    await broadcastChair(getDb(), row.id);
    await assignWaitingTokens(salonId);
    res.status(201).json(row);
  }),
);

chairsRouter.patch(
  '/:chairId',
  requireRole('salon_admin'),
  validateBody(updateChairSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const body = req.body as { label?: string; status?: 'free' | 'occupied' | 'disabled' };

    const existing = await db.query.chairs.findFirst({
      where: and(eq(chairs.id, req.params.chairId), eq(chairs.salonId, salonId)),
    });
    if (!existing) {
      throw notFound('Chair not found');
    }
    if (body.status && body.status !== existing.status && existing.currentTokenId) {
      throw conflict('Chair is serving a customer; finish or cancel that token first');
    }

    const [row] = await db
      .update(chairs)
      .set({
        label: body.label ?? existing.label,
        status: body.status ?? existing.status,
        currentEmployeeId: body.status === 'disabled' ? null : existing.currentEmployeeId,
      })
      .where(eq(chairs.id, existing.id))
      .returning();

    await broadcastChair(db, row.id);
    if (row.status === 'free') {
      await assignWaitingTokens(salonId);
    }
    res.json(row);
  }),
);

/** Reception's "free the chair" action when a chair is stuck occupied. */
chairsRouter.post(
  '/:chairId/free',
  requireRole('salon_admin', 'receptionist'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const existing = await db.query.chairs.findFirst({
      where: and(eq(chairs.id, req.params.chairId), eq(chairs.salonId, salonId)),
    });
    if (!existing) {
      throw notFound('Chair not found');
    }
    if (existing.currentTokenId) {
      const token = await db.query.tokens.findFirst({
        where: eq(tokens.id, existing.currentTokenId),
      });
      if (token && !['completed', 'cancelled'].includes(token.status)) {
        throw conflict('Bill or cancel the active token before freeing this chair');
      }
    }
    await releaseChair(salonId, existing.id);
    res.json({ ok: true });
  }),
);
