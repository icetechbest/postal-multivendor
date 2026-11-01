import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Camera, Map as MapLibreMap } from "@maplibre/maplibre-react-native";
import {
  DEFAULT_ZOOM,
  MAP_ATTRIBUTION,
  MAX_ZOOM,
  MIN_ZOOM,
  getMapStyle,
} from "@/lib/utils/mapConfig";
import { useLiveLocation } from "@/lib/hooks/useLiveLocation";
import {
  EdgePadding,
  LatLng,
  Region,
  coordinatesToFit,
  isValidLatLng,
  regionToViewState,
  toLngLat,
  viewStateToRegion,
} from "./geo";
import { AppMarker } from "./AppMarker";

// Fallback when no region is given (Cairo)
const FALLBACK_REGION: Region = {
  latitude: 30.0444,
  longitude: 31.2357,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export interface AppMapRef {
  /** same signature as react-native-maps */
  animateToRegion: (region: Region, duration?: number) => void;
  /**
   * same shape as react-native-maps. NOTE: `zoom` follows the Google convention
   * (256px tiles) and is converted to MapLibre's scale internally.
   */
  animateCamera: (
    camera: {
      center?: LatLng;
      pitch?: number;
      heading?: number;
      zoom?: number;
      altitude?: number;
    },
    options?: { duration?: number },
  ) => void;
  fitToCoordinates: (
    coordinates: LatLng[],
    options?: { edgePadding?: Partial<EdgePadding>; animated?: boolean },
  ) => void;
  getCenter: () => Promise<LatLng | null>;
}

export interface AppMapProps {
  initialRegion?: Region;
  /** controlled region: the camera follows it whenever it changes */
  region?: Region;
  onRegionChangeComplete?: (
    region: Region,
    details?: { isGesture: boolean },
  ) => void;
  /** nativeEvent.coordinate = { latitude, longitude } (react-native-maps shape) */
  onPress?: (event: { nativeEvent: { coordinate: LatLng } }) => void;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
  /** dark vector style (OpenFreeMap "dark") */
  dark?: boolean;
  /** override the style URL */
  mapStyle?: string;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  minZoomLevel?: number;
  maxZoomLevel?: number;
  /** show the attribution (i) button – keep true to respect the OSM licence */
  attribution?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const DEFAULT_PADDING: EdgePadding = { top: 40, right: 40, bottom: 40, left: 40 };

// MapLibre zoom = Google zoom - 1 (512px vs 256px tiles)
const googleZoomToMapLibre = (z: number) => z - 1;

const sameRegion = (a: Region | null, b: Region | null) => {
  if (!a || !b) return false;
  if (
    Math.abs(a.latitude - b.latitude) > 1e-6 ||
    Math.abs(a.longitude - b.longitude) > 1e-6
  ) {
    return false;
  }
  if (a.longitudeDelta && b.longitudeDelta) {
    return Math.abs(a.longitudeDelta - b.longitudeDelta) / a.longitudeDelta < 0.05;
  }
  return true;
};

export const AppMap = forwardRef<AppMapRef, AppMapProps>(function AppMap(
  {
    initialRegion,
    region,
    onRegionChangeComplete,
    onPress,
    onMapReady,
    showsUserLocation = false,
    dark = false,
    mapStyle,
    scrollEnabled = true,
    zoomEnabled = true,
    rotateEnabled = true,
    pitchEnabled = true,
    minZoomLevel,
    maxZoomLevel,
    attribution = true,
    style,
    children,
  },
  ref,
) {
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const size = useRef({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  });
  const lastKnown = useRef<Region | null>(null);
  // Camera commands issued before the style finished loading are queued, then replayed.
  const ready = useRef(false);
  const queue = useRef<Array<() => void>>([]);
  const run = useCallback((fn: () => void) => {
    if (ready.current) fn();
    else queue.current.push(fn);
  }, []);
  const handleLoaded = useCallback(() => {
    ready.current = true;
    const pending = queue.current;
    queue.current = [];
    pending.forEach((fn) => fn());
    onMapReady?.();
  }, [onMapReady]);

  // Initial camera is computed once (like react-native-maps' initialRegion)
  const [initialViewState] = useState(() => {
    const base = initialRegion ?? region ?? FALLBACK_REGION;
    if (!isValidLatLng(base)) {
      return { center: toLngLat(FALLBACK_REGION), zoom: DEFAULT_ZOOM };
    }
    lastKnown.current = base;
    return regionToViewState(base, size.current.width);
  });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) size.current = { width, height };
  }, []);

  // ---- controlled `region` -------------------------------------------------
  useEffect(() => {
    if (!region || !isValidLatLng(region)) return;
    if (sameRegion(region, lastKnown.current)) return;
    lastKnown.current = region;
    const vs = regionToViewState(region, size.current.width);
    run(() =>
      cameraRef.current?.easeTo({ center: vs.center, zoom: vs.zoom, duration: 300 }),
    );
  }, [region?.latitude, region?.longitude, region?.longitudeDelta, region?.latitudeDelta]);

  // ---- events --------------------------------------------------------------
  const handleRegionDidChange = useCallback(
    (e: any) => {
      const ev = e?.nativeEvent;
      if (!ev?.center) return;
      const r = viewStateToRegion(ev);
      lastKnown.current = r;
      onRegionChangeComplete?.(r, { isGesture: !!ev.userInteraction });
    },
    [onRegionChangeComplete],
  );

  const handlePress = useCallback(
    (e: any) => {
      const lngLat = e?.nativeEvent?.lngLat;
      if (!onPress || !lngLat) return;
      onPress({
        nativeEvent: { coordinate: { latitude: lngLat[1], longitude: lngLat[0] } },
      });
    },
    [onPress],
  );

  // ---- imperative API (react-native-maps compatible) -----------------------
  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (r, duration = 500) => {
        if (!isValidLatLng(r)) return;
        const vs = regionToViewState(r, size.current.width);
        lastKnown.current = r;
        run(() =>
          cameraRef.current?.easeTo({ center: vs.center, zoom: vs.zoom, duration }),
        );
      },
      animateCamera: async (cam, options) => {
        let center = cam.center && isValidLatLng(cam.center) ? toLngLat(cam.center) : null;
        if (!center) {
          try {
            center = (await mapRef.current?.getCenter()) ?? null;
          } catch {
            center = null;
          }
        }
        if (!center) return;
        const target = center;
        run(() =>
          cameraRef.current?.easeTo({
            center: target,
            ...(cam.zoom !== undefined ? { zoom: googleZoomToMapLibre(cam.zoom) } : {}),
            ...(cam.pitch !== undefined ? { pitch: cam.pitch } : {}),
            ...(cam.heading !== undefined ? { bearing: cam.heading } : {}),
            duration: options?.duration ?? 500,
          }),
        );
      },
      fitToCoordinates: (coords, options) => {
        const padding: EdgePadding = { ...DEFAULT_PADDING, ...(options?.edgePadding ?? {}) };
        const fit = coordinatesToFit(coords, size.current, padding);
        if (!fit) return;
        run(() =>
          cameraRef.current?.easeTo({
            center: fit.center,
            zoom: fit.zoom,
            padding: fit.padding,
            duration: options?.animated === false ? 0 : 500,
          }),
        );
      },
      getCenter: async () => {
        try {
          const c = await mapRef.current?.getCenter();
          return c ? { latitude: c[1], longitude: c[0] } : null;
        } catch {
          return null;
        }
      },
    }),
    [run],
  );

  // ---- user location ("blue dot") -----------------------------------------
  const { location } = useLiveLocation({ enabled: showsUserLocation });

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <MapLibreMap
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyle ?? getMapStyle(dark)}
        // Android: TextureView plays nicely with overlays / ScrollView / zIndex
        androidView="texture"
        dragPan={scrollEnabled}
        touchZoom={zoomEnabled}
        doubleTapZoom={zoomEnabled}
        doubleTapHoldZoom={zoomEnabled}
        touchRotate={rotateEnabled}
        touchPitch={pitchEnabled}
        compass={rotateEnabled}
        logo={false}
        attribution={attribution}
        attributionPosition={{ bottom: 6, right: 6 }}
        onRegionDidChange={handleRegionDidChange}
        onPress={handlePress}
        onDidFinishLoadingMap={handleLoaded}
      >
        <Camera
          ref={cameraRef}
          initialViewState={initialViewState}
          minZoom={minZoomLevel !== undefined ? googleZoomToMapLibre(minZoomLevel) : MIN_ZOOM}
          maxZoom={maxZoomLevel !== undefined ? googleZoomToMapLibre(maxZoomLevel) : MAX_ZOOM}
        />
        {children}
        {showsUserLocation && location && isValidLatLng(location) ? (
          <AppMarker coordinate={location} animationDuration={800}>
            <View style={styles.userDotHalo}>
              <View style={styles.userDot} />
            </View>
          </AppMarker>
        ) : null}
      </MapLibreMap>
    </View>
  );
});

export { MAP_ATTRIBUTION };

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  map: { flex: 1 },
  userDotHalo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(66,133,244,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  userDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4285F4",
    borderWidth: 2,
    borderColor: "#fff",
  },
});

export default AppMap;
