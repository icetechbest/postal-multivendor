import { Dimensions } from "react-native";
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM } from "@/lib/utils/mapConfig";

export type LatLng = { latitude: number; longitude: number };
export type Region = LatLng & {
  latitudeDelta?: number;
  longitudeDelta?: number;
};
/** MapLibre / GeoJSON order: [longitude, latitude] */
export type LngLat = [number, number];
export type EdgePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

// MapLibre Native renders 512px tiles (Google uses 256px => Google zoom = MapLibre zoom + 1)
const TILE_SIZE = 512;

export const toLngLat = (c: LatLng): LngLat => [
  Number(c.longitude),
  Number(c.latitude),
];

export const isValidLatLng = (c?: Partial<LatLng> | null): c is LatLng => {
  if (!c) return false;
  const lat = Number(c.latitude);
  const lng = Number(c.longitude);
  return (
    c.latitude !== null &&
    c.longitude !== null &&
    c.latitude !== undefined &&
    c.longitude !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
};

const clampZoom = (z: number) =>
  Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number.isFinite(z) ? z : DEFAULT_ZOOM));

/** react-native-maps "region" -> MapLibre center + zoom */
export const regionToViewState = (
  region: Region,
  viewportWidth: number = Dimensions.get("window").width,
): { center: LngLat; zoom: number } => {
  const center: LngLat = [Number(region.longitude), Number(region.latitude)];
  let lonDelta = Number(region.longitudeDelta);
  if (!Number.isFinite(lonDelta) || lonDelta <= 0) {
    const latDelta = Number(region.latitudeDelta);
    if (Number.isFinite(latDelta) && latDelta > 0) {
      const { width, height } = Dimensions.get("window");
      lonDelta = latDelta * (width / height);
    } else {
      return { center, zoom: DEFAULT_ZOOM };
    }
  }
  const zoom = Math.log2((360 * viewportWidth) / (TILE_SIZE * lonDelta));
  return { center, zoom: clampZoom(zoom) };
};

/** MapLibre view state (center + bounds [w,s,e,n]) -> react-native-maps "region" */
export const viewStateToRegion = (vs: {
  center: LngLat;
  bounds?: [number, number, number, number];
}): Region => {
  const [longitude, latitude] = vs.center;
  const region: Region = { latitude, longitude };
  if (vs.bounds && vs.bounds.length === 4) {
    region.latitudeDelta = Math.abs(vs.bounds[3] - vs.bounds[1]);
    region.longitudeDelta = Math.abs(vs.bounds[2] - vs.bounds[0]);
  }
  return region;
};

const mercatorY = (latDeg: number) => {
  const lat = Math.max(-85, Math.min(85, latDeg)) * (Math.PI / 180);
  return Math.log(Math.tan(Math.PI / 4 + lat / 2));
};

/** Compute camera (center/zoom/padding) that fits all coordinates inside a viewport. */
export const coordinatesToFit = (
  coords: LatLng[],
  viewport: { width: number; height: number },
  padding: EdgePadding,
  maxZoom = 17,
): { center: LngLat; zoom: number; padding: EdgePadding } | null => {
  const pts = coords.filter(isValidLatLng);
  if (!pts.length) return null;
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  pts.forEach((p) => {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  });
  const center: LngLat = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  const availW = Math.max(40, viewport.width - padding.left - padding.right);
  const availH = Math.max(40, viewport.height - padding.top - padding.bottom);
  const lngSpan = maxLng - minLng;
  const latSpanRad = Math.abs(mercatorY(maxLat) - mercatorY(minLat));
  const zoomX = lngSpan > 0 ? Math.log2((360 * availW) / (TILE_SIZE * lngSpan)) : maxZoom;
  const zoomY =
    latSpanRad > 0
      ? Math.log2((2 * Math.PI * availH) / (TILE_SIZE * latSpanRad))
      : maxZoom;
  return {
    center,
    zoom: clampZoom(Math.min(zoomX, zoomY, maxZoom)),
    padding,
  };
};

export const haversineMeters = (a: LatLng, b: LatLng): number => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
