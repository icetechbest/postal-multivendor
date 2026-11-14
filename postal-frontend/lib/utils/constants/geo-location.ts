import { LatLng } from '../types';

// Default map position: Cairo, Egypt
export const DEFAULT_CENTER: LatLng = {
  lat: 30.0444,
  lng: 31.2357,
};

// Default zone: ~2km square around the center
export const DEFAULT_POLYGON = [
  { lat: 30.0534, lng: 31.2247 },
  { lat: 30.0534, lng: 31.2467 },
  { lat: 30.0354, lng: 31.2467 },
  { lat: 30.0354, lng: 31.2247 },
];
