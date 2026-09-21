import type { Response } from 'express';
import { env } from '../env';

/** Name of the httpOnly auth cookie carrying the signed JWT. */
export const AUTH_COOKIE_NAME = 'salon_token';

/**
 * Cookie is httpOnly (unreachable from JS, closes the XSS token-theft vector
 * that came with storing the JWT in localStorage), sameSite=lax (sent on
 * top-level navigations and same-site fetches, blocked on cross-site POSTs),
 * and secure in production (browsers require this for cross-origin cookies
 * over HTTPS anyway).
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: env.authCookieMaxAgeMs,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
  });
}
