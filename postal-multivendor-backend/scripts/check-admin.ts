/**
 * Diagnose admin sign-in problems.
 *
 * Prints (with secrets masked) which database the API is talking to, which
 * ADMIN/STAFF accounts exist, and whether a given password matches the stored
 * bcrypt hash. Nothing is modified.
 *
 * Usage:
 *   npm run check-admin -- --email admin@postal.local --password "Str0ngPass!"
 *   railway run npm run check-admin -- --email admin@postal.local --password "..."
 */
import database from '../src/config/database';
import config from '../src/config/index';
import { User } from '../src/models/User';
import { comparePassword } from '../src/utils/crypto';

const readFlag = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
};

/** Hide credentials but keep enough to recognise the cluster/database. */
const maskUri = (uri: string): string =>
  uri.replace(/\/\/([^:]+):([^@]+)@/, (_m, user: string) => `//${user.slice(0, 2)}***:***@`);

const main = async (): Promise<void> => {
  const email = (readFlag('email') || config.admin.email).trim().toLowerCase();
  const password = readFlag('password') || config.admin.password;

  console.log('\n=== Environment ===');
  console.log(`NODE_ENV            : ${config.env}`);
  console.log(`MONGODB_URI         : ${maskUri(config.mongodb.uri)}`);
  console.log(`MONGODB_DB_NAME     : ${config.mongodb.dbName}`);
  console.log(`ADMIN_EMAIL (env)   : ${config.admin.email}`);
  console.log(
    `ADMIN_PASSWORD (env): ${
      config.admin.password
        ? `${'*'.repeat(Math.min(config.admin.password.length, 8))} (length ${config.admin.password.length})`
        : '(empty)'
    }`,
  );
  console.log(`Checking account    : ${email}`);

  await database.connect();

  const admins = await User.find({ role: { $in: ['ADMIN', 'STAFF'] } })
    .select('+password')
    .lean();

  console.log('\n=== ADMIN / STAFF accounts in this database ===');
  if (!admins.length) {
    console.log('(none)  → the bootstrap did not create the admin, or you are pointed at the wrong database.');
  }
  for (const user of admins) {
    const hasPassword = Boolean(user.password);
    const matches =
      hasPassword && password ? await comparePassword(password, String(user.password)) : false;
    console.log(
      [
        `- ${user.email}`,
        `role=${user.role}`,
        `active=${user.isActive}`,
        `hasPassword=${hasPassword}`,
        `passwordMatches=${matches ? 'YES' : 'no'}`,
      ].join('  '),
    );
  }

  console.log('\n=== Verdict ===');
  const target = admins.find((user) => String(user.email).toLowerCase() === email);
  if (!target) {
    console.log(`❌ No account with email "${email}". Create it with:`);
    console.log(`   npm run create-admin -- --email ${email} --password "<password>" --role ADMIN`);
  } else if (!target.isActive) {
    console.log('❌ Account exists but is deactivated. Re-run create-admin to reactivate it.');
  } else if (!target.password) {
    console.log('❌ Account has no password (social-only account). Re-run create-admin to set one.');
  } else if (!password) {
    console.log('⚠️  No password supplied; cannot verify. Pass --password "..." to test it.');
  } else if (await comparePassword(password, String(target.password))) {
    console.log('✅ Email + password match. The API should accept this login.');
  } else {
    console.log('❌ Password does not match the stored hash. Reset it with create-admin.');
  }

  await database.disconnect();
};

main().catch(async (error) => {
  console.error('\n❌ Diagnostic failed:', error);
  try {
    await database.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
