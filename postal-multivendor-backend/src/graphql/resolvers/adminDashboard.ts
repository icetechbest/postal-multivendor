import { Types } from 'mongoose';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { Review } from '../../models/Review';
import { User } from '../../models/User';
import { AuthContext } from '../../middleware/auth';
import { AuthorizationError } from '../../utils/errors';
import { idOf } from './appHelpers';
import { assertObjectId, dateRange, requireDashboard, requirePlatformReader, round2, yearRange } from './adminHelpers';

const DONE = ['DELIVERED', 'COMPLETED'];
const oid = (value: string, label: string) => new Types.ObjectId(assertObjectId(value, label));
const months = <T>(rows: Array<{ _id: number } & Record<string, any>>, pick: (row: any) => T, empty: T): T[] =>
  Array.from({ length: 12 }, (_, i) => {
    const row = rows.find((r) => r._id === i + 1);
    return row ? pick(row) : empty;
  });
const pct = (current: number, previous: number): number => (previous ? round2(((current - previous) / previous) * 100) : current ? 100 : 0);
const isDelivery = { $or: [{ rider: { $exists: true, $ne: null } }, { deliveryCharges: { $gt: 0 } }] };

const assertStore = async (id: string, context: AuthContext) => {
  const store = await Restaurant.findById(assertObjectId(id, 'restaurant')).select('owner');
  if (!store) return;
  if (context.user!.role === 'VENDOR' && idOf(store.owner) !== context.user!.userId) throw new AuthorizationError();
};

const assertVendor = (vendorId: string, context: AuthContext) => {
  assertObjectId(vendorId, 'vendor');
  if (context.user!.role === 'VENDOR' && context.user!.userId !== vendorId) throw new AuthorizationError();
};

const countByMonth = (Model: any, match: Record<string, any>, year: number) =>
  Model.aggregate([{ $match: { ...match, createdAt: yearRange(year) } }, { $group: { _id: { $month: '$createdAt' }, n: { $sum: 1 } } }]);

const vendorStores = async (vendorId: string) => (await Restaurant.find({ owner: oid(vendorId, 'vendor') }).select('_id name')).map((r) => r);

export const adminDashboardResolvers = {
  Query: {
    getDashboardUsers: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requirePlatformReader(context);
      const [usersCount, vendorsCount, restaurantsCount, ridersCount] = await Promise.all([
        User.countDocuments({ role: 'USER' }),
        User.countDocuments({ role: 'VENDOR' }),
        Restaurant.countDocuments({}),
        User.countDocuments({ role: 'RIDER', isActive: true }),
      ]);
      return { usersCount, vendorsCount, restaurantsCount, ridersCount };
    },
    getDashboardUsersByYear: async (_parent: unknown, { year }: { year: number }, context: AuthContext) => {
      requirePlatformReader(context);
      const [users, vendors, restaurants, riders, prevUsers, prevVendors, prevRestaurants, prevRiders] = await Promise.all([
        countByMonth(User, { role: 'USER' }, year),
        countByMonth(User, { role: 'VENDOR' }, year),
        countByMonth(Restaurant, {}, year),
        countByMonth(User, { role: 'RIDER' }, year),
        User.countDocuments({ role: 'USER', createdAt: yearRange(year - 1) }),
        User.countDocuments({ role: 'VENDOR', createdAt: yearRange(year - 1) }),
        Restaurant.countDocuments({ createdAt: yearRange(year - 1) }),
        User.countDocuments({ role: 'RIDER', createdAt: yearRange(year - 1) }),
      ]);
      const series = (rows: any[]) => months(rows, (r) => r.n as number, 0);
      const total = (rows: number[]) => rows.reduce((a, b) => a + b, 0);
      const [u, v, r, d] = [series(users), series(vendors), series(restaurants), series(riders)];
      return {
        usersCount: u,
        vendorsCount: v,
        restaurantsCount: r,
        ridersCount: d,
        percentageChange: { usersPercent: pct(total(u), prevUsers), vendorsPercent: pct(total(v), prevVendors), restaurantsPercent: pct(total(r), prevRestaurants), ridersPercent: pct(total(d), prevRiders) },
      };
    },
    getDashboardOrdersByType: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requirePlatformReader(context);
      const [delivery, pickup] = await Promise.all([Order.countDocuments({ orderStatus: { $in: DONE }, ...isDelivery }), Order.countDocuments({ orderStatus: { $in: DONE }, rider: { $in: [null, undefined] }, deliveryCharges: { $lte: 0 } })]);
      return [{ label: 'Delivery', value: delivery }, { label: 'Pickup', value: pickup }];
    },
    getDashboardSalesByType: async (_parent: unknown, _args: unknown, context: AuthContext) => {
      requirePlatformReader(context);
      const sum = async (filter: Record<string, any>) => round2((await Order.aggregate([{ $match: { orderStatus: { $in: DONE }, ...filter } }, { $group: { _id: null, t: { $sum: '$orderAmount' } } }]))[0]?.t || 0);
      const [delivery, pickup] = await Promise.all([sum(isDelivery), sum({ rider: { $in: [null, undefined] }, deliveryCharges: { $lte: 0 } })]);
      return [{ label: 'Delivery', value: delivery }, { label: 'Pickup', value: pickup }];
    },

    getRestaurantDashboardOrdersSalesStats: async (_parent: unknown, args: any, context: AuthContext) => {
      requireDashboard(context);
      await assertStore(args.restaurant, context);
      const range = dateRange(args.dateKeyword, args.starting_date, args.ending_date);
      const [row] = await Order.aggregate([
        { $match: { restaurant: oid(args.restaurant, 'restaurant'), orderStatus: { $in: DONE }, ...(range ? { createdAt: range } : {}) } },
        { $group: { _id: null, totalOrders: { $sum: 1 }, totalSales: { $sum: '$orderAmount' }, cod: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'COD'] }, 1, 0] } }, card: { $sum: { $cond: [{ $ne: ['$paymentMethod', 'COD'] }, 1, 0] } } } },
      ]);
      return { totalOrders: row?.totalOrders || 0, totalSales: round2(row?.totalSales || 0), totalCODOrders: row?.cod || 0, totalCardOrders: row?.card || 0 };
    },
    getRestaurantDashboardSalesOrderCountDetailsByYear: async (_parent: unknown, args: { restaurant: string; year: number }, context: AuthContext) => {
      requireDashboard(context);
      await assertStore(args.restaurant, context);
      const rows = await Order.aggregate([
        { $match: { restaurant: oid(args.restaurant, 'restaurant'), orderStatus: { $in: DONE }, createdAt: yearRange(args.year) } },
        { $group: { _id: { $month: '$createdAt' }, sales: { $sum: '$orderAmount' }, n: { $sum: 1 } } },
      ]);
      return { salesAmount: months(rows, (r) => round2(r.sales), 0), ordersCount: months(rows, (r) => r.n as number, 0) };
    },
    getDashboardOrderSalesDetailsByPaymentMethod: async (_parent: unknown, args: any, context: AuthContext) => {
      requireDashboard(context);
      await assertStore(args.restaurant, context);
      const range = dateRange(null, args.starting_date, args.ending_date);
      const rows = await Order.aggregate([
        { $match: { restaurant: oid(args.restaurant, 'restaurant'), orderStatus: { $in: DONE }, ...(range ? { createdAt: range } : {}) } },
        { $group: { _id: { $cond: [{ $eq: ['$paymentMethod', 'COD'] }, 'COD', 'CARD'] }, orders: { $sum: 1 }, sales: { $sum: '$orderAmount' }, delivery: { $sum: '$deliveryCharges' } } },
      ]);
      const entry = (type: string, keys: string[]) => {
        const picked = rows.filter((r) => keys.includes(r._id));
        const sales = picked.reduce((a, r) => a + r.sales, 0);
        const delivery = picked.reduce((a, r) => a + r.delivery, 0);
        return { _type: type, data: { total_orders: picked.reduce((a, r) => a + r.orders, 0), total_sales: round2(sales + delivery), total_sales_without_delivery: round2(sales), total_delivery_fee: round2(delivery) } };
      };
      return { all: entry('all', ['COD', 'CARD']), cod: entry('cod', ['COD']), card: entry('card', ['CARD']) };
    },

    getStoreDetailsByVendorId: async (_parent: unknown, args: any, context: AuthContext) => {
      requireDashboard(context);
      assertVendor(args.id, context);
      const stores = await vendorStores(args.id);
      const range = dateRange(args.dateKeyword, args.starting_date, args.ending_date);
      const rows = await Order.aggregate([
        { $match: { restaurant: { $in: stores.map((s) => s._id) }, orderStatus: { $in: DONE }, ...(range ? { createdAt: range } : {}) } },
        { $group: { _id: '$restaurant', totalOrders: { $sum: 1 }, totalSales: { $sum: '$orderAmount' }, deliveryCount: { $sum: { $cond: [{ $or: [{ $gt: ['$deliveryCharges', 0] }, { $ne: [{ $ifNull: ['$rider', null] }, null] }] }, 1, 0] } } } },
      ]);
      return stores.map((s) => {
        const r = rows.find((x) => idOf(x._id) === idOf(s._id));
        return { _id: s._id, restaurantName: s.name, totalOrders: r?.totalOrders || 0, totalSales: round2(r?.totalSales || 0), deliveryCount: r?.deliveryCount || 0, pickUpCount: (r?.totalOrders || 0) - (r?.deliveryCount || 0) };
      });
    },
    getVendorDashboardStatsCardDetails: async (_parent: unknown, args: any, context: AuthContext) => {
      requireDashboard(context);
      assertVendor(args.vendorId, context);
      const stores = await vendorStores(args.vendorId);
      const range = dateRange(args.dateKeyword, args.starting_date, args.ending_date);
      const [row] = await Order.aggregate([
        { $match: { restaurant: { $in: stores.map((s) => s._id) }, orderStatus: { $in: DONE }, ...(range ? { createdAt: range } : {}) } },
        { $group: { _id: null, totalOrders: { $sum: 1 }, totalSales: { $sum: '$orderAmount' }, totalDeliveries: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$rider', null] }, null] }, 1, 0] } } } },
      ]);
      return { totalRestaurants: stores.length, totalOrders: row?.totalOrders || 0, totalSales: round2(row?.totalSales || 0), totalDeliveries: row?.totalDeliveries || 0 };
    },
    getVendorDashboardGrowthDetailsByYear: async (_parent: unknown, args: { vendorId: string; year: number }, context: AuthContext) => {
      requireDashboard(context);
      assertVendor(args.vendorId, context);
      const stores = await vendorStores(args.vendorId);
      const ids = stores.map((s) => s._id);
      const [orders, restaurants] = await Promise.all([
        Order.aggregate([
          { $match: { restaurant: { $in: ids }, orderStatus: { $in: DONE }, createdAt: yearRange(args.year) } },
          { $group: { _id: { $month: '$createdAt' }, n: { $sum: 1 }, sales: { $sum: '$orderAmount' } } },
        ]),
        countByMonth(Restaurant, { owner: oid(args.vendorId, 'vendor') }, args.year),
      ]);
      return { totalRestaurants: months(restaurants, (r) => r.n as number, 0), totalOrders: months(orders, (r) => r.n as number, 0), totalSales: months(orders, (r) => round2(r.sales), 0) };
    },
    getLiveMonitorData: async (_parent: unknown, args: any, context: AuthContext) => {
      requireDashboard(context);
      assertVendor(args.id, context);
      const stores = await vendorStores(args.id);
      const ids = stores.map((s) => s._id);
      const range = dateRange(args.dateKeyword, args.starting_date, args.ending_date);
      const base = { restaurant: { $in: ids }, ...(range ? { createdAt: range } : {}) };
      const [online, cancelled, delayed, ratings] = await Promise.all([
        Restaurant.countDocuments({ _id: { $in: ids }, isActive: true, isAvailable: true }),
        Order.countDocuments({ ...base, orderStatus: 'CANCELLED' }),
        Order.countDocuments({ ...base, orderStatus: { $in: ['PENDING', 'ACCEPTED'] }, createdAt: { $lte: new Date(Date.now() - 45 * 60_000), ...(range?.$gte ? { $gte: range.$gte } : {}) } }),
        Review.aggregate([{ $match: { restaurant: { $in: ids }, isActive: true } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]),
      ]);
      return { online_stores: online, cancelled_orders: cancelled, delayed_orders: delayed, ratings: round2(ratings[0]?.avg || 0) };
    },
  },
};
