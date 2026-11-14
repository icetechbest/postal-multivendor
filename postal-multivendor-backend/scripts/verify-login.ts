/**
 * Regression test for the "second login fails" bug.
 *
 * Root cause: the login resolver did `user.password = undefined` on the mongoose
 * document and then saved it, which issued `$unset: { password: 1 }`. The first
 * login therefore succeeded and every later login failed with
 * "Invalid email or password".
 *
 * This test calls the real `login` resolver twice against an in-memory MongoDB
 * and asserts that the stored password hash survives.
 *
 * Run with: npm run test:login
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const PASSWORD = 'Regression-Pass-123!';

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
};

const main = async (): Promise<void> => {
  const mongod = await MongoMemoryServer.create();
  // Must be set before importing config/database (they read env at import time).
  process.env.MONGODB_URI = mongod.getUri('postal-login-test');
  process.env.MONGODB_DB_NAME = 'postal-login-test';
  process.env.MONGODB_USER = '';
  process.env.MONGODB_PASSWORD = '';
  process.env.NODE_ENV = 'test';

  const database = (await import('../src/config/database')).default;
  const { User } = await import('../src/models/User');
  const { hashPassword } = await import('../src/utils/crypto');
  const { resolvers } = await import('../src/graphql/resolvers');

  await database.connect();

  const email = 'admin@postal.local';
  await User.create({
    name: 'Postal Admin',
    email,
    password: await hashPassword(PASSWORD),
    role: 'ADMIN',
    isActive: true,
    emailVerified: true,
    emailIsVerified: true,
  });

  const login = resolvers.Mutation.login as (
    parent: unknown,
    args: Record<string, unknown>,
  ) => Promise<{ token: string; refreshToken: string; user: Record<string, unknown> }>;

  // 1st login
  const first = await login({}, { email, password: PASSWORD, type: 'email' });
  assert(Boolean(first.token), 'first login did not return a token');
  assert(Boolean(first.refreshToken), 'first login did not return a refresh token');
  // The hash must still exist after a successful login (checked first: this is
  // the failure mode that broke every login after the first one).
  const afterFirst = await User.findOne({ email }).select('+password');
  assert(Boolean(afterFirst?.password), 'password hash was deleted by the first login');
  assert(!('password' in first.user), 'login response leaked the password hash');

  // 2nd login — this is the exact scenario the user reported.
  const second = await login({}, { email, password: PASSWORD, type: 'email' });
  assert(Boolean(second.token), 'second consecutive login failed');

  // 3rd login after a refresh-token rotation
  const refresh = resolvers.Mutation.refreshToken as (
    parent: unknown,
    args: { refreshToken: string },
  ) => Promise<{ token: string }>;
  const refreshed = await refresh({}, { refreshToken: second.refreshToken });
  assert(Boolean(refreshed.token), 'refresh token rotation failed');
  const third = await login({}, { email, password: PASSWORD, type: 'email' });
  assert(Boolean(third.token), 'login after refresh rotation failed');

  // A wrong password must still be rejected.
  let rejected = false;
  try {
    await login({}, { email, password: 'wrong-password', type: 'email' });
  } catch {
    rejected = true;
  }
  assert(rejected, 'a wrong password was accepted');

  // The console sends type: 'email' — make sure that exact call keeps working.
  const consoleStyle = await login({}, { email, password: PASSWORD, type: 'email' });
  assert(Boolean(consoleStyle.token), 'console-style login failed');

  await database.disconnect();
  await mongod.stop();

  console.log('\n✅ Login regression test passed: repeated logins keep the password hash intact.\n');
};

main().catch((error) => {
  console.error('\n❌ Login regression test failed:', error);
  process.exit(1);
});
