/**
 * Regression test for the loyalty coins.
 *
 * Verifies that:
 *  - coins are calculated from the admin-controlled rate (and honour the on/off switch),
 *  - they are credited exactly once when an order is delivered, however often it is re-saved,
 *  - undelivered orders earn nothing.
 *
 * Run with: npm run test:coins
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
};

const main = async (): Promise<void> => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('postal-coins-test');
  process.env.MONGODB_DB_NAME = 'postal-coins-test';
  process.env.MONGODB_USER = '';
  process.env.MONGODB_PASSWORD = '';
  process.env.NODE_ENV = 'test';

  const database = (await import('../src/config/database')).default;
  const { User } = await import('../src/models/User');
  const { Order } = await import('../src/models/Order');
  const { Configuration } = await import('../src/models/Configuration');
  const { CoinTransaction } = await import('../src/models/CoinTransaction');
  const { Restaurant } = await import('../src/models/Restaurant');
  const { calculateCoins, awardCoinsForOrder, deductCoins, refundCoinsForOrder } = await import('../src/services/coins');

  await database.connect();

  // Pure calculation.
  const settings = { enabled: true, perCurrencyUnit: 0.1, coinValue: 0.5 };
  assert(calculateCoins(100, settings) === 10, '100 at 0.1 => 10 coins');
  assert(calculateCoins(99, settings) === 9, 'coins are whole numbers (floor)');
  assert(calculateCoins(30, settings) === 3, 'float error must not cost a coin');
  assert(calculateCoins(100, { ...settings, enabled: false }) === 0, 'disabled => 0 coins');
  assert(calculateCoins(0, settings) === 0, 'empty order => 0 coins');

  const customer = await User.create({ name: 'Customer', phone: '+201000000001', role: 'USER' });
  const restaurant = await Restaurant.collection.insertOne({ name: 'R' });
  const makeOrder = (orderId: string, status: string) =>
    Order.collection.insertOne({
      orderId,
      restaurant: restaurant.insertedId,
      user: customer._id,
      items: [],
      orderAmount: 250,
      total: 270,
      paymentMethod: 'COD',
      orderStatus: status,
      coinsEarned: 0,
    });

  await Configuration.findOneAndUpdate(
    { key: 'default' },
    { $set: { coinsEnabled: true, coinsPerCurrencyUnit: 0.2, coinValue: 1 } },
    { upsert: true }
  );

  // Not delivered yet: nothing earned.
  const pending = await makeOrder('T-1', 'PICKED');
  assert((await awardCoinsForOrder(pending.insertedId)) === 0, 'undelivered order earns nothing');

  // Delivered: 250 * 0.2 = 50 coins, once.
  const delivered = await makeOrder('T-2', 'DELIVERED');
  assert((await awardCoinsForOrder(delivered.insertedId)) === 50, 'delivered order earns 50 coins');
  assert((await awardCoinsForOrder(delivered.insertedId)) === 0, 'second award is a no-op');
  const after = await User.findById(customer._id);
  assert(after?.coins === 50, `balance is 50 (got ${after?.coins})`);
  assert((await CoinTransaction.countDocuments({ order: delivered.insertedId })) === 1, 'one ledger row');
  assert((await Order.findById(delivered.insertedId))?.coinsEarned === 50, 'order records coinsEarned');

  // Admin turns coins off: later orders earn nothing.
  await Configuration.updateOne({ key: 'default' }, { $set: { coinsEnabled: false } });
  const off = await makeOrder('T-3', 'DELIVERED');
  assert((await awardCoinsForOrder(off.insertedId)) === 0, 'disabled coins earn nothing');

  // Spending: deduct is atomic and never goes negative; a cancelled order gives the coins back once.
  assert(!(await deductCoins(customer._id, 51)), 'cannot spend more than the balance');
  assert((await User.findById(customer._id))?.coins === 50, 'failed deduction leaves the balance alone');
  assert(await deductCoins(customer._id, 20), 'can spend 20 of 50');
  const paid = await makeOrder('T-4', 'CANCELLED');
  await Order.updateOne({ _id: paid.insertedId }, { $set: { coinsUsed: 20 } });
  assert((await refundCoinsForOrder(paid.insertedId)) === 20, 'cancelled order refunds its 20 coins');
  assert((await refundCoinsForOrder(paid.insertedId)) === 0, 'refund happens only once');
  assert((await User.findById(customer._id))?.coins === 50, 'balance restored to 50');

  console.log('coins: all checks passed');
  await database.disconnect();
  await mongod.stop();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
