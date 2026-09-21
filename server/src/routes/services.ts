import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { getDb, services as servicesTable } from '../../db/src';
import { createServiceSchema, updateServiceSchema, type Service } from '../../shared/src';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { notFound } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';

export const servicesRouter = Router();

servicesRouter.use(authenticate);

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

servicesRouter.get(
  '/',
  requireRole('salon_admin', 'receptionist', 'employee', 'super_admin'),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    const rows = await getDb()
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.salonId, salonId))
      .orderBy(asc(servicesTable.category), asc(servicesTable.name));
    res.json(rows.map(toService));
  }),
);

servicesRouter.post(
  '/',
  requireRole('salon_admin'),
  validateBody(createServiceSchema),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, null);
    const [row] = await getDb()
      .insert(servicesTable)
      .values({ ...(req.body as Record<string, unknown>), salonId } as typeof servicesTable.$inferInsert)
      .returning();
    res.status(201).json(toService(row));
  }),
);

servicesRouter.patch(
  '/:serviceId',
  requireRole('salon_admin'),
  validateBody(updateServiceSchema),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, null);
    const [row] = await getDb()
      .update(servicesTable)
      .set(req.body as Partial<typeof servicesTable.$inferInsert>)
      .where(and(eq(servicesTable.id, req.params.serviceId), eq(servicesTable.salonId, salonId)))
      .returning();
    if (!row) {
      throw notFound('Service not found');
    }
    res.json(toService(row));
  }),
);

servicesRouter.delete(
  '/:serviceId',
  requireRole('salon_admin'),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, null);
    // Soft delete: historical tokens/bills reference the service row.
    const [row] = await getDb()
      .update(servicesTable)
      .set({ isActive: false })
      .where(and(eq(servicesTable.id, req.params.serviceId), eq(servicesTable.salonId, salonId)))
      .returning();
    if (!row) {
      throw notFound('Service not found');
    }
    res.json(toService(row));
  }),
);
