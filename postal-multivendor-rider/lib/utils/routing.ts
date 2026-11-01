import {
  OSRM_BASE_URL,
  ROUTING_CACHE_TTL_MS,
  ROUTING_TIMEOUT_MS,
} from "./mapConfig";

export type RouteLatLng = { latitude: number; longitude: number };

export type RouteResult = {
  /** Polyline points, ready for <AppPolyline coordinates=... /> */
  coordinates: RouteLatLng[];
  /** kilometres (same unit react-native-maps-directions used) */
  distance: number;
  /** minutes (same unit react-native-maps-directions used) */
  duration: number;
  /** true when OSRM failed and a straight line was returned instead */
  isFallback: boolean;
  /** only set when isFallback = true */
  error?: Error;
};

type Options = {
  timeoutMs?: number;
  ttlMs?: number;
  signal?: AbortSignal;
};

// Very small in-memory cache + in-flight de-duplication.
// Keys are rounded to 4 decimals (~11 m) so GPS jitter does not trigger new requests.
const cache = new Map<string, { at: number; value: RouteResult }>();
const inflight = new Map<string, Promise<RouteResult>>();
const MAX_CACHE = 50;
const FALLBACK_TTL_MS = 15 * 1000; // do not hammer OSRM right after a failure

const keyOf = (a: RouteLatLng, b: RouteLatLng) =>
  [a.longitude, a.latitude, b.longitude, b.latitude]
    .map((n) => Number(n).toFixed(4))
    .join(",");

const straightLine = (a: RouteLatLng, b: RouteLatLng, error?: Error): RouteResult => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  return {
    coordinates: [a, b],
    distance: km,
    duration: (km / 30) * 60, // assume ~30 km/h in the city
    isFallback: true,
    error,
  };
};

const remember = (key: string, value: RouteResult) => {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
};

async function fetchOsrm(
  origin: RouteLatLng,
  destination: RouteLatLng,
  { timeoutMs = ROUTING_TIMEOUT_MS, signal }: Options,
): Promise<RouteResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort);
  try {
    // NOTE: OSRM expects {longitude},{latitude}
    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
      `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const json = await res.json();
    const route = json?.routes?.[0];
    if (json?.code !== "Ok" || !route?.geometry?.coordinates?.length) {
      throw new Error(`OSRM ${json?.code ?? "NO_ROUTE"}`);
    }
    return {
      coordinates: route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      })),
      distance: route.distance / 1000,
      duration: route.duration / 60,
      isFallback: false,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

/**
 * Driving route between two points using OSRM.
 * Never throws: on timeout / network / "no route" it resolves with a straight line
 * (isFallback = true, error = the reason).
 *
 * TODO(production): the public OSRM server is for testing only – self-host it.
 */
export async function getRoute(
  origin: RouteLatLng,
  destination: RouteLatLng,
  options: Options = {},
): Promise<RouteResult> {
  const key = keyOf(origin, destination);
  const ttl = options.ttlMs ?? ROUTING_CACHE_TTL_MS;

  const hit = cache.get(key);
  if (hit) {
    const age = Date.now() - hit.at;
    if (age < (hit.value.isFallback ? FALLBACK_TTL_MS : ttl)) return hit.value;
    cache.delete(key);
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await fetchOsrm(origin, destination, options);
      remember(key, value);
      return value;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      const value = straightLine(origin, destination, err);
      remember(key, value);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}
