import React, { useEffect, useRef, useState } from "react";
import { getRoute, RouteResult } from "@/lib/utils/routing";
import { haversineMeters, isValidLatLng, LatLng } from "./geo";
import { AppPolyline } from "./AppShapes";
import { DEFAULT_ROUTE_COLOR } from "@/lib/utils/mapConfig";

export interface AppDirectionsProps {
  origin: LatLng | null | undefined;
  destination: LatLng | null | undefined;
  strokeColor?: string;
  strokeWidth?: number;
  /** called with { coordinates, distance (km), duration (min), isFallback } */
  onReady?: (result: RouteResult) => void;
  /** called when OSRM failed (a straight line is still drawn and onReady is still called) */
  onError?: (error: Error) => void;
  /** do not re-request while both ends moved less than this many metres (default 30) */
  minRefetchDistance?: number;
  enabled?: boolean;
}

/**
 * Replacement for react-native-maps-directions (no Google key).
 * Draws the OSRM route as a polyline and reports distance / duration.
 */
export function AppDirections({
  origin,
  destination,
  strokeColor = DEFAULT_ROUTE_COLOR,
  strokeWidth = 4,
  onReady,
  onError,
  minRefetchDistance = 30,
  enabled = true,
}: AppDirectionsProps) {
  const [coords, setCoords] = useState<LatLng[]>([]);
  const last = useRef<{ o: LatLng; d: LatLng } | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  const oLat = origin?.latitude;
  const oLng = origin?.longitude;
  const dLat = destination?.latitude;
  const dLng = destination?.longitude;

  useEffect(() => {
    if (!enabled || !isValidLatLng(origin) || !isValidLatLng(destination)) return;

    const prev = last.current;
    if (
      prev &&
      haversineMeters(prev.o, origin) < minRefetchDistance &&
      haversineMeters(prev.d, destination) < minRefetchDistance
    ) {
      return;
    }
    last.current = { o: origin, d: destination };

    const id = ++requestId.current;
    getRoute(origin, destination).then((result) => {
      // ignore stale answers and answers after unmount
      if (!mounted.current || id !== requestId.current) return;
      // keep the previous line on screen until the new one arrives (no flicker)
      setCoords(result.coordinates);
      if (result.isFallback && result.error) onErrorRef.current?.(result.error);
      onReadyRef.current?.(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oLat, oLng, dLat, dLng, enabled, minRefetchDistance]);

  return <AppPolyline coordinates={coords} color={strokeColor} width={strokeWidth} />;
}

export default AppDirections;
