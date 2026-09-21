import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  /** Bootstrap super admin — created automatically on first server start if no super_admin exists yet. */
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@salonqueue.local',
  bootstrapAdminName: process.env.BOOTSTRAP_ADMIN_NAME ?? 'Platform Owner',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  /** Cookie max-age, in milliseconds, mirroring jwtExpiresIn's default (12h). */
  authCookieMaxAgeMs: Number(process.env.AUTH_COOKIE_MAX_AGE_MS ?? 12 * 60 * 60 * 1000),
  /**
   * Kiosk devices re-pairing requires an admin physically generating a new
   * code, so their session should outlast a typical staff shift by a wide
   * margin (default 90 days) rather than forcing daily re-pairing.
   */
  kioskJwtExpiresIn: process.env.KIOSK_JWT_EXPIRES_IN ?? '90d',
  kioskAuthCookieMaxAgeMs: Number(
    process.env.KIOSK_AUTH_COOKIE_MAX_AGE_MS ?? 90 * 24 * 60 * 60 * 1000,
  ),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim()),
  escpos: {
    enabled: process.env.ESCPOS_ENABLED === 'true',
    interface: process.env.ESCPOS_INTERFACE ?? '',
    characterSet: process.env.ESCPOS_CHARACTER_SET ?? 'PC437_USA',
    width: Number(process.env.ESCPOS_WIDTH ?? 42),
  },
};
