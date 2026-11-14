/**
 * Regression test for phone-number-only authentication.
 *
 * Verifies that `loginWithPhone`:
 *  - rejects an invalid OTP,
 *  - creates the customer account on the first successful verification,
 *  - reuses the same account (no duplicate) on the next sign-in,
 *  - blocks deactivated accounts and never leaks sensitive fields.
 *
 * Run with: npm run test:phone-login
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const PHONE = '+201234567890';
const OTP = '123456';

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
};

const main = async (): Promise<void> => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('postal-phone-login-test');
  process.env.MONGODB_DB_NAME = 'postal-phone-login-test';
  process.env.MONGODB_USER = '';
  process.env.MONGODB_PASSWORD = '';
  process.env.NODE_ENV = 'test';

  const database = (await import('../src/config/database')).default;
  const { User } = await import('../src/models/User');
  const { OtpRequest } = await import('../src/models/OtpRequest');
  const { hashPassword } = await import('../src/utils/crypto');
  const { resolvers } = await import('../src/graphql/resolvers');

  await database.connect();

  const seedOtp = async (otp: string) => {
    await OtpRequest.deleteMany({ target: PHONE });
    await OtpRequest.create({
      target: PHONE,
      otpHash: await hashPassword(otp),
      expiresAt: new Date(Date.now() + 5 * 60_000),
      attempts: 0,
      requestedAt: new Date(),
    });
  };

  const loginWithPhone = resolvers.Mutation.loginWithPhone as (
    parent: unknown,
    args: Record<string, unknown>,
  ) => Promise<{ token: string; refreshToken: string; isNewUser: boolean; user: Record<string, unknown> }>;

  // 1. A wrong OTP must be rejected and must not create an account.
  await seedOtp(OTP);
  let rejected = false;
  try {
    await loginWithPhone({}, { phone: PHONE, otp: '000000' });
  } catch {
    rejected = true;
  }
  assert(rejected, 'an invalid OTP was accepted');
  assert((await User.countDocuments({ phone: PHONE })) === 0, 'an account was created with an invalid OTP');

  // 2. First successful verification creates the account.
  await seedOtp(OTP);
  const first = await loginWithPhone({}, { phone: PHONE, otp: OTP, name: 'Phone Customer' });
  assert(Boolean(first.token), 'first phone login did not return a token');
  assert(Boolean(first.refreshToken), 'first phone login did not return a refresh token');
  assert(first.isNewUser === true, 'first phone login should be flagged as a new user');
  assert(!('password' in first.user), 'phone login response leaked the password hash');

  const created = await User.findOne({ phone: PHONE });
  assert(Boolean(created), 'the customer account was not created');
  assert(created?.phoneVerified === true, 'the phone number was not marked as verified');
  assert(created?.name === 'Phone Customer', 'the provided name was not stored');
  assert(!created?.email, 'a phone-only account should not have an email address');

  // 3. A second sign-in reuses the same account.
  await seedOtp(OTP);
  const second = await loginWithPhone({}, { phone: PHONE, otp: OTP });
  assert(Boolean(second.token), 'second phone login did not return a token');
  assert(second.isNewUser === false, 'second phone login should not be flagged as a new user');
  assert((await User.countDocuments({ phone: PHONE })) === 1, 'a duplicate account was created');

  // 4. Deactivated accounts must be blocked.
  await User.updateOne({ phone: PHONE }, { $set: { isActive: false } });
  await seedOtp(OTP);
  let blocked = false;
  try {
    await loginWithPhone({}, { phone: PHONE, otp: OTP });
  } catch {
    blocked = true;
  }
  assert(blocked, 'a deactivated account was allowed to sign in');

  await database.disconnect?.();
  await mongod.stop();
  console.log('\u2705 Phone login regression test passed');
  process.exit(0);
};

main().catch((error) => {
  console.error('\u274c Phone login regression test failed');
  console.error(error);
  process.exit(1);
});
