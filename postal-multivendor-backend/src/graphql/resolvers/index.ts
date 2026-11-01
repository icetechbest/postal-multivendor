import { GraphQLScalarType, Kind } from 'graphql';
import { accountResolvers } from './account';
import { authResolvers } from './auth';
import { catalogResolvers } from './catalog';
import { orderResolvers } from './order';
import { restaurantResolvers } from './restaurant';
import { appQueryResolvers } from './appQueries';
import { appMutationResolvers } from './appMutations';
import { appSubscriptionResolvers } from './appSubscriptions';
import { appFieldResolvers } from './appFields';
import { adminConfigResolvers } from './adminConfig';
import { adminCatalogResolvers, adminCatalogFields } from './adminCatalog';
import { adminRestaurantResolvers, adminRestaurantFields } from './adminRestaurants';
import { adminStaffResolvers, adminStaffFields } from './adminStaff';
import { adminUserResolvers, adminUserFields } from './adminUsers';
import { adminOrderResolvers, adminOrderFields } from './adminOrders';
import { adminSupportResolvers } from './adminSupport';
import { adminDashboardResolvers } from './adminDashboard';

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO-8601 date scalar',
  serialize(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') return new Date(value).toISOString();
    return null;
  },
  parseValue(value: unknown) {
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    throw new Error('Date value must be an ISO-8601 string');
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) return new Date(ast.value);
    return null;
  },
});

const jsonScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (value: unknown) => value,
  parseValue: (value: unknown) => value,
});

const adminModules: Array<{ Query?: any; Mutation?: any; Subscription?: any }> = [
  adminConfigResolvers as any,
  adminCatalogResolvers,
  adminRestaurantResolvers,
  adminStaffResolvers,
  adminUserResolvers,
  adminOrderResolvers,
  adminSupportResolvers,
  adminDashboardResolvers,
];
const adminFieldModules: Array<Record<string, Record<string, any>>> = [adminCatalogFields, adminRestaurantFields, adminStaffFields, adminUserFields, adminOrderFields];

// Admin resolvers are merged last so they intentionally override same-named legacy resolvers.
const mergeRoot = (key: 'Query' | 'Mutation' | 'Subscription', base: Record<string, any>) =>
  Object.assign({}, base, ...adminModules.map((m) => m[key] || {}));

// Field resolvers are merged per type so admin additions do not drop existing ones.
const mergeFields = (base: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = { ...base };
  for (const mod of adminFieldModules) for (const [type, fields] of Object.entries(mod)) out[type] = { ...(out[type] || {}), ...fields };
  return out;
};

export const resolvers: Record<string, any> = {
  Date: dateScalar,
  JSON: jsonScalar,
  Query: mergeRoot('Query', {
    ...authResolvers.Query,
    ...accountResolvers.Query,
    ...restaurantResolvers.Query,
    ...catalogResolvers.Query,
    ...orderResolvers.Query,
    ...appQueryResolvers,
  }),
  Mutation: mergeRoot('Mutation', {
    ...authResolvers.Mutation,
    ...accountResolvers.Mutation,
    ...restaurantResolvers.Mutation,
    ...catalogResolvers.Mutation,
    ...orderResolvers.Mutation,
    ...appMutationResolvers,
  }),
  Subscription: mergeRoot('Subscription', {
    ...orderResolvers.Subscription,
    ...appSubscriptionResolvers,
  }),
  ...mergeFields(appFieldResolvers),
};
