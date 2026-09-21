import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb, users } from '@salon/db';
import type { UserRole } from '@salon/shared';
import { forbidden, unauthorized } from '../lib/errors';
import { verifyToken } from './jwt';

export interface RequestUser {
  id: string;
  role: UserRole;
  salonId: string | null;
  name: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw unauthorized('Missing bearer token');
    }
    const payload = verifyToken(header.slice('Bearer '.length));
    const user = await getDb().query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user || !user.isActive) {
      throw unauthorized('Account is inactive');
    }
    req.user = {
      id: user.id,
      role: user.role,
      salonId: user.salonId,
      name: user.name,
      email: user.email,
    };
    next();
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      next(error);
      return;
    }
    next(unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden(`Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}

/**
 * Resolves the salon a request may act on. Non-super-admins are always pinned
 * to their own salon, so a client-supplied salon id can never widen access.
 */
export function resolveSalonId(req: Request, requested?: string | null): string {
  const user = req.user;
  if (!user) {
    throw unauthorized();
  }
  if (user.role === 'super_admin') {
    if (!requested) {
      throw forbidden('super_admin must specify a salonId');
    }
    return requested;
  }
  if (!user.salonId) {
    throw forbidden('User is not attached to a salon');
  }
  if (requested && requested !== user.salonId) {
    throw forbidden('Cross-tenant access denied');
  }
  return user.salonId;
}
