import { randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb, users } from '../../db/src';
import {
  createKioskDeviceSchema,
  inviteStaffUserSchema,
  updateStaffUserSchema,
  type KioskPairingResult,
  type StaffInviteResult,
  type StaffUser,
} from '../../shared/src';
import { authenticate, requireRole, resolveSalonId } from '../auth/middleware';
import { conflict, notFound } from '../lib/errors';
import { asyncHandler, validateBody } from '../lib/validate';

export const staffRouter = Router();

staffRouter.use(authenticate);

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Excludes visually ambiguous characters (0/O, 1/I) so a code is easy to
// read off a screen and type on a tablet.
const PAIRING_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePairingCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += PAIRING_CHARS[randomInt(PAIRING_CHARS.length)];
  }
  return code;
}

function toStaffUser(row: typeof users.$inferSelect): StaffUser {
  const status: StaffUser['status'] =
    row.role === 'kiosk'
      ? row.passwordHash
        ? 'active'
        : 'unpaired'
      : row.passwordHash
        ? 'active'
        : 'invited';
  return {
    id: row.id,
    salonId: row.salonId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    status,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    pairingCodeExpiresAt:
      status === 'invited'
        ? row.inviteExpiresAt?.toISOString() ?? null
        : status === 'unpaired'
          ? row.pairingCodeExpiresAt?.toISOString() ?? null
          : null,
  };
}

/** Receptionist, salon-admin, and kiosk-screen accounts for one salon. */
staffRouter.get(
  '/',
  requireRole('salon_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const salonId = resolveSalonId(req, (req.query.salonId as string) ?? null);
    const rows = await getDb()
      .select()
      .from(users)
      .where(
        and(
          eq(users.salonId, salonId),
          inArray(users.role, ['salon_admin', 'receptionist', 'kiosk']),
        ),
      )
      .orderBy(asc(users.name));
    res.json(rows.map(toStaffUser));
  }),
);

/**
 * Invites a receptionist or salon_admin by email — no password is set here.
 * The admin shares `inviteUrl` (copy/paste, no email sending wired up);
 * the invitee opens it and sets their own password via /api/staff/invites/accept.
 */
staffRouter.post(
  '/invite',
  requireRole('salon_admin'),
  validateBody(inviteStaffUserSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const input = req.body as {
      name: string;
      email: string;
      phone?: string;
      role: 'salon_admin' | 'receptionist';
    };

    const email = input.email.toLowerCase().trim();
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      throw conflict('A user with this email already exists');
    }

    const inviteToken = randomBytes(24).toString('base64url');
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const [row] = await db
      .insert(users)
      .values({
        salonId,
        name: input.name,
        email,
        phone: input.phone ?? null,
        passwordHash: null,
        role: input.role,
        inviteToken,
        inviteExpiresAt,
      })
      .returning();

    const response: StaffInviteResult = {
      staff: toStaffUser(row),
      inviteUrl: `/invite/${inviteToken}`,
      expiresAt: inviteExpiresAt.toISOString(),
    };
    res.status(201).json(response);
  }),
);

/** Resends (regenerates) an invite link for a staff member still in the 'invited' state. */
staffRouter.post(
  '/:userId/reinvite',
  requireRole('salon_admin'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const inviteToken = randomBytes(24).toString('base64url');
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const [row] = await db
      .update(users)
      .set({ inviteToken, inviteExpiresAt })
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
    if (row.passwordHash) {
      throw conflict('This account has already accepted its invite');
    }

    const response: StaffInviteResult = {
      staff: toStaffUser(row),
      inviteUrl: `/invite/${inviteToken}`,
      expiresAt: inviteExpiresAt.toISOString(),
    };
    res.json(response);
  }),
);

/** Registers a new kiosk screen device and issues its first pairing code. */
staffRouter.post(
  '/kiosk-devices',
  requireRole('salon_admin'),
  validateBody(createKioskDeviceSchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const input = req.body as { name: string };

    // Kiosk devices need a login identity for the users table (unique email)
    // but it's never used for password sign-in — pairing is code-based only.
    const email = `kiosk.${randomBytes(8).toString('hex')}@screens.local`;
    const pairingCode = generatePairingCode();
    const pairingCodeExpiresAt = new Date(Date.now() + PAIRING_TTL_MS);

    const [row] = await db
      .insert(users)
      .values({
        salonId,
        name: input.name,
        email,
        passwordHash: null,
        role: 'kiosk',
        pairingCode,
        pairingCodeExpiresAt,
      })
      .returning();

    const response: KioskPairingResult = {
      staff: toStaffUser(row),
      code: pairingCode,
      expiresAt: pairingCodeExpiresAt.toISOString(),
    };
    res.status(201).json(response);
  }),
);

/** Generates a fresh pairing code for an existing kiosk device (e.g. it was reset, or the code expired). */
staffRouter.post(
  '/:userId/pairing-code',
  requireRole('salon_admin'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const salonId = resolveSalonId(req, null);
    const pairingCode = generatePairingCode();
    const pairingCodeExpiresAt = new Date(Date.now() + PAIRING_TTL_MS);

    const [row] = await db
      .update(users)
      .set({ pairingCode, pairingCodeExpiresAt })
      .where(
        and(
          eq(users.id, req.params.userId),
          eq(users.salonId, salonId),
          eq(users.role, 'kiosk'),
        ),
      )
      .returning();

    if (!row) {
      throw notFound('Kiosk device not found');
    }

    const response: KioskPairingResult = {
      staff: toStaffUser(row),
      code: pairingCode,
      expiresAt: pairingCodeExpiresAt.toISOString(),
    };
    res.json(response);
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
          inArray(users.role, ['salon_admin', 'receptionist', 'kiosk']),
        ),
      )
      .returning();

    if (!row) {
      throw notFound('Staff account not found');
    }
    res.json(toStaffUser(row));
  }),
);
