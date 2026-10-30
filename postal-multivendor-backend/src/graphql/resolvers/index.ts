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

export const resolvers: Record<string, any> = {
  Date: dateScalar,
  JSON: jsonScalar,
  Query: {
    ...authResolvers.Query,
    ...accountResolvers.Query,
    ...restaurantResolvers.Query,
    ...catalogResolvers.Query,
    ...orderResolvers.Query,
    ...appQueryResolvers,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...accountResolvers.Mutation,
    ...restaurantResolvers.Mutation,
    ...catalogResolvers.Mutation,
    ...orderResolvers.Mutation,
    ...appMutationResolvers,
  },
  Subscription: {
    ...orderResolvers.Subscription,
    ...appSubscriptionResolvers,
  },
  ...appFieldResolvers,
};
