import assert from 'node:assert/strict';
import test from 'node:test';

// Record the timestamp of every outgoing request so we can assert the
// 1 request/second budget required by the Nominatim usage policy.
const callTimestamps: number[] = [];

(globalThis as unknown as { fetch: unknown }).fetch = async () => {
  callTimestamps.push(Date.now());
  return {
    ok: true,
    status: 200,
    json: async () => [],
  };
};

import { searchPlaces } from './index';

test('concurrent geocoding calls are serialised to 1 request/second', async () => {
  callTimestamps.length = 0;
  const startedAt = Date.now();

  await Promise.all([
    searchPlaces('https://nominatim.test', 'first query'),
    searchPlaces('https://nominatim.test', 'second query'),
    searchPlaces('https://nominatim.test', 'third query'),
  ]);

  assert.equal(callTimestamps.length, 3, 'every call should hit the network');

  for (let index = 1; index < callTimestamps.length; index += 1) {
    const gap = callTimestamps[index] - callTimestamps[index - 1];
    assert.ok(
      gap >= 950,
      `requests were only ${gap}ms apart, which breaks the 1 req/s budget`
    );
  }

  assert.ok(
    Date.now() - startedAt >= 1900,
    'three serialised requests should take at least two seconds'
  );
});
