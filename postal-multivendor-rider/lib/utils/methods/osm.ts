import { LatLng } from "react-native-maps";

// OpenStreetMap routing (OSRM). No API key / no billing.
const OSM_USER_AGENT = "PostalMultivendor/1.0 (https://postal.example.com)";
const MIN_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

let lastRequestAt = 0;
const cache = new Map<string, { at: number; value: IRouteResult }>();

export interface IRouteResult {
  coordinates: LatLng[];
  distance: number; // metres
  duration: number; // minutes (same unit the UI used with Google)
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Serialise requests so concurrent callers cannot both observe a stale
// `lastRequestAt` and fire at the same instant (which would break the
// 1 request/second budget).
let throttleChain: Promise<unknown> = Promise.resolve();

const throttled = <T,>(task: () => Promise<T>): Promise<T> => {
  const run = throttleChain.then(async () => {
    const waitMs = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (waitMs > 0) await wait(waitMs);
    lastRequestAt = Date.now();
    return task();
  });
  throttleChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const trimBase = (baseUrl: string) => String(baseUrl || "").replace(/\/+$/, "");

const cacheGet = (key: string) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const cacheSet = (key: string, value: IRouteResult) => {
  cache.set(key, { at: Date.now(), value });
};

/**
 * Fetch a driving route between two points from OSRM.
 * Returns null on any failure so callers can fall back to a straight line.
 */
export const getRoute = async (
  baseUrl: string,
  origin: LatLng,
  destination: LatLng,
): Promise<IRouteResult | null> => {
  const key = `route:${origin.latitude},${origin.longitude};${destination.latitude},${destination.longitude}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url =
    `${trimBase(baseUrl)}/route/v1/driving/` +
    `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
    `?overview=full&geometries=geojson`;

  try {
    const response = await throttled(() =>
      fetch(url, {
        headers: { "User-Agent": OSM_USER_AGENT, Accept: "application/json" },
      }),
    );
    if (!response.ok) return null;

    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;

    const result: IRouteResult = {
      coordinates: route.geometry.coordinates.map(
        (pair: [number, number]) => ({
          latitude: Number(pair[1]),
          longitude: Number(pair[0]),
        }),
      ),
      distance: Number(route.distance) / 1000, // km, matches Google's unit
      duration: Number(route.duration) / 60, // minutes
    };

    cacheSet(key, result);
    return result;
  } catch (error) {
    console.log("OSRM route error:", error);
    return null;
  }
};
