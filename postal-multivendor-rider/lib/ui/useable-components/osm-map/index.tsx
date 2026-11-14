import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

/**
 * OpenStreetMap map (Leaflet inside a WebView).
 *
 *  - No Google Maps SDK, no API key, no billing.
 *  - The same component works on Android and iOS.
 *  - Props are pushed into the page with injectJavaScript, so the map is never
 *    re-created when the rider / route changes (no flicker, no lost zoom).
 *
 * NOTE: tile.openstreetmap.org is fine for small apps, but its usage policy
 * forbids heavy traffic. For production scale point `tileUrl` (or the
 * `mapTileUrl` value of the backend Configuration) to your own / a paid
 * OSM tile provider.
 */

export type MapLatLng = { latitude: number; longitude: number };
export type MapMarkerKind = "rider" | "restaurant" | "customer";

export interface OsmMapProps {
  rider?: MapLatLng | null;
  restaurant?: MapLatLng | null;
  customer?: MapLatLng | null;
  /** polyline, already decoded (e.g. from OSRM) */
  route?: MapLatLng[];
  /** change this value to re-fit the camera on all markers / the route */
  fitKey?: string;
  dark?: boolean;
  tileUrl?: string;
  labels?: Partial<Record<MapMarkerKind, string>>;
  onMarkerPress?: (kind: MapMarkerKind) => void;
  errorTitle?: string;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
// OSM requires a valid Referer. WebView sends `baseUrl` as the referer.
const BASE_URL = process.env.EXPO_PUBLIC_SERVER_URL || "https://www.openstreetmap.org";
const READY_TIMEOUT_MS = 20000;
const LEAFLET_VERSION = "1.9.4";

const isValidPoint = (p?: MapLatLng | null): p is MapLatLng =>
  !!p &&
  Number.isFinite(Number(p.latitude)) &&
  Number.isFinite(Number(p.longitude)) &&
  Math.abs(Number(p.latitude)) <= 90 &&
  Math.abs(Number(p.longitude)) <= 180 &&
  // (0,0) is what the app uses when the location is still unknown
  !(Number(p.latitude) === 0 && Number(p.longitude) === 0);

const sanitizeTileUrl = (url?: string): string => {
  const candidate = (url ?? "").trim();
  const ok =
    /^https:\/\//i.test(candidate) &&
    candidate.includes("{z}") &&
    candidate.includes("{x}") &&
    candidate.includes("{y}");
  return ok ? candidate : DEFAULT_TILE_URL;
};

// JSON for embedding inside a <script> tag (cannot close the tag early)
const safeJson = (value: string) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

const buildHtml = (tileUrl: string, dark: boolean) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: ${dark ? "#1b1b1b" : "#e8e8e8"}; }
  .leaflet-container { font-family: sans-serif; -webkit-tap-highlight-color: transparent; }
  ${dark ? ".leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9); }" : ""}
  .leaflet-control-attribution { font-size: 9px; }
  .leaflet-control-attribution a { pointer-events: none; color: inherit; text-decoration: none; }
  .pin { width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
         display: flex; align-items: center; justify-content: center; border: 2px solid #fff;
         box-shadow: 0 1px 4px rgba(0,0,0,.45); }
  .pin span { transform: rotate(45deg); font-size: 17px; line-height: 1; }
  .pin.rider { background: #f95509; }
  .pin.restaurant { background: #1f2937; }
  .pin.customer { background: #2e7d32; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"></script>
<script>
(function () {
  function post(m) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
  }
  if (!window.L) { post({ type: "error", message: "leaflet-not-loaded" }); return; }

  var map = L.map("map", { zoomControl: true, attributionControl: true })
    .setView([30.0444, 31.2357], 13);
  map.attributionControl.setPrefix(false);
  L.tileLayer(${safeJson(tileUrl)}, {
    maxZoom: 19,
    attribution: ${safeJson(OSM_ATTRIBUTION)}
  }).addTo(map);

  function pin(kind, emoji) {
    return L.divIcon({
      className: "",
      html: '<div class="pin ' + kind + '"><span>' + emoji + "</span></div>",
      iconSize: [34, 34],
      iconAnchor: [17, 34]
    });
  }
  var icons = { rider: pin("rider", "\\uD83D\\uDEF5"), restaurant: pin("restaurant", "\\uD83C\\uDF7D"), customer: pin("customer", "\\uD83C\\uDFE0") };

  var markers = {};
  var line = null;
  var lastFitKey = null;

  function toPoint(p) {
    if (!p) return null;
    var lat = Number(p.latitude), lng = Number(p.longitude);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return [lat, lng];
  }

  function setMarker(kind, p, title) {
    var pos = toPoint(p);
    if (!pos) {
      if (markers[kind]) { map.removeLayer(markers[kind]); delete markers[kind]; }
      return null;
    }
    if (markers[kind]) {
      markers[kind].setLatLng(pos);
    } else {
      markers[kind] = L.marker(pos, { icon: icons[kind], title: title || "", keyboard: false }).addTo(map);
      markers[kind].on("click", function () { post({ type: "press", kind: kind }); });
    }
    return pos;
  }

  window.__update = function (s) {
    try {
      var labels = s.labels || {};
      var pts = [];
      var c = setMarker("customer", s.customer, labels.customer);
      var r = setMarker("restaurant", s.restaurant, labels.restaurant);
      var d = setMarker("rider", s.rider, labels.rider);
      if (c) pts.push(c);
      if (r) pts.push(r);
      if (d) pts.push(d);

      var route = [];
      (s.route || []).forEach(function (p) { var q = toPoint(p); if (q) route.push(q); });
      if (line) { map.removeLayer(line); line = null; }
      if (route.length > 1) {
        line = L.polyline(route, { color: "#f95509", weight: 4, opacity: 0.9 }).addTo(map);
      }

      var fitPts = pts.slice();
      if (route.length > 1) fitPts = fitPts.concat(route);
      if (fitPts.length && s.fitKey !== lastFitKey) {
        lastFitKey = s.fitKey;
        map.invalidateSize();
        if (fitPts.length === 1) map.setView(fitPts[0], 15);
        else map.fitBounds(L.latLngBounds(fitPts), { padding: [40, 40], maxZoom: 17 });
      }
    } catch (e) {
      post({ type: "error", message: String(e) });
    }
  };

  post({ type: "ready" });
})();
</script>
</body>
</html>`;

function OsmMap({
  rider,
  restaurant,
  customer,
  route,
  fitKey = "",
  dark = false,
  tileUrl,
  labels,
  onMarkerPress,
  errorTitle = "Map not loaded",
  retryLabel = "Retry",
  style,
}: OsmMapProps) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const html = useMemo(
    () => buildHtml(sanitizeTileUrl(tileUrl), dark),
    [tileUrl, dark],
  );

  // Only valid points / a plain array are sent into the page.
  const payload = useMemo(
    () =>
      JSON.stringify({
        rider: isValidPoint(rider) ? rider : null,
        restaurant: isValidPoint(restaurant) ? restaurant : null,
        customer: isValidPoint(customer) ? customer : null,
        route: (route ?? []).filter(isValidPoint),
        fitKey,
        labels: labels ?? {},
      }),
    [rider, restaurant, customer, route, fitKey, labels],
  );

  const push = useCallback(() => {
    if (!readyRef.current) return;
    webRef.current?.injectJavaScript(
      `window.__update && window.__update(${payload}); true;`,
    );
  }, [payload]);

  // Push every change into the already-running page.
  useEffect(() => {
    push();
  }, [push]);

  // If the page never reports "ready" (no internet / blocked CDN) show the retry UI.
  useEffect(() => {
    if (ready || failed) return;
    const timer = setTimeout(() => setFailed(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready, failed, reloadKey]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg?.type === "ready") {
          readyRef.current = true;
          setReady(true);
          setFailed(false);
          push();
        } else if (msg?.type === "error") {
          console.log("OsmMap error:", msg.message);
          if (!readyRef.current) setFailed(true);
        } else if (msg?.type === "press") {
          onMarkerPress?.(msg.kind as MapMarkerKind);
        }
      } catch (e) {
        console.log("OsmMap message error:", e);
      }
    },
    [push, onMarkerPress],
  );

  const retry = useCallback(() => {
    readyRef.current = false;
    setReady(false);
    setFailed(false);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={`${reloadKey}-${dark ? "d" : "l"}`}
        ref={webRef}
        source={{ html, baseUrl: BASE_URL }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        cacheEnabled
        onMessage={onMessage}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        style={styles.web}
      />

      {!ready && !failed ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#f95509" />
        </View>
      ) : null}

      {failed && !ready ? (
        <View style={[styles.overlay, styles.errorBox]}>
          <Text style={styles.errorTitle}>{errorTitle}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>{retryLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: "#e8e8e8" },
  web: { flex: 1, backgroundColor: "transparent" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: { backgroundColor: "rgba(255,255,255,0.92)", padding: 16 },
  errorTitle: { fontSize: 16, fontWeight: "600", color: "#212121", marginBottom: 12 },
  retryBtn: {
    backgroundColor: "#f95509",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
});

export default memo(OsmMap);
