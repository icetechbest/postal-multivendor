const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { resolvers } = require('../dist/graphql/resolvers');
const { Order } = require('../dist/models/Order');
const { Restaurant } = require('../dist/models/Restaurant');
const { User } = require('../dist/models/User');
const { WithdrawRequest } = require('../dist/models/WithdrawRequest');

const oid = () => new mongoose.Types.ObjectId().toHexString();

/** Minimal thenable query stub so `Model.findById(...).populate(...).select(...)` works. */
const chain = (value) => {
  const promise = Promise.resolve(value);
  const query = {
    populate: () => query,
    sort: () => query,
    limit: () => query,
    select: () => query,
    then: (resolve, reject) => promise.then(resolve, reject),
    catch: (reject) => promise.catch(reject),
  };
  return query;
};

const fakeOrder = (overrides = {}) => ({
  _id: oid(),
  orderId: 'ORD-1',
  orderStatus: 'PENDING',
  paymentMethod: 'COD',
  total: 100,
  orderAmount: 100,
  deliveryCharges: 10,
  tipping: 5,
  isActive: true,
  isRinged: true,
  isRiderRinged: true,
  save: async function save() {
    return this;
  },
  ...overrides,
});

/** Runs `fn` with temporary static-method stubs, restoring the originals afterwards. */
const withStubs = async (stubs, fn) => {
  const originals = stubs.map(({ target, method }) => [target, method, target[method]]);
  for (const { target, method, value } of stubs) target[method] = value;
  try {
    return await fn();
  } finally {
    for (const [target, method, original] of originals) target[method] = original;
  }
};

const context = (userId, role) => ({ user: { userId, role, email: 'test@example.com' } });

// ------------------------------------------------------------------ acceptOrder
test('acceptOrder accepts a pending order for its own restaurant', async () => {
  const vendorId = oid();
  const order = fakeOrder({ restaurant: oid() });
  const restaurant = { _id: order.restaurant, owner: vendorId, isAvailable: true };

  await withStubs(
    [
      { target: Order, method: 'findById', value: () => chain(order) },
      { target: Restaurant, method: 'findById', value: () => chain(restaurant) },
    ],
    async () => {
      const result = await resolvers.Mutation.acceptOrder(null, { _id: order._id, time: '25' }, context(vendorId, 'VENDOR'));
      assert.equal(result.orderStatus, 'ACCEPTED');
      assert.equal(order.preparationTime, 25);
      assert.ok(order.acceptedAt instanceof Date);
    }
  );
});

test('acceptOrder rejects a non-vendor role', async () => {
  await assert.rejects(
    () => resolvers.Mutation.acceptOrder(null, { _id: oid(), time: '10' }, context(oid(), 'RIDER')),
    (error) => error.statusCode === 403
  );
});

test('acceptOrder rejects a vendor that does not own the restaurant', async () => {
  const order = fakeOrder({ restaurant: oid() });
  const restaurant = { _id: order.restaurant, owner: oid() };

  await withStubs(
    [
      { target: Order, method: 'findById', value: () => chain(order) },
      { target: Restaurant, method: 'findById', value: () => chain(restaurant) },
    ],
    async () => {
      await assert.rejects(
        () => resolvers.Mutation.acceptOrder(null, { _id: order._id, time: '10' }, context(oid(), 'VENDOR')),
        (error) => error.statusCode === 403
      );
    }
  );
});

// ------------------------------------------------------------- toggleAvailability
test('toggleAvailability flips the flag for the owning vendor', async () => {
  const vendorId = oid();
  const restaurant = {
    _id: oid(),
    owner: vendorId,
    isAvailable: true,
    save: async function save() {
      return this;
    },
  };

  await withStubs([{ target: Restaurant, method: 'findById', value: () => chain(restaurant) }], async () => {
    const result = await resolvers.Mutation.toggleAvailability(null, { restaurantId: restaurant._id }, context(vendorId, 'VENDOR'));
    assert.equal(result.isAvailable, false);
  });
});

test('toggleAvailability rejects a foreign vendor', async () => {
  const restaurant = { _id: oid(), owner: oid(), isAvailable: true, save: async () => {} };

  await withStubs([{ target: Restaurant, method: 'findById', value: () => chain(restaurant) }], async () => {
    await assert.rejects(
      () => resolvers.Mutation.toggleAvailability(null, { restaurantId: restaurant._id }, context(oid(), 'VENDOR')),
      (error) => error.statusCode === 403
    );
  });
});

// -------------------------------------------------------------------- assignOrder
test('assignOrder lets a rider self-assign an unassigned order', async () => {
  const riderId = oid();
  const order = fakeOrder({ orderStatus: 'PENDING', restaurant: oid() });

  await withStubs(
    [
      { target: Order, method: 'findById', value: () => chain(order) },
      { target: User, method: 'findById', value: () => chain({ _id: riderId, zone: null }) },
      { target: Restaurant, method: 'findById', value: () => chain({ _id: order.restaurant, zone: null }) },
    ],
    async () => {
      const result = await resolvers.Mutation.assignOrder(null, { id: order._id }, context(riderId, 'RIDER'));
      assert.equal(result.orderStatus, 'ASSIGNED');
      assert.equal(String(order.rider), riderId);
      assert.ok(order.riderAssignedAt instanceof Date);
    }
  );
});

test('assignOrder rejects non-rider roles', async () => {
  await assert.rejects(
    () => resolvers.Mutation.assignOrder(null, { id: oid() }, context(oid(), 'VENDOR')),
    (error) => error.statusCode === 403
  );
});

test('assignOrder rejects an order already assigned to another rider', async () => {
  const order = fakeOrder({ orderStatus: 'ASSIGNED', rider: oid(), restaurant: oid() });

  await withStubs([{ target: Order, method: 'findById', value: () => chain(order) }], async () => {
    await assert.rejects(
      () => resolvers.Mutation.assignOrder(null, { id: order._id }, context(oid(), 'RIDER')),
      (error) => error.statusCode === 403
    );
  });
});

// --------------------------------------------------------- updateOrderStatusRider
test('updateOrderStatusRider rejects an order assigned to a different rider', async () => {
  const order = fakeOrder({ orderStatus: 'ASSIGNED', rider: oid(), restaurant: oid() });

  await withStubs([{ target: Order, method: 'findById', value: () => chain(order) }], async () => {
    await assert.rejects(
      () => resolvers.Mutation.updateOrderStatusRider(null, { id: order._id, status: 'PICKED' }, context(oid(), 'RIDER')),
      (error) => error.statusCode === 403
    );
  });
});

test('updateOrderStatusRider moves an assigned order to PICKED', async () => {
  const riderId = oid();
  const order = fakeOrder({ orderStatus: 'ASSIGNED', rider: riderId, restaurant: oid() });

  await withStubs([{ target: Order, method: 'findById', value: () => chain(order) }], async () => {
    const result = await resolvers.Mutation.updateOrderStatusRider(null, { id: order._id, status: 'PICKED' }, context(riderId, 'RIDER'));
    assert.equal(result.orderStatus, 'PICKED');
    assert.equal(order.isPickedUp, true);
  });
});

// --------------------------------------------------------------- updateWorkSchedule
test('updateWorkSchedule persists the schedule for the rider themselves', async () => {
  const riderId = oid();
  const rider = {
    _id: riderId,
    save: async function save() {
      return this;
    },
  };

  await withStubs([{ target: User, method: 'findById', value: () => chain(rider) }], async () => {
    const result = await resolvers.Mutation.updateWorkSchedule(
      null,
      { riderId, timeZone: 'Asia/Riyadh', workSchedule: [{ day: 'MONDAY', enabled: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }] },
      context(riderId, 'RIDER')
    );
    assert.equal(result.timeZone, 'Asia/Riyadh');
    assert.equal(result.workSchedule[0].day, 'MONDAY');
    assert.equal(result.workSchedule[0].slots[0].startTime, '09:00');
  });
});

test('updateWorkSchedule rejects a rider editing another rider', async () => {
  await assert.rejects(
    () => resolvers.Mutation.updateWorkSchedule(null, { riderId: oid(), timeZone: 'UTC', workSchedule: [] }, context(oid(), 'RIDER')),
    (error) => error.statusCode === 403
  );
});

// ------------------------------------------------------------------ list queries
test('restaurantOrders only queries restaurants owned by the vendor', async () => {
  const vendorId = oid();
  const storeId = oid();
  let captured;

  await withStubs(
    [
      { target: Restaurant, method: 'find', value: () => chain([{ _id: storeId }]) },
      {
        target: Order,
        method: 'find',
        value: (filter) => {
          captured = filter;
          return chain([]);
        },
      },
    ],
    async () => {
      const result = await resolvers.Query.restaurantOrders(null, {}, context(vendorId, 'VENDOR'));
      assert.deepEqual(result, []);
      assert.equal(String(captured.restaurant.$in[0]), storeId);
    }
  );
});

test('riderOrders only queries orders assigned to the rider', async () => {
  const riderId = oid();
  let captured;

  await withStubs(
    [
      {
        target: Order,
        method: 'find',
        value: (filter) => {
          captured = filter;
          return chain([]);
        },
      },
    ],
    async () => {
      await resolvers.Query.riderOrders(null, {}, context(riderId, 'RIDER'));
      assert.equal(String(captured.rider), riderId);
    }
  );
});

// ------------------------------------------------------- current withdraw request
test('storeCurrentWithdrawRequest rejects a store the vendor does not own', async () => {
  const restaurant = { _id: oid(), owner: oid() };

  await withStubs([{ target: Restaurant, method: 'findById', value: () => chain(restaurant) }], async () => {
    await assert.rejects(
      () => resolvers.Query.storeCurrentWithdrawRequest(null, { storeId: restaurant._id }, context(oid(), 'VENDOR')),
      (error) => error.statusCode === 403
    );
  });
});

test('riderCurrentWithdrawRequest is scoped to the authenticated rider', async () => {
  const riderId = oid();
  let captured;

  await withStubs(
    [
      {
        target: WithdrawRequest,
        method: 'findOne',
        value: (filter) => {
          captured = filter;
          return chain(null);
        },
      },
    ],
    async () => {
      await resolvers.Query.riderCurrentWithdrawRequest(null, {}, context(riderId, 'RIDER'));
      assert.equal(String(captured.rider), riderId);
      assert.equal(captured.userType, 'RIDER');
    }
  );
});
