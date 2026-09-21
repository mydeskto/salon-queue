import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb, users } from '../db/src';
import { env } from './env';
import { generateStrongPassword } from './lib/password';

/**
 * Ensures at least one super_admin account exists. Runs on every server
 * start but only ever creates an account once — if any super_admin already
 * exists (from this bootstrap, the demo seeder, or manually), it's a no-op.
 * The generated password is shown exactly once, in the server log, and
 * never stored anywhere in plaintext.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const db = getDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.role, 'super_admin'),
  });
  if (existing) {
    return;
  }

  const email = env.bootstrapAdminEmail.toLowerCase().trim();
  const emailTaken = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (emailTaken) {
    console.warn(
      `[bootstrap] BOOTSTRAP_ADMIN_EMAIL (${email}) is already in use by a non-super_admin account. ` +
        'Set a different BOOTSTRAP_ADMIN_EMAIL and restart, or create a super_admin manually.',
    );
    return;
  }

  const password = generateStrongPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    name: env.bootstrapAdminName,
    email,
    passwordHash,
    role: 'super_admin',
    salonId: null,
  });

  const banner = '='.repeat(64);
  console.log(`\n${banner}`);
  console.log('  First-run super admin account created');
  console.log(banner);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(banner);
  console.log('  Save this password now — it will not be shown again.');
  console.log('  Sign in at /superadmin/hello/login and change it if desired.');
  console.log(`${banner}\n`);
}
