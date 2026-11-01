/**
 * Unit tests for the GeoJSON <-> Leaflet coordinate helpers.
 *
 * GeoJSON stores coordinates as [lng, lat]; Leaflet uses { lat, lng }.
 * This is the most error-prone part of the OpenStreetMap migration, so the
 * conversions are pinned down here.
 *
 * Run with: npm run test:maps
 */
import assert from 'assert';
import {
  calculatePolygonCentroid,
  transformPath,
  transformPolygon,
} from './index';

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}`);
    console.error(`       ${(error as Error).message}`);
  }
}

// --- transformPolygon: GeoJSON ring -> Leaflet points -----------------------
test('transformPolygon swaps [lng, lat] to { lat, lng }', () => {
  const ring = [
    [46.6753, 24.7136],
    [46.6853, 24.7136],
    [46.6853, 24.7236],
    [46.6753, 24.7236],
    [46.6753, 24.7136],
  ];

  assert.deepStrictEqual(transformPolygon(ring), [
    { lat: 24.7136, lng: 46.6753 },
    { lat: 24.7136, lng: 46.6853 },
    { lat: 24.7236, lng: 46.6853 },
    { lat: 24.7236, lng: 46.6753 },
  ]);
});

test('transformPolygon drops the duplicated closing point', () => {
  const ring = [
    [1, 2],
    [3, 4],
    [5, 6],
    [1, 2],
  ];
  assert.strictEqual(transformPolygon(ring).length, 3);
});

test('transformPolygon returns an empty array for an empty ring', () => {
  assert.deepStrictEqual(transformPolygon([]), []);
});

// --- transformPath: Leaflet points -> GeoJSON ring --------------------------
test('transformPath swaps { lat, lng } to [lng, lat]', () => {
  const path = [
    { lat: 24.7136, lng: 46.6753 },
    { lat: 24.7236, lng: 46.6853 },
  ];

  assert.deepStrictEqual(transformPath(path), [
    [
      [46.6753, 24.7136],
      [46.6853, 24.7236],
      [46.6753, 24.7136],
    ],
  ]);
});

test('transformPath closes the ring by repeating the first point', () => {
  const path = [
    { lat: 1, lng: 2 },
    { lat: 3, lng: 4 },
    { lat: 5, lng: 6 },
  ];
  const result = transformPath(path);
  const ring = result[0];

  assert.strictEqual(ring.length, 4);
  assert.deepStrictEqual(ring[ring.length - 1], ring[0]);
});

test('transformPath wraps the ring in an outer array (Polygon coordinates)', () => {
  const result = transformPath([{ lat: 1, lng: 2 }]);
  assert.strictEqual(Array.isArray(result), true);
  assert.strictEqual(Array.isArray(result[0]), true);
  assert.strictEqual(Array.isArray(result[0][0]), true);
});

// --- round trip ------------------------------------------------------------
test('transformPath and transformPolygon round-trip a polygon', () => {
  const leaflet = [
    { lat: 24.7136, lng: 46.6753 },
    { lat: 24.7136, lng: 46.6853 },
    { lat: 24.7236, lng: 46.6853 },
  ];

  assert.deepStrictEqual(transformPolygon(transformPath(leaflet)[0]), leaflet);
});

// --- calculatePolygonCentroid ---------------------------------------------
test('calculatePolygonCentroid finds the centre of a square', () => {
  const ring = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];

  const centroid = calculatePolygonCentroid(ring);
  assert.strictEqual(centroid.lng, 5);
  assert.strictEqual(centroid.lat, 5);
});

test('calculatePolygonCentroid finds the centre of a rectangle', () => {
  const ring = [
    [46.6, 24.7],
    [46.8, 24.7],
    [46.8, 24.9],
    [46.6, 24.9],
    [46.6, 24.7],
  ];

  const centroid = calculatePolygonCentroid(ring);
  assert.ok(Math.abs(centroid.lng - 46.7) < 1e-9, `lng=${centroid.lng}`);
  assert.ok(Math.abs(centroid.lat - 24.8) < 1e-9, `lat=${centroid.lat}`);
});

test('calculatePolygonCentroid returns {0,0} for degenerate input', () => {
  const centroid = calculatePolygonCentroid([
    [0, 0],
    [0, 0],
  ]);
  assert.deepStrictEqual(centroid, { lat: 0, lng: 0 });
});

// --- summary ---------------------------------------------------------------
console.log('');
if (failures.length > 0) {
  console.error(`${failures.length} test(s) failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`All ${passed} map transform tests passed.`);
