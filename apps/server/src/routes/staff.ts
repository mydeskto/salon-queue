import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb, users } from '@salon/db';
import { createStaffUserSchema, updateStaffUserSchema, type StaffUser } from '@salon/shared';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { conflict, notFound } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';

export const staffRouter = Router();

staffRouter.use(authenticate);

function toStaffUser(row: typeof users.$inferSelect): StaffUser {
  return {
    id: row.id,
    salonId: row.salonId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Receptionist and salon-admin accounts for one salon. */
staffRouter.get(
  '/',
  requireRole('salon_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    const rows = await getDb()
      .select()
      .from(users)
      .where(
        and(eq(users.salonId, salonId), inArray(users.role, ['salon_admin', 'receptionist'])),
      )
      .orderBy(asc(users.name));
    res.json(rows.map(toStaffUser));
  }),
);

staffRouter.post(
  '/',
  requireRole('salon_admin'),
  validateBody(createStaffUserSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const input = req.body as {
      name: string;
      email: string;
      phone?: string;
      password: string;
      role: 'salon_admin' | 'receptionist';
    };

    const email = input.email.toLowerCase().trim();
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      throw conflict('A user with this email already exists');
    }

    const [row] = await db
      .insert(users)
      .values({
        salonId,
        name: input.name,
        email,
        phone: input.phone ?? null,
        passwordHash: bcrypt.hashSync(input.password, 10),
        role: input.role,
      })
      .returning();
    res.status(201).json(toStaffUser(row));
  }),
);

staffRouter.patch(
  '/:userId',
  requireRole('salon_admin'),
  validateBody(updateStaffUserSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const input = req.body as {
      name?: string;
      phone?: string | null;
      password?: string;
      isActive?: boolean;
    };

    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.phone !== undefined) update.phone = input.phone;
    if (input.isActive !== undefined) update.isActive = input.isActive;
    if (input.password) update.passwordHash = bcrypt.hashSync(input.password, 10);

    const [row] = await db
      .update(users)
      .set(update)
      .where(
        and(
          eq(users.id, req.params.userId),
          eq(users.salonId, salonId),
          inArray(users.role, ['salon_admin', 'receptionist']),
        ),
      )
      .returning();

    if (!row) {
      throw notFound('Staff account not found');
    }
    res.json(toStaffUser(row));
  }),
);
