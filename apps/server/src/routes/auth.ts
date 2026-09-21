import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDb, salons, users } from '@salon/db';
import { loginSchema, type AuthResponse, type AuthUser } from '@salon/shared';
import { authenticate } from '../auth/middleware';
import { signToken } from '../auth/jwt';
import { unauthorized } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';

export const authRouter = Router();

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { email, password } = req.body as { email: string; password: string };

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    });
    if (!user || !user.isActive) {
      throw unauthorized('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw unauthorized('Invalid credentials');
    }

    let salonName: string | null = null;
    if (user.salonId) {
      const salon = await db.query.salons.findFirst({ where: eq(salons.id, user.salonId) });
      if (salon && salon.status !== 'active' && user.role !== 'super_admin') {
        throw unauthorized('This salon is suspended. Contact the platform administrator.');
      }
      salonName = salon?.name ?? null;
    }

    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      salonId: user.salonId,
      salonName,
    };

    const response: AuthResponse = {
      token: signToken({ sub: user.id, role: user.role, salonId: user.salonId }),
      user: authUser,
    };
    res.json(response);
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const db = getDb();
    const current = req.user!;
    let salonName: string | null = null;
    if (current.salonId) {
      const salon = await db.query.salons.findFirst({ where: eq(salons.id, current.salonId) });
      salonName = salon?.name ?? null;
    }
    const authUser: AuthUser = {
      id: current.id,
      name: current.name,
      email: current.email,
      role: current.role,
      salonId: current.salonId,
      salonName,
    };
    res.json(authUser);
  }),
);
