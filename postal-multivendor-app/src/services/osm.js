import axios from 'axios'

// OpenStreetMap services (Nominatim + OSRM). No API key / no billing.
// Nominatim usage policy requires a descriptive User-Agent and at most 1 req/s.
const OSM_USER_AGENT = 'PostalMultivendor/1.0 (https://postal.example.com)'
const MIN_INTERVAL_MS = 1000
const CACHE_TTL_MS = 5 * 60 * 1000

let lastRequestAt = 0
const cache = new Map()

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Serialise requests so we never exceed 1 request/second to Nominatim.
// A plain "read lastRequestAt -> await -> write" sequence is racy: concurrent
// callers all read the same stale value and then fire at the same instant.
// Chaining the calls guarantees only one request is in flight at a time.
let throttleChain = Promise.resolve()

const throttledGet = (url, params) => {
  const run = throttleChain.then(async () => {
    const waitMs = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt))
    if (waitMs > 0) await wait(waitMs)
    lastRequestAt = Date.now()
    return axios.get(url, {
      params,
      headers: { 'User-Agent': OSM_USER_AGENT, Accept: 'application/json' },
      timeout: 10000
    })
  })
  // Keep the chain alive even when a request fails.
  throttleChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

const cacheGet = (key) => {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.value
}

const cacheSet = (key, value) => {
  cache.set(key, { at: Date.now(), value })
}

const trimBase = (baseUrl) => String(baseUrl || '').replace(/\/+$/, '')

// Reverse geocoding: coordinates -> { formattedAddress, city }
export const reverseGeocode = async (baseUrl, latitude, longitude) => {
  const key = `rev:${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`
  const cached = cacheGet(key)
  if (cached) return cached

  const { data } = await throttledGet(`${trimBase(baseUrl)}/reverse`, {
    format: 'jsonv2',
    lat: latitude,
    lon: longitude,
    addressdetails: 1,
    'accept-language': 'en'
  })

  const address = data?.address || {}
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state ||
    null
  const formattedAddress = data?.display_name || ''
  const result = { formattedAddress, city }
  cacheSet(key, result)
  return result
}

// Forward search: query -> array of results shaped like the old Places predictions.
export const searchPlaces = async (baseUrl, query, options = {}) => {
  const limit = options.limit || 5
  const key = `search:${limit}:${String(query).trim().toLowerCase()}`
  const cached = cacheGet(key)
  if (cached) return cached

  const { data } = await throttledGet(`${trimBase(baseUrl)}/search`, {
    format: 'jsonv2',
    q: query,
    addressdetails: 1,
    limit,
    'accept-language': 'en'
  })

  const results = (Array.isArray(data) ? data : []).map((item) => {
    const address = item.address || {}
    const mainText =
      item.name || address.road || (item.display_name || '').split(',')[0] || ''
    return {
      id: String(item.place_id),
      placeId: String(item.place_id),
      description: item.display_name || mainText,
      mainText,
      secondaryText: item.display_name || '',
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon)
    }
  })

  cacheSet(key, results)
  return results
}

// Routing: two points -> { coordinates, distance, duration } using OSRM.
export const getRoute = async (baseUrl, origin, destination) => {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`
  const key = `route:${coords}`
  const cached = cacheGet(key)
  if (cached) return cached

  const { data } = await throttledGet(
    `${trimBase(baseUrl)}/route/v1/driving/${coords}`,
    { overview: 'full', geometries: 'geojson' }
  )

  if (!data?.routes?.length) {
    throw new Error('No route found')
  }

  const route = data.routes[0]
  const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng
  }))

  const result = { coordinates, distance: route.distance, duration: route.duration }
  cacheSet(key, result)
  return result
}
