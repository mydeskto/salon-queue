import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { resolve } from 'node:path';
import * as schema from './schema';

config({ path: resolve(__dirname, '../../.env') });

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure it.');
  }
  return url;
}

export type Database = ReturnType<typeof createDb>['db'];

export function createDb(connectionString = getDatabaseUrl(), max = 10) {
  const sql = postgres(connectionString, { max });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

let cached: { sql: postgres.Sql; db: ReturnType<typeof drizzle<typeof schema>> } | null = null;

export function getDb() {
  if (!cached) {
    cached = createDb();
  }
  return cached.db;
}

export function getSql() {
  if (!cached) {
    cached = createDb();
  }
  return cached.sql;
}
