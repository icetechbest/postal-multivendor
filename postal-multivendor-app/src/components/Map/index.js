// Drop-in replacement for react-native-maps that does NOT use Google Maps.
// The basemap is OpenStreetMap raster tiles drawn inside a WebView (see html.js);
// markers / polygons / polylines are React Native views drawn on top of it,
// positioned with the same Web Mercator maths the WebView uses.
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native'
import { WebView } from 'react-native-webview'
import Svg, { Polygon as SvgPolygon, Polyline as SvgPolyline } from 'react-native-svg'
import useEnvVars from '../../../environment'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { getLocationFromStorage } from '../../ui/hooks/useWatchLocation'
import buildHtml from './html'

const TILE = 256
const DEFAULT_REGION = { latitude: 30.0444, longitude: 31.2357, latitudeDelta: 0.1, longitudeDelta: 0.1 }

const MapContext = createContext(null)

// ---- projection helpers (must match html.js) ----
const mercX = (lng) => (lng + 180) / 360
const mercY = (lat) => {
  const c = Math.max(-85.0511, Math.min(85.0511, lat))
  const s = Math.sin((c * Math.PI) / 180)
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
}
const toPoint = (view, lat, lng) => {
  const s = TILE * Math.pow(2, view.zoom)
  const cx = mercX(view.lng)
  let dx = mercX(lng) - cx
  // pick the copy of the world closest to the centre
  if (dx > 0.5) dx -= 1
  else if (dx < -0.5) dx += 1
  return {
    x: dx * s + view.w / 2,
    y: (mercY(lat) - mercY(view.lat)) * s + view.h / 2
  }
}

const near = (a, b) =>
  !!a &&
  !!b &&
  Math.abs(a.latitude - b.latitude) < 1e-6 &&
  Math.abs(a.longitude - b.longitude) < 1e-6 &&
  Math.abs(a.latitudeDelta - b.latitudeDelta) <= Math.abs(b.latitudeDelta) * 1e-3 + 1e-9 &&
  Math.abs(a.longitudeDelta - b.longitudeDelta) <= Math.abs(b.longitudeDelta) * 1e-3 + 1e-9

const validRegion = (r) =>
  r &&
  Number.isFinite(+r.latitude) &&
  Number.isFinite(+r.longitude) &&
  Number.isFinite(+r.latitudeDelta) &&
  Number.isFinite(+r.longitudeDelta)

export const PROVIDER_DEFAULT = null // kept so old imports keep working
export const UrlTile = () => null // tiles are built into MapView

const MapView = forwardRef(function MapView(props, ref) {
  const {
    style,
    children,
    initialRegion,
    region,
    scrollEnabled = true,
    zoomEnabled = true,
    zoomControlEnabled = false,
    minZoomLevel,
    maxZoomLevel,
    showsUserLocation = false,
    onMapReady,
    onRegionChangeComplete,
    onPress
  } = props

  const { MAP_TILE_URL, SERVER_URL } = useEnvVars()
  const themeContext = useContext(ThemeContext)
  const isDark = themeContext?.ThemeValue === 'Dark'

  const webRef = useRef(null)
  const readyRef = useRef(false)
  const queueRef = useRef([])
  const lastRegionRef = useRef(null)
  const callbacks = useRef({})
  callbacks.current = { onMapReady, onRegionChangeComplete, onPress }

  const [view, setView] = useState(null)
  const [userPos, setUserPos] = useState(null)

  const startRegion = useRef(
    validRegion(initialRegion) ? initialRegion : validRegion(region) ? region : DEFAULT_REGION
  ).current

  // The HTML is built once: later changes are sent as commands so the
  // WebView never reloads (which would flash and drop the tiles).
  const html = useMemo(
    () =>
      buildHtml({
        tileUrl: MAP_TILE_URL,
        region: {
          latitude: +startRegion.latitude,
          longitude: +startRegion.longitude,
          latitudeDelta: +startRegion.latitudeDelta,
          longitudeDelta: +startRegion.longitudeDelta
        },
        scroll: scrollEnabled !== false,
        zoom: zoomEnabled !== false,
        zoomControl: !!zoomControlEnabled,
        minZoom: Number.isFinite(+minZoomLevel) && minZoomLevel > 0 ? +minZoomLevel : 1,
        maxZoom: Number.isFinite(+maxZoomLevel) && maxZoomLevel > 0 ? +maxZoomLevel : 21,
        dark: isDark
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const send = useCallback((cmd) => {
    if (!readyRef.current) {
      queueRef.current.push(cmd)
      return
    }
    webRef.current?.injectJavaScript(`window.__cmd(${JSON.stringify(cmd)});true;`)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (r, duration = 500) => {
        if (validRegion(r)) send({ k: 'region', r: { ...r }, ms: duration })
      },
      animateCamera: (cam, opts) => {
        const c = cam?.center
        if (!c) return
        send({ k: 'camera', lat: +c.latitude, lng: +c.longitude, zoom: cam.zoom, ms: opts?.duration ?? 500 })
      },
      setCamera: (cam) => {
        const c = cam?.center
        if (!c) return
        send({ k: 'camera', lat: +c.latitude, lng: +c.longitude, zoom: cam.zoom, ms: 0 })
      },
      fitToCoordinates: (coords, opts) => {
        const pts = (coords || [])
          .map((p) => ({ latitude: +p.latitude, longitude: +p.longitude }))
          .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        if (!pts.length) return
        send({ k: 'fit', pts, pad: opts?.edgePadding, ms: opts?.animated === false ? 0 : 400 })
      },
      getCamera: async () =>
        view ? { center: { latitude: view.lat, longitude: view.lng }, zoom: view.zoom } : null
    }),
    [send, view]
  )

  // controlled `region` prop
  useEffect(() => {
    if (!validRegion(region)) return
    const last = lastRegionRef.current || startRegion
    if (near(last, region)) return
    send({ k: 'region', r: { ...region }, ms: 0 })
  }, [region?.latitude, region?.longitude, region?.latitudeDelta, region?.longitudeDelta]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    send({ k: 'dark', v: isDark })
  }, [isDark, send])

  useEffect(() => {
    if (!showsUserLocation) return
    let alive = true
    getLocationFromStorage()
      .then((loc) => {
        if (alive && loc && Number.isFinite(+loc.latitude)) setUserPos({ latitude: +loc.latitude, longitude: +loc.longitude })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [showsUserLocation])

  const onMessage = useCallback(
    (e) => {
      let m
      try {
        m = JSON.parse(e.nativeEvent.data)
      } catch (err) {
        return
      }
      switch (m.t) {
        case 'ready':
          readyRef.current = true
          lastRegionRef.current = m.r
          setView(m.s)
          queueRef.current.splice(0).forEach(send)
          callbacks.current.onMapReady?.()
          break
        case 'move':
          setView(m.s)
          break
        case 'end':
          lastRegionRef.current = m.r
          setView(m.s)
          callbacks.current.onRegionChangeComplete?.(m.r)
          break
        case 'tap':
          callbacks.current.onPress?.({ nativeEvent: { coordinate: { latitude: m.lat, longitude: m.lng } } })
          break
        case 'link':
          if (typeof m.url === 'string' && m.url.startsWith('https://')) Linking.openURL(m.url).catch(() => {})
          break
      }
    },
    [send]
  )

  const ctx = useMemo(() => (view ? { view, toPoint: (lat, lng) => toPoint(view, lat, lng) } : null), [view])

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        style={styles.web}
        originWhitelist={['*']}
        source={{ html, baseUrl: SERVER_URL }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode='never'
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        mixedContentMode='always'
        allowsInlineMediaPlayback
        automaticallyAdjustContentInsets={false}
        onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith(SERVER_URL) || req.url.startsWith('data:')}
      />
      <View style={styles.overlay} pointerEvents='box-none'>
        <MapContext.Provider value={ctx}>
          {ctx ? children : null}
          {ctx && userPos ? <UserDot coordinate={userPos} /> : null}
        </MapContext.Provider>
      </View>
    </View>
  )
})

const UserDot = ({ coordinate }) => {
  const ctx = useContext(MapContext)
  if (!ctx) return null
  const { x, y } = ctx.toPoint(coordinate.latitude, coordinate.longitude)
  return (
    <View pointerEvents='none' style={[styles.userDotOuter, { left: x - 11, top: y - 11 }]}>
      <View style={styles.userDotInner} />
    </View>
  )
}

export const Marker = ({ coordinate, children, onPress, style, anchor }) => {
  const ctx = useContext(MapContext)
  const [size, setSize] = useState(null)
  if (!ctx || !coordinate) return null
  const lat = +coordinate.latitude
  const lng = +coordinate.longitude
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const { x, y } = ctx.toPoint(lat, lng)
  if (x < -200 || y < -200 || x > ctx.view.w + 200 || y > ctx.view.h + 200) return null

  // no children => classic pin whose tip sits on the coordinate
  const content = children || <DefaultPin />
  const a = anchor || (children ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 })
  const w = size?.w || 0
  const h = size?.h || 0

  // Positioned with a transform (not left/top inside a 0-size box) so that the
  // real, measured bounds receive touches on Android too.
  return (
    <View
      pointerEvents={onPress ? 'box-none' : 'none'}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        if (!size || Math.abs(size.w - width) > 0.5 || Math.abs(size.h - height) > 0.5) setSize({ w: width, h: height })
      }}
      style={[styles.marker, { opacity: size ? 1 : 0, transform: [{ translateX: x - w * a.x }, { translateY: y - h * a.y }] }]}
    >
      {onPress ? (
        <TouchableOpacity activeOpacity={0.8} onPress={() => onPress({ nativeEvent: { coordinate: { latitude: lat, longitude: lng } } })}>
          <View style={style}>{content}</View>
        </TouchableOpacity>
      ) : (
        <View style={style}>{content}</View>
      )}
    </View>
  )
}

const DefaultPin = () => (
  <View style={styles.pinWrap}>
    <View style={styles.pinHead}>
      <View style={styles.pinDot} />
    </View>
    <View style={styles.pinTip} />
  </View>
)

const useScreenPoints = (coordinates) => {
  const ctx = useContext(MapContext)
  if (!ctx || !coordinates?.length) return null
  return coordinates
    .filter((c) => Number.isFinite(+c?.latitude) && Number.isFinite(+c?.longitude))
    .map((c) => {
      const p = ctx.toPoint(+c.latitude, +c.longitude)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')
}

export const Polyline = ({ coordinates, strokeColor = '#000', strokeWidth = 3 }) => {
  const points = useScreenPoints(coordinates)
  if (!points) return null
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents='none'>
      <SvgPolyline points={points} fill='none' stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin='round' strokeLinecap='round' />
    </Svg>
  )
}

export const Polygon = ({ coordinates, strokeColor = '#000', fillColor = 'rgba(255,0,0,0.5)', strokeWidth = 1 }) => {
  const points = useScreenPoints(coordinates)
  if (!points) return null
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents='none'>
      <SvgPolygon points={points} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin='round' />
    </Svg>
  )
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#e5e3df' },
  web: { flex: 1, backgroundColor: 'transparent' },
  overlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  marker: { position: 'absolute', left: 0, top: 0, alignSelf: 'flex-start' },
  userDotOuter: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(66,133,244,0.25)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4285F4', borderWidth: 2, borderColor: '#fff' },
  pinWrap: { alignItems: 'center' },
  pinHead: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  pinTip: {
    width: 0,
    height: 0,
    marginTop: -3,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#E53935'
  }
})

export default MapView
