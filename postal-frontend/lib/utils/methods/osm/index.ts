// OpenStreetMap geocoding (Nominatim). No API key / no billing.
// Nominatim usage policy: descriptive User-Agent, max 1 request/second, cache.

export const DEFAULT_GEOCODING_URL = 'https://nominatim.openstreetmap.org';
export const DEFAULT_MAP_TILE_URL =
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_ROUTING_URL = 'https://router.project-osrm.org';

const OSM_USER_AGENT = 'PostalMultivendor/1.0 (https://postal.example.com)';
const MIN_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

let lastRequestAt = 0;
const cache = new Map<string, { at: number; value: unknown }>();

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const trimBase = (baseUrl?: string) =>
  String(baseUrl || DEFAULT_GEOCODING_URL).replace(/\/+$/, '');

const cacheGet = <T,>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
};

const cacheSet = (key: string, value: unknown) => {
  cache.set(key, { at: Date.now(), value });
};

// Serialise requests so we never exceed 1 request/second to Nominatim.
// Reading `lastRequestAt`, awaiting, then writing it is racy: concurrent
// callers all read the same stale value and fire simultaneously. Chaining the
// work guarantees a single in-flight request at a time.
let throttleChain: Promise<unknown> = Promise.resolve();

const throttledGet = (url: string, params: Record<string, unknown>) => {
  const run = throttleChain.then(async () => {
    const waitMs = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (waitMs > 0) await wait(waitMs);
    lastRequestAt = Date.now();

    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');

    const response = await fetch(`${url}?${query}`, {
      headers: { 'User-Agent': OSM_USER_AGENT, Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed (${response.status})`);
    }

    return response.json();
  });

  throttleChain = run.then(
    () => undefined,
    () => undefined
  );

  return run;
};

export interface IOsmPlace {
  place_id: string;
  description: string;
  lat: number;
  lng: number;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
    main_text_matched_substrings: { offset: number; length: number }[];
  };
}

const toPlace = (item: {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
}): IOsmPlace => {
  const description = item.display_name ?? '';
  const [main, ...rest] = description.split(',');
  return {
    place_id: String(item.place_id ?? `${item.lat},${item.lon}`),
    description,
    lat: Number(item.lat),
    lng: Number(item.lon),
    structured_formatting: {
      main_text: (item.name || main || description).trim(),
      secondary_text: rest.join(',').trim(),
      main_text_matched_substrings: [],
    },
  };
};

/** Forward geocoding: free-text query -> list of places. */
export const searchPlaces = async (
  baseUrl: string | undefined,
  query: string,
  limit = 5
): Promise<IOsmPlace[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const key = `search:${trimmed}:${limit}`;
  const cached = cacheGet<IOsmPlace[]>(key);
  if (cached) return cached;

  try {
    const data = await throttledGet(`${trimBase(baseUrl)}/search`, {
      format: 'jsonv2',
      q: trimmed,
      addressdetails: 1,
      limit,
      'accept-language': 'en',
    });

    const places = Array.isArray(data) ? data.map(toPlace) : [];
    cacheSet(key, places);
    return places;
  } catch (error) {
    console.warn('OSM search failed:', error);
    return [];
  }
};

/** Reverse geocoding: coordinates -> formatted address. */
export const reverseGeocode = async (
  baseUrl: string | undefined,
  latitude: number,
  longitude: number
): Promise<string> => {
  const key = `reverse:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const cached = cacheGet<string>(key);
  if (cached) return cached;

  try {
    const data = await throttledGet(`${trimBase(baseUrl)}/reverse`, {
      format: 'jsonv2',
      lat: latitude,
      lon: longitude,
      addressdetails: 1,
      'accept-language': 'en',
    });

    const address: string = data?.display_name ?? '';
    cacheSet(key, address);
    return address;
  } catch (error) {
    console.warn('OSM reverse geocoding failed:', error);
    return '';
  }
};
