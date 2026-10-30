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

  const placed = await request(
    `mutation PlaceOrder($input: [OrderInput!]!) {
      placeOrder(
        restaurant: "${restaurantId}", orderInput: $input, paymentMethod: "COD",
        tipping: 1, taxationAmount: 999, deliveryCharges: 999,
        address: { label: "Home", deliveryAddress: "Smoke address", latitude: "40.75", longitude: "-73.98" },
        orderDate: "${new Date().toISOString()}", isPickedUp: false, instructions: "Integration smoke"
      ) { _id orderId orderStatus paymentStatus total orderAmount }
    }`,
    { input: [{ food: food._id, variation: variation._id, quantity: 2, addons: [] }] },
    login.login.token
  );
  const order = placed.placeOrder;
  assert(order.paymentStatus === 'PENDING', 'Order payment status was not persisted');
  assert(order.orderAmount === variation.price * 2, 'Server did not recalculate item prices');

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

  const admin = await request(
    `mutation AdminLogin { login(email: "admin@postal.local", password: "${password}", type: "email") { token } }`
  );
  await request(
    `mutation AcceptOrder($id: ID!) { updateOrderStatus(id: $id, status: "ACCEPTED") { _id orderStatus } }`,
    { id: order._id },
    admin.login.token
  );
  const subscriptionOrder = await update;
  assert(subscriptionOrder._id === order._id, 'Subscription returned the wrong order');
  unsubscribe?.();
  await wsClient.dispose();

  const aborted = await request(
    `mutation AbortOrder($id: String!) { abortOrder(id: $id, reason: "Smoke test cleanup") { _id orderStatus } }`,
    { id: order._id },
    login.login.token
  );
  assert(aborted.abortOrder.orderStatus === 'CANCELLED', 'Order was not cancelled');

  console.log('Smoke flow passed: register → login → configuration → zones → nearby restaurants → restaurant → place order → WebSocket update → abort order.');
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
