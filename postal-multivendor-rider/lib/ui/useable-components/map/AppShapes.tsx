import React, { useId, useMemo } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { isValidLatLng, LatLng, LngLat, toLngLat } from "./geo";
import { DEFAULT_ROUTE_COLOR } from "@/lib/utils/mapConfig";

const useShapeId = (prefix: string) =>
  `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

/** cheap content key so a new-but-identical array does not re-upload the GeoJSON */
const coordsKey = (pts: LatLng[]) => {
  if (!pts.length) return "0";
  let sLat = 0;
  let sLng = 0;
  pts.forEach((p) => {
    sLat += p.latitude;
    sLng += p.longitude;
  });
  const f = pts[0];
  const l = pts[pts.length - 1];
  return `${pts.length}:${f.latitude}:${f.longitude}:${l.latitude}:${l.longitude}:${sLat.toFixed(6)}:${sLng.toFixed(6)}`;
};

export interface AppPolylineProps {
  coordinates: LatLng[] | null | undefined;
  color?: string;
  width?: number;
  /** react-native-maps aliases */
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
}

export function AppPolyline({
  coordinates,
  color,
  width,
  strokeColor,
  strokeWidth,
  opacity = 1,
}: AppPolylineProps) {
  const id = useShapeId("line");
  const pts = useMemo(() => (coordinates ?? []).filter(isValidLatLng), [coordinates]);
  const key = coordsKey(pts);
  const data = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: pts.map(toLngLat),
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  if (pts.length < 2) return null;
  return (
    <GeoJSONSource id={id} data={data as any}>
      <Layer
        id={`${id}-layer`}
        type="line"
        source={id}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": color ?? strokeColor ?? DEFAULT_ROUTE_COLOR,
          "line-width": width ?? strokeWidth ?? 4,
          "line-opacity": opacity,
        }}
      />
    </GeoJSONSource>
  );
}

export interface AppPolygonProps {
  coordinates: LatLng[] | null | undefined;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export function AppPolygon({
  coordinates,
  fillColor = "rgba(66,133,244,0.2)",
  strokeColor = "#4285F4",
  strokeWidth = 2,
}: AppPolygonProps) {
  const id = useShapeId("poly");
  const pts = useMemo(() => (coordinates ?? []).filter(isValidLatLng), [coordinates]);
  const key = coordsKey(pts);
  const data = useMemo(() => {
    const ring: LngLat[] = pts.map(toLngLat);
    if (ring.length) {
      const [fx, fy] = ring[0];
      const [lx, ly] = ring[ring.length - 1];
      if (fx !== lx || fy !== ly) ring.push([fx, fy]); // GeoJSON rings must be closed
    }
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Polygon" as const, coordinates: [ring] },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (pts.length < 3) return null;
  return (
    <GeoJSONSource id={id} data={data as any}>
      <Layer
        id={`${id}-fill`}
        type="fill"
        source={id}
        paint={{ "fill-color": fillColor }}
      />
      <Layer
        id={`${id}-outline`}
        type="line"
        source={id}
        layout={{ "line-join": "round" }}
        paint={{ "line-color": strokeColor, "line-width": strokeWidth }}
      />
    </GeoJSONSource>
  );
}
