import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
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
