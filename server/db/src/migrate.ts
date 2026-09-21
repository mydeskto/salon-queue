import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import { createDb } from './client';

async function main() {
  const { sql, db } = createDb(undefined, 1);
  await migrate(db, { migrationsFolder: resolve(__dirname, '../migrations') });
  await sql.end();
  console.log('Migrations applied.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
