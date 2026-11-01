/**
 * Single place to configure the map provider.
 * Everything here is free and key-less (OpenFreeMap tiles + public OSRM).
 *
 * NOTE: do NOT point production traffic at tile.openstreetmap.org directly
 * (usage policy forbids heavy use). OpenFreeMap serves OSM data for free.
 */

// Vector styles (OpenStreetMap data © OpenStreetMap contributors, OpenMapTiles, OpenFreeMap)
export const MAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
export const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

// Demo-only fallback style (do not use in production)
export const MAP_STYLE_DEMO = "https://demotiles.maplibre.org/style.json";

export const getMapStyle = (dark?: boolean): string =>
  dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

// Attribution text required by the OSM / OpenFreeMap licences.
// MapLibre shows it through the (i) button defined by the style itself.
export const MAP_ATTRIBUTION = "© OpenStreetMap contributors";

// Routing (public OSRM demo server – for testing only!)
// TODO(production): move routing to a self-hosted OSRM / Valhalla / GraphHopper
// instance and change this URL. The public server is rate limited and has no SLA.
export const OSRM_BASE_URL = "https://router.project-osrm.org";
export const ROUTING_TIMEOUT_MS = 8000;
export const ROUTING_CACHE_TTL_MS = 5 * 60 * 1000;

// Defaults
export const DEFAULT_ZOOM = 14;
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 22;
export const DEFAULT_ROUTE_COLOR = "#4285F4";
