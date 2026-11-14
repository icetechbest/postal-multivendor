import React, { useEffect, useRef, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Marker } from "@maplibre/maplibre-react-native";
import { isValidLatLng, LatLng, toLngLat } from "./geo";

type AnimatedLike = {
  addListener: (cb: (s: { value: number }) => void) => string;
  removeListener: (id: string) => void;
  __getValue?: () => number;
};

/** Accepts plain numbers (react-native-maps style) or Animated.Value (Marker.Animated style) */
export type MarkerCoordinate = {
  latitude: number | AnimatedLike;
  longitude: number | AnimatedLike;
};

export type MarkerAnchor =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface AppMarkerProps {
  coordinate: MarkerCoordinate | null | undefined;
  onPress?: (event?: any) => void;
  /** one or many children (View / Image / SVG). Default: a simple dot. */
  children?: React.ReactNode;
  /** where the child touches the coordinate. Default "center" */
  anchor?: MarkerAnchor;
  /** pixel offset from the anchor [x, y] */
  offset?: [number, number];
  style?: StyleProp<ViewStyle>;
  /**
   * Smoothly glide to new coordinates (ms). Use it for live tracking so the marker
   * does not jump. Ignored for Animated.Value coordinates (they already animate).
   */
  animationDuration?: number;
  /** accepted for react-native-maps compatibility, not rendered */
  title?: string;
  description?: string;
}

const isAnimated = (v: unknown): v is AnimatedLike =>
  !!v && typeof (v as AnimatedLike).addListener === "function";

const readNumber = (v: number | AnimatedLike): number => {
  if (isAnimated(v)) {
    try {
      return Number(v.__getValue ? v.__getValue() : NaN);
    } catch {
      return NaN;
    }
  }
  return Number(v);
};

function useResolvedCoordinate(
  coordinate: MarkerCoordinate | null | undefined,
  animationDuration?: number,
): LatLng | null {
  const [coord, setCoord] = useState<LatLng | null>(() => {
    if (!coordinate) return null;
    return {
      latitude: readNumber(coordinate.latitude),
      longitude: readNumber(coordinate.longitude),
    };
  });
  const current = useRef<LatLng | null>(coord);
  const raf = useRef<number | null>(null);

  const apply = (c: LatLng) => {
    current.current = c;
    setCoord(c);
  };

  const rawLat = coordinate?.latitude;
  const rawLng = coordinate?.longitude;

  useEffect(() => {
    if (rawLat === undefined || rawLng === undefined) return;

    // 1) Animated.Value pair -> follow the values
    if (isAnimated(rawLat) && isAnimated(rawLng)) {
      let lat = readNumber(rawLat);
      let lng = readNumber(rawLng);
      apply({ latitude: lat, longitude: lng });
      const a = rawLat.addListener(({ value }) => {
        lat = value;
        apply({ latitude: lat, longitude: lng });
      });
      const b = rawLng.addListener(({ value }) => {
        lng = value;
        apply({ latitude: lat, longitude: lng });
      });
      return () => {
        rawLat.removeListener(a);
        rawLng.removeListener(b);
      };
    }

    // 2) plain numbers
    const target: LatLng = {
      latitude: readNumber(rawLat),
      longitude: readNumber(rawLng),
    };
    const from = current.current;
    if (
      !animationDuration ||
      !from ||
      !isValidLatLng(from) ||
      !isValidLatLng(target)
    ) {
      apply(target);
      return;
    }
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / animationDuration);
      apply({
        latitude: from.latitude + (target.latitude - from.latitude) * t,
        longitude: from.longitude + (target.longitude - from.longitude) * t,
      });
      raf.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    step();
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawLat, rawLng, animationDuration]);

  return coord;
}

/** Marker with the react-native-maps style API ({latitude, longitude}) on top of MapLibre. */
export function AppMarker({
  coordinate,
  onPress,
  children,
  anchor = "center",
  offset,
  style,
  animationDuration,
}: AppMarkerProps) {
  const coord = useResolvedCoordinate(coordinate, animationDuration);
  if (!isValidLatLng(coord)) return null;

  return (
    <Marker
      lngLat={toLngLat(coord)}
      anchor={anchor}
      offset={offset}
      onPress={onPress}
    >
      {/* Marker accepts exactly one child -> always wrap */}
      <View collapsable={false} style={style}>
        {children ?? <View style={styles.defaultPin} />}
      </View>
    </Marker>
  );
}

/** Drop-in for `Marker.Animated` – accepts Animated.Value coordinates. */
export const AppMarkerAnimated = AppMarker;
(AppMarker as any).Animated = AppMarker;

const styles = StyleSheet.create({
  defaultPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E53935",
    borderWidth: 3,
    borderColor: "#fff",
  },
});

export default AppMarker;
