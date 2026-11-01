const test = require('node:test');
const assert = require('node:assert/strict');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { typeDefs } = require('../dist/graphql/typeDefs');
const { resolvers } = require('../dist/graphql/resolvers');

const schema = makeExecutableSchema({ typeDefs, resolvers });

test('every root GraphQL field has an implemented resolver', () => {
  for (const [operation, type] of [
    ['Query', schema.getQueryType()],
    ['Mutation', schema.getMutationType()],
    ['Subscription', schema.getSubscriptionType()],
  ]) {
    assert(type, `${operation} type is missing`);
    for (const field of Object.keys(type.getFields())) {
      const resolver = resolvers[operation][field];
      const implemented = operation === 'Subscription'
        ? typeof resolver?.subscribe === 'function'
        : typeof resolver === 'function';
      assert(implemented, `${operation}.${field} is not implemented`);
    }
  }
});

test('public configuration never returns server secrets', async () => {
  const configuration = await resolvers.Query.getConfiguration();
  for (const secret of ['password', 'twilioAuthToken', 'firebaseKey']) {
    assert.equal(configuration[secret], undefined, `${secret} must not be exposed`);
  }
});

test('configuration exposes OpenStreetMap service URLs and no Google Maps fields', () => {
  const fields = Object.keys(schema.getType('Configuration').getFields());
  for (const field of ['mapTileUrl', 'geocodingUrl', 'routingUrl']) {
    assert(fields.includes(field), `Configuration.${field} is missing`);
  }
  for (const field of ['googleApiKey', 'googleMapLibraries', 'googleColor', 'googlePlacesApiBaseUrl']) {
    assert(!fields.includes(field), `Configuration.${field} should have been removed`);
  }
});

test('admin map settings inputs accept the new URLs', () => {
  for (const inputName of ['GoogleApiKeyConfigurationInput', 'WebConfigurationInput']) {
    const fields = Object.keys(schema.getType(inputName).getFields());
    for (const field of ['mapTileUrl', 'geocodingUrl', 'routingUrl']) {
      assert(fields.includes(field), `${inputName}.${field} is missing`);
    }
    assert(!fields.includes('googleApiKey'), `${inputName}.googleApiKey should have been removed`);
  }
});
