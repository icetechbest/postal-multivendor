import database from '../src/config/database';
import { seedDemoData } from '../src/services/seed';

const main = async () => {
  await database.connect();
  const seeded = await seedDemoData();
  console.log(`Seed complete: restaurant=${seeded.restaurant._id.toString()} food=${seeded.food._id.toString()}`);
  console.log('Demo users: customer@postal.local, rider@postal.local, vendor@postal.local');
  await database.disconnect();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
