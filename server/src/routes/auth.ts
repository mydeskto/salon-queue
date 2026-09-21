import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { getDb, salons, users } from '../../db/src';
import {
  acceptInviteSchema,
  loginSchema,
  redeemPairingCodeSchema,
  type AuthResponse,
  type AuthUser,
} from '../../shared/src';
import { authenticate, touchKioskLastSeen } from '../auth/middleware';
import { clearAuthCookie, setAuthCookie } from '../auth/cookie';
import { signToken } from '../auth/jwt';
import { env } from '../env';
import { badRequest, unauthorized } from '../lib/errors';
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
    // No passwordHash means an invited account that hasn't accepted its
    // invite yet, or a kiosk device that hasn't been paired — neither can
    // sign in with a password.
    if (!user || !user.isActive || !user.passwordHash) {
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

    const token = signToken({ sub: user.id, role: user.role, salonId: user.salonId });
    setAuthCookie(res, token);

    // `token` is still included in the body so non-browser clients
    // (./scripts/smoke.sh, integrations) can use the Bearer fallback.
    const response: AuthResponse = { token, user: authUser };
    res.json(response);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  }),
);

/** Lets the invite-accept page confirm the link is still valid before showing the form. */
authRouter.get(
  '/invites/:token',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.inviteToken, req.params.token),
    });
    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date() || user.passwordHash) {
      throw badRequest('This invite link is invalid or has expired.');
    }
    res.json({ name: user.name, email: user.email });
  }),
);

/** Step 2 of the receptionist/admin invite flow: the invitee sets their own password. */
authRouter.post(
  '/invites/accept',
  validateBody(acceptInviteSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { token, password } = req.body as { token: string; password: string };

    const user = await db.query.users.findFirst({ where: eq(users.inviteToken, token) });
    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date() || user.passwordHash) {
      throw badRequest('This invite link is invalid or has expired.');
    }

    const [updated] = await db
      .update(users)
      .set({
        passwordHash: bcrypt.hashSync(password, 10),
        inviteToken: null,
        inviteExpiresAt: null,
      })
      .where(eq(users.id, user.id))
      .returning();

    let salonName: string | null = null;
    if (updated.salonId) {
      const salon = await db.query.salons.findFirst({ where: eq(salons.id, updated.salonId) });
      salonName = salon?.name ?? null;
    }
    const authUser: AuthUser = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      salonId: updated.salonId,
      salonName,
    };
    const jwt = signToken({ sub: updated.id, role: updated.role, salonId: updated.salonId });
    setAuthCookie(res, jwt);
    const response: AuthResponse = { token: jwt, user: authUser };
    res.json(response);
  }),
);

/** A kiosk tablet redeems the short-lived pairing code shown on the admin's staff page. */
authRouter.post(
  '/kiosk/redeem',
  validateBody(redeemPairingCodeSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { code } = req.body as { code: string };

    const user = await db.query.users.findFirst({
      where: and(eq(users.pairingCode, code), eq(users.role, 'kiosk'), gt(users.pairingCodeExpiresAt, new Date())),
    });
    if (!user || !user.isActive) {
      throw badRequest('This code is invalid or has expired.');
    }

    const [updated] = await db
      .update(users)
      .set({
        pairingCode: null,
        pairingCodeExpiresAt: null,
        lastSeenAt: new Date(),
        // A device-issued password isn't used for sign-in (redeem is the
        // only entry point), but a non-null hash marks the device as
        // paired/"active" for status display and login()-style flows stay
        // impossible without a real password.
        passwordHash: bcrypt.hashSync(randomBytes(24).toString('hex'), 10),
      })
      .where(eq(users.id, user.id))
      .returning();

    let salonName: string | null = null;
    if (updated.salonId) {
      const salon = await db.query.salons.findFirst({ where: eq(salons.id, updated.salonId) });
      salonName = salon?.name ?? null;
    }
    const authUser: AuthUser = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      salonId: updated.salonId,
      salonName,
    };
    const jwt = signToken(
      { sub: updated.id, role: updated.role, salonId: updated.salonId },
      env.kioskJwtExpiresIn,
    );
    setAuthCookie(res, jwt, env.kioskAuthCookieMaxAgeMs);
    const response: AuthResponse = { token: jwt, user: authUser };
    res.json(response);
  }),
);

/** Kiosk check-in screen pings this periodically so the admin's staff page can show "online now". */
authRouter.post(
  '/heartbeat',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'kiosk') {
      await touchKioskLastSeen(req.user!.id);
    }
    res.json({ ok: true });
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
