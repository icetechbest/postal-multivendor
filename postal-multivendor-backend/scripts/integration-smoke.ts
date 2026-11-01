import { spawn, ChildProcess } from 'child_process';
import { once } from 'events';
import { resolve } from 'path';

const port = 4107;
const baseUrl = `http://127.0.0.1:${port}`;
const password = 'SmokeTest-Password-123!';
let server: ChildProcess | undefined;
let database: any;
let mongod: any;
let logs = '';

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};

const request = async (query: string, variables: Record<string, unknown> = {}, token?: string) => {
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (!response.ok || body.errors?.length) {
    throw new Error(`GraphQL request failed: ${JSON.stringify(body.errors || body)}`);
  }
  return body.data;
};

const requestError = async (query: string, variables: Record<string, unknown> = {}, token?: string): Promise<string> => {
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  return body.errors?.[0]?.message || '';
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error('Server did not become healthy');
};

const stopServer = async () => {
  if (!server || server.exitCode !== null || server.signalCode) return;
  const exited = once(server, 'exit');
  server.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise<void>((resolveTimeout) => setTimeout(() => {
      server?.kill('SIGKILL');
      resolveTimeout();
    }, 5000)),
  ]);
};

const main = async (): Promise<void> => {
try {
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_ENABLED = 'false';
  process.env.TWILIO_ENABLED = 'false';
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('postal-smoke');
  process.env.MONGODB_DB_NAME = 'postal-smoke';
  process.env.JWT_SECRET = 'smoke-only-access-secret-not-for-production';
  process.env.JWT_REFRESH_SECRET = 'smoke-only-refresh-secret-not-for-production';
  process.env.ADMIN_PASSWORD = password;

  const mongoose = (await import('mongoose')).default;
  database = mongoose;
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'postal-smoke' });
  const { seedDemoData } = await import('../src/services/seed');
  await seedDemoData();
  await mongoose.disconnect();
  database = undefined;

  server = spawn(process.execPath, [resolve(process.cwd(), 'dist/index.js')], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (chunk) => { logs += chunk.toString(); });
  server.stderr?.on('data', (chunk) => { logs += chunk.toString(); });
  server.on('exit', (code) => {
    if (code && code !== 0) logs += `\nServer exited with code ${code}\n`;
  });
  await waitForServer();

  const registration = await request(
    `mutation Register($input: UserInput!) {
      createUser(userInput: $input) { userId token refreshToken email }
    }`,
    { input: { name: 'Smoke Customer', email: 'smoke@postal.local', password, phone: '+15555550199', emailIsVerified: true } }
  );
  const userToken = registration.createUser.token;
  const userId = registration.createUser.userId;
  assert(userToken && userId, 'Registration did not return credentials');

  const login = await request(
    `mutation Login($email: String, $password: String) {
      login(email: $email, password: $password, type: "email") { token userId }
    }`,
    { email: 'smoke@postal.local', password }
  );
  assert(login.login.userId === userId, 'Login returned a different user');

  const configuration = await request(`query { configuration { currency deliveryRate costType } }`);
  assert(configuration.configuration, 'Configuration was not seeded');

  const zones = await request(`query { zones { _id title } }`);
  assert(zones.zones.length > 0, 'No delivery zones returned');

  const nearby = await request(
    `query Nearby($latitude: Float, $longitude: Float) {
      nearByRestaurants(latitude: $latitude, longitude: $longitude) {
        restaurants { _id name }
      }
    }`,
    { latitude: 40.75, longitude: -73.98 }
  );
  const restaurantId = nearby.nearByRestaurants.restaurants[0]?._id;
  assert(restaurantId, 'No nearby restaurant returned');

  const restaurant = await request(
    `query Restaurant($id: String) {
      restaurant(id: $id) { _id name categories { _id foods { _id title variations { _id price } } } }
    }`,
    { id: restaurantId }
  );
  const food = restaurant.restaurant.categories[0]?.foods[0];
  const variation = food?.variations[0];
  assert(food && variation, 'Restaurant menu data is incomplete');

  const placeSmokeOrder = async (note: string) => (await request(
    `mutation PlaceOrder($input: [OrderInput!]!) {
      placeOrder(
        restaurant: "${restaurantId}", orderInput: $input, paymentMethod: "COD",
        tipping: 1, taxationAmount: 999, deliveryCharges: 999,
        address: { label: "Home", deliveryAddress: "Smoke address", latitude: "40.75", longitude: "-73.98" },
        orderDate: "${new Date().toISOString()}", isPickedUp: false, instructions: "${note}"
      ) { _id orderId orderStatus paymentStatus total orderAmount }
    }`,
    { input: [{ food: food._id, variation: variation._id, quantity: 2, addons: [] }] },
    login.login.token
  )).placeOrder;
  const placed = { placeOrder: await placeSmokeOrder('Integration smoke') };
  const order = placed.placeOrder;
  assert(order.paymentStatus === 'PENDING', 'Order payment status was not persisted');
  assert(order.orderAmount === variation.price * 2, 'Server did not recalculate item prices');

  // ---- admin confirmation flow (AWAITING_ADMIN)
  assert(order.orderStatus === 'AWAITING_ADMIN', 'New orders must start in AWAITING_ADMIN');
  const admin = await request(
    `mutation AdminLogin { login(email: "admin@postal.local", password: "${password}", type: "email") { token } }`
  );
  const vendorLogin = await request(
    `mutation VendorLogin { login(email: "vendor@postal.local", password: "password123", type: "email") { token } }`
  );
  const vendorToken = vendorLogin.login.token;
  const vendorOrders = async (): Promise<any[]> =>
    (await request(`query V($r: String!) { ordersByRestIdWithoutPagination(restaurant: $r) { _id orderStatus } }`, { r: restaurantId }, vendorToken)).ordersByRestIdWithoutPagination;

  // 1) a new order is hidden from the restaurant, which also cannot touch it
  assert(!(await vendorOrders()).some((o: any) => o._id === order._id), 'Restaurant can see an order that awaits admin confirmation');
  const vendorBlocked = await requestError(`mutation U($id: ID!) { updateOrderStatus(id: $id, status: "ACCEPTED") { _id } }`, { id: order._id }, vendorToken);
  assert(vendorBlocked, 'Restaurant could change an order that awaits admin confirmation');
  const vendorBlockedAdminApi = await requestError(`mutation U($id: String!) { updateStatus(id: $id, orderStatus: "ACCEPTED") { _id } }`, { id: order._id }, vendorToken);
  assert(vendorBlockedAdminApi, 'Restaurant could change an awaiting order through updateStatus');
  const pending = await request(
    `query { pendingConfirmationCount pendingConfirmationOrders(page: 1, limit: 10) { totalCount orders { _id orderStatus user { name phone } deliveryAddress { deliveryAddress location { coordinates } } restaurant { name } items { title quantity } total paymentMethod createdAt } } }`,
    {},
    admin.login.token
  );
  const pendingOrder = pending.pendingConfirmationOrders.orders.find((o: any) => o._id === order._id);
  assert(pending.pendingConfirmationCount >= 1 && pendingOrder, 'Pending order missing from pendingConfirmationOrders');
  assert(pendingOrder.user?.name && pendingOrder.deliveryAddress?.deliveryAddress && pendingOrder.items.length, 'Pending order is missing customer details');

  // 4) only admin/staff may confirm or reject
  const confirmDenied = await requestError(`mutation C($id: String!) { adminConfirmOrder(id: $id) { _id } }`, { id: order._id }, login.login.token);
  assert(confirmDenied, 'A customer was able to confirm an order');
  const confirmDeniedVendor = await requestError(`mutation C($id: String!) { adminConfirmOrder(id: $id) { _id } }`, { id: order._id }, vendorToken);
  assert(confirmDeniedVendor, 'A restaurant owner was able to confirm an order');
  const rejectDenied = await requestError(`mutation R($id: String!) { adminRejectOrder(id: $id, reason: "x") { _id } }`, { id: order._id }, login.login.token);
  assert(rejectDenied, 'A customer was able to reject an order');

  // 2) after adminConfirmOrder the restaurant sees it
  const confirmed = await request(
    `mutation C($id: String!) { adminConfirmOrder(id: $id, note: "Called the customer") { _id orderStatus adminConfirmedAt adminNote adminConfirmedBy } }`,
    { id: order._id },
    admin.login.token
  );
  assert(confirmed.adminConfirmOrder.orderStatus === 'PENDING', 'Confirmed order must move to PENDING');
  assert(confirmed.adminConfirmOrder.adminConfirmedAt && confirmed.adminConfirmOrder.adminNote === 'Called the customer' && confirmed.adminConfirmOrder.adminConfirmedBy, 'Confirmation details were not saved');
  assert((await vendorOrders()).some((o: any) => o._id === order._id), 'Restaurant cannot see the order after admin confirmation');
  assert(((await request(`query { pendingConfirmationOrders { orders { _id } } }`, {}, admin.login.token)).pendingConfirmationOrders.orders).every((o: any) => o._id !== order._id), 'Confirmed order is still listed as pending');

  // 5) confirming twice fails with a clear message
  const confirmTwice = await requestError(`mutation C($id: String!) { adminConfirmOrder(id: $id) { _id } }`, { id: order._id }, admin.login.token);
  assert(/no longer awaiting confirmation/i.test(confirmTwice), `Second confirmation should fail clearly, got: "${confirmTwice}"`);
  // two concurrent confirmations: exactly one wins
  const racing = await placeSmokeOrder('Concurrent confirm');
  const race = await Promise.all([1, 2].map(() => requestError(`mutation C($id: String!) { adminConfirmOrder(id: $id) { _id } }`, { id: racing._id }, admin.login.token)));
  assert(race.filter((message) => message === '').length === 1, 'Exactly one of two concurrent confirmations must succeed');

  // 3) adminRejectOrder cancels the order and hides it from the restaurant
  const toReject = await placeSmokeOrder('Reject me');
  assert(toReject.orderStatus === 'AWAITING_ADMIN', 'Second order must also await confirmation');
  const rejectEmptyReason = await requestError(`mutation R($id: String!) { adminRejectOrder(id: $id, reason: "  ") { _id } }`, { id: toReject._id }, admin.login.token);
  assert(rejectEmptyReason, 'Rejecting without a reason must fail');
  const rejected = await request(
    `mutation R($id: String!) { adminRejectOrder(id: $id, reason: "Customer unreachable") { _id orderStatus reason cancelledAt } }`,
    { id: toReject._id },
    admin.login.token
  );
  assert(rejected.adminRejectOrder.orderStatus === 'CANCELLED' && rejected.adminRejectOrder.reason === 'Customer unreachable' && rejected.adminRejectOrder.cancelledAt, 'Rejected order was not cancelled with its reason');
  assert(!(await vendorOrders()).some((o: any) => o._id === toReject._id), 'Restaurant can see an order that admin rejected');
  const rejectTwice = await requestError(`mutation R($id: String!) { adminRejectOrder(id: $id, reason: "again") { _id } }`, { id: toReject._id }, admin.login.token);
  assert(/no longer awaiting confirmation/i.test(rejectTwice), 'Rejecting an already handled order must fail clearly');

  const { createClient } = await import('graphql-ws');
  const WebSocket = (await import('ws')).default;
  const wsClient = createClient({
    url: `ws://127.0.0.1:${port}/graphql`,
    webSocketImpl: WebSocket,
    connectionParams: { authorization: `Bearer ${login.login.token}` },
  });
  let unsubscribe: (() => void) | undefined;
  const update = new Promise<any>((resolveUpdate, rejectUpdate) => {
    const timeout = setTimeout(() => rejectUpdate(new Error('Timed out waiting for order subscription update')), 10000);
    unsubscribe = wsClient.subscribe(
      { query: `subscription OrderUpdate($id: String!) { subscriptionOrder(id: $id) { _id orderStatus paymentStatus } }`, variables: { id: order._id } },
      {
        next: (payload: any) => {
          if (payload.errors?.length) {
            clearTimeout(timeout);
            rejectUpdate(new Error(JSON.stringify(payload.errors)));
          } else if (payload.data?.subscriptionOrder?.orderStatus === 'ACCEPTED') {
            clearTimeout(timeout);
            resolveUpdate(payload.data.subscriptionOrder);
          }
        },
        error: (error) => {
          clearTimeout(timeout);
          rejectUpdate(error);
        },
        complete: () => undefined,
      }
    );
  });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));

  await request(
    `mutation AcceptOrder($id: ID!) { updateOrderStatus(id: $id, status: "ACCEPTED") { _id orderStatus } }`,
    { id: order._id },
    admin.login.token
  );
  const subscriptionOrder = await update;
  assert(subscriptionOrder._id === order._id, 'Subscription returned the wrong order');
  unsubscribe?.();
  await wsClient.dispose();

  // ---- admin dashboard contract
  const adminToken = admin.login.token;
  const sentry = await request(
    `mutation Sentry($i: SentryConfigurationInput!) { saveSentryConfiguration(configurationInput: $i) { dashboardSentryUrl } }`,
    { i: { dashboardSentryUrl: 'https://example.invalid/dsn' } },
    adminToken
  );
  assert(sentry.saveSentryConfiguration.dashboardSentryUrl === 'https://example.invalid/dsn', 'Config group did not save');
  const emailCfg = await request(
    `mutation Email($i: EmailConfigurationInput!) { saveEmailConfiguration(configurationInput: $i) { emailName dashboardSentryUrl } }`,
    { i: { emailName: 'Smoke' } },
    adminToken
  );
  assert(emailCfg.saveEmailConfiguration.dashboardSentryUrl === 'https://example.invalid/dsn', 'Config mutation overwrote unrelated fields');

  const vendor = await request(
    `mutation V($i: VendorInput) { createVendor(vendorInput: $i) { _id email } }`,
    { i: { email: 'smoke-vendor@postal.local', name: 'Smoke Vendor', password } },
    adminToken
  );
  const fetchedVendor = await request(`query V($id: String!) { getVendor(id: $id) { _id email } }`, { id: vendor.createVendor._id }, adminToken);
  assert(fetchedVendor.getVendor.email === 'smoke-vendor@postal.local', 'Vendor round trip failed');
  const vendorList = await request(`query { vendors { _id } }`, {}, adminToken);
  assert(vendorList.vendors.some((v: any) => v._id === vendor.createVendor._id), 'Vendor missing from list');

  const staff = await request(
    `mutation S($i: StaffInput!) { createStaff(staffInput: $i) { _id email } }`,
    { i: { name: 'Smoke Staff', email: 'smoke-staff@postal.local', password, permissions: ['Dashboard'] } },
    adminToken
  );
  const staffList = await request(`query { staffs { _id } }`, {}, adminToken);
  assert(staffList.staffs.some((x: any) => x._id === staff.createStaff._id), 'Staff missing from list');

  const banner = await request(`mutation B($i: BannerInput!) { createBanner(bannerInput: $i) { _id title } }`, { i: { title: 'Smoke banner' } }, adminToken);
  const cuisine = await request(`mutation C($i: CuisineInput!) { createCuisine(cuisineInput: $i) { _id name } }`, { i: { name: 'Smoke cuisine' } }, adminToken);
  assert(banner.createBanner._id && cuisine.createCuisine._id, 'Banner/cuisine creation failed');

  const dashboard = await request(`query { getDashboardUsers { usersCount vendorsCount restaurantsCount ridersCount } getDashboardOrdersByType { label value } }`, {}, adminToken);
  assert(dashboard.getDashboardUsers.vendorsCount >= 1, 'Dashboard counts are wrong');

  // Non-admin callers must be rejected from super-admin mutations.
  const denied = await requestError(
    `mutation Sentry($i: SentryConfigurationInput!) { saveSentryConfiguration(configurationInput: $i) { dashboardSentryUrl } }`,
    { i: { dashboardSentryUrl: 'https://evil.invalid' } },
    login.login.token
  );
  assert(denied, 'A regular user was able to save configuration');
  const deniedVendor = await requestError(`mutation V($i: VendorInput) { createVendor(vendorInput: $i) { _id } }`, { i: { email: 'x@postal.local', password } }, login.login.token);
  assert(deniedVendor, 'A regular user was able to create a vendor');

  await request(`mutation D($id: String!) { deleteStaff(id: $id) { _id } }`, { id: staff.createStaff._id }, adminToken);
  await request(`mutation D($id: String!) { deleteVendor(id: $id) }`, { id: vendor.createVendor._id }, adminToken);

  const aborted = await request(
    `mutation AbortOrder($id: String!) { abortOrder(id: $id, reason: "Smoke test cleanup") { _id orderStatus } }`,
    { id: order._id },
    login.login.token
  );
  assert(aborted.abortOrder.orderStatus === 'CANCELLED', 'Order was not cancelled');

  console.log('Smoke flow passed: register → login → configuration → zones → nearby restaurants → restaurant → place order (AWAITING_ADMIN, hidden from restaurant) → admin confirm/reject → WebSocket update → abort order; admin config/vendor/staff/banner/cuisine/dashboard checks.');
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  if (logs) console.error(`\nServer logs:\n${logs}`);
  process.exitCode = 1;
} finally {
  await stopServer();
  if (database) await database.disconnect();
  if (mongod) await mongod.stop();
}
};

void main();
