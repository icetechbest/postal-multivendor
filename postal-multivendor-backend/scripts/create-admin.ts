/**
 * Create or reset an admin / staff account.
 *
 * The backend bootstraps a single admin from ADMIN_EMAIL / ADMIN_PASSWORD only
 * when that email does not exist yet. If the account already exists with an
 * older password (or was created by a previous deployment with different env
 * values), logging in with the new password fails with
 * "Invalid email or password". This script fixes that by upserting the account
 * and always writing a fresh bcrypt hash.
 *
 * Usage:
 *   npm run create-admin -- --email admin@postal.local --password "Str0ngPass!" --role ADMIN
 *   npm run create-admin -- --email staff@postal.local --password "Str0ngPass!" --role STAFF --name "Night Shift"
 */
import database from '../src/config/database';
import { User } from '../src/models/User';
import { hashPassword } from '../src/utils/crypto';

type Role = 'ADMIN' | 'STAFF';

const readFlag = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
};

const fail = (message: string): never => {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
};

const main = async (): Promise<void> => {
  const email = (readFlag('email') || process.env.ADMIN_EMAIL || 'admin@postal.local').trim().toLowerCase();
  const password = readFlag('password') || process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS;
  const role = (readFlag('role') || 'ADMIN').toUpperCase() as Role;
  const name = readFlag('name') || (role === 'ADMIN' ? 'Postal Admin' : 'Postal Staff');

  if (!email.includes('@')) fail(`Invalid email: ${email}`);
  if (!password) fail('Password is required. Pass --password "..." or set ADMIN_PASSWORD.');
  if (password.length < 6) fail('Password must be at least 6 characters.');
  if (!['ADMIN', 'STAFF'].includes(role)) fail(`Role must be ADMIN or STAFF (received ${role}).`);

  await database.connect();

  const hashed = await hashPassword(password);
  const existing = await User.findOne({ email }).select('+password');

  if (existing) {
    existing.name = existing.name || name;
    existing.password = hashed;
    existing.role = role;
    existing.isActive = true;
    existing.emailVerified = true;
    existing.emailIsVerified = true;
    // Invalidate any previously issued refresh token for this account.
    existing.refreshTokenHash = undefined;
    await existing.save();
    console.log(`\n✅ Password reset for existing account: ${email} (role ${role})`);
  } else {
    await User.create({
      name,
      email,
      password: hashed,
      role,
      isActive: true,
      emailVerified: true,
      emailIsVerified: true,
    });
    console.log(`\n✅ Created new account: ${email} (role ${role})`);
  }

  console.log('   You can now sign in to the order console with these credentials.');
  console.log('   Remember: only ADMIN and STAFF roles are allowed.\n');

  await database.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  try {
    await database.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
