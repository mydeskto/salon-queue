import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb, users } from '../../db/src';
import type { UserRole } from '../../shared/src';
import { forbidden, unauthorized } from '../lib/errors';
import { AUTH_COOKIE_NAME } from './cookie';
import { verifyToken } from './jwt';

/**
 * Reads the JWT from the httpOnly cookie first (the browser flow); falls
 * back to `Authorization: Bearer` so scripts/tools (./scripts/smoke.sh,
 * server-to-server calls) keep working without cookie support.
 */
function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return null;
}

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
    const token = extractToken(req);
    if (!token) {
      throw unauthorized('Missing authentication token');
    }
    const payload = verifyToken(token);
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
