import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
  split,
  concat,
  Observable
} from '@apollo/client'
import {
  getMainDefinition,
  offsetLimitPagination
} from '@apollo/client/utilities'
import { WebSocketLink } from '@apollo/client/link/ws'
import { RetryLink } from '@apollo/client/link/retry'
import { onError } from '@apollo/client/link/error'
import NetInfo from '@react-native-community/netinfo'
import i18next from 'i18next'
import { showMessage } from 'react-native-flash-message'
import { describeError } from '../utils/describeError'
import useEnvVars from '../../environment'
import { useContext } from 'react'
import { LocationContext } from '../context/Location'
import { calculateDistance } from '../utils/customFunctions'

const CACHE_KEY = 'apollo-cache-v1'
// AsyncStorage on Android cannot read a single value larger than ~2MB.
const CACHE_MAX_BYTES = 1800000
const RESTORE_TIMEOUT_MS = 1500

// Live / user-specific order data must never come back stale from disk
// (an old "active order" would flash the tracking sheet before the refresh lands).
const isVolatileKey = (key) => key.startsWith('Order:') || key.startsWith('ChatMessage:')
const isVolatileRootField = (field) => /^(orders|order|chat|activeOrders)\b/.test(field)

const sanitizeForDisk = (data) => {
  const out = {}
  Object.keys(data).forEach((key) => {
    if (key === 'ROOT_MUTATION' || key === 'ROOT_SUBSCRIPTION' || isVolatileKey(key)) return
    if (key === 'ROOT_QUERY') {
      const root = {}
      Object.keys(data[key]).forEach((field) => {
        if (!isVolatileRootField(field)) root[field] = data[key][field]
      })
      out[key] = root
      return
    }
    out[key] = data[key]
  })
  return out
}

const setupApollo = () => {
  const { GRAPHQL_URL, WS_GRAPHQL_URL } = useEnvVars()

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          _id: {
            keyArgs: ['string']
          },
          orders: offsetLimitPagination()
        }
      },
      Category: {
        fields: {
          foods: {
            merge(_existing, incoming) {
              return incoming
            }
          }
        }
      },
      Food: {
        fields: {
          variations: {
            merge(_existing, incoming) {
              return incoming
            }
          }
        }
      },
      RestaurantPreview: {
        fields: {
          distanceWithCurrentLocation: {
            read(_existing, {variables, field, readField}) {
              const restaurantLocation = readField('location')
              const distance = calculateDistance(restaurantLocation?.coordinates[0], restaurantLocation?.coordinates[1], variables.latitude, variables.longitude)
              return distance
            }
          }
        }
      }
    }
  })

  // ---- Offline-first cache: the app opens with the last data it saw and refreshes behind it,
  // so a slow server only delays the refresh, never the screen. ----
  let persistTimer = null
  const persistNow = async () => {
    try {
      const json = JSON.stringify(sanitizeForDisk(cache.extract()))
      if (json.length > CACHE_MAX_BYTES) {
        await AsyncStorage.removeItem(CACHE_KEY)
        return
      }
      await AsyncStorage.setItem(CACHE_KEY, json)
    } catch (e) {}
  }
  const schedulePersist = () => {
    if (persistTimer) return
    persistTimer = setTimeout(() => {
      persistTimer = null
      persistNow()
    }, 2500)
  }
  const persistLink = new ApolloLink((operation, forward) =>
    forward(operation).map((result) => {
      if (!result?.errors?.length) schedulePersist()
      return result
    })
  )
  const restoreCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY)
      if (raw) cache.restore(JSON.parse(raw))
    } catch (e) {
      // a corrupted cache must never block the app
      AsyncStorage.removeItem(CACHE_KEY).catch(() => {})
    }
  }

  // A request that hangs on a weak connection would leave the screen spinning forever:
  // give up after 30s so the user gets an error/retry instead.
  const fetchWithTimeout = (uri, options) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    return fetch(uri, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
  }

  const httpLink = createHttpLink({
    uri: GRAPHQL_URL,
    fetch: fetchWithTimeout
  })

  // Transient network failures are retried quietly (queries only: re-sending a
  // mutation such as placeOrder could be applied twice).
  const retryLink = new RetryLink({
    delay: { initial: 400, max: 3000, jitter: true },
    attempts: (count, operation, error) => {
      if (!error || count >= 3) return false
      const def = getMainDefinition(operation.query)
      return def.kind === 'OperationDefinition' && def.operation === 'query'
    }
  })

  const wsLink = new WebSocketLink({
    uri: WS_GRAPHQL_URL,
    options: {
      reconnect: true,
      connectionParams: async () => {
        const token = await AsyncStorage.getItem('token')
        return { authorization: token ? `Bearer ${token}` : '' }
      }
    }
  })

  // Tells the user WHY a request failed (offline / server down / timeout ...), once every 8s.
  // Sits outside the retry link, so it only fires after the retries have been used up.
  let lastNetworkErrorAt = 0
  const errorReporter = onError(({ networkError, operation }) => {
    if (!networkError) return
    // A background refresh that failed while cached data is on screen is invisible to the user.
    try {
      const def = getMainDefinition(operation.query)
      if (def.operation === 'query') {
        const diff = cache.diff({
          query: operation.query,
          variables: operation.variables,
          returnPartialData: false,
          optimistic: false
        })
        if (diff?.complete) return
      }
    } catch (e) {}
    const now = Date.now()
    if (now - lastNetworkErrorAt < 8000) return
    lastNetworkErrorAt = now
    const show = (isConnected) => {
      try {
        const reason = describeError({ networkError }, i18next.t.bind(i18next), { isConnected })
        showMessage({
          message: reason,
          description: operation?.operationName || undefined,
          type: 'danger',
          duration: 5000
        })
      } catch (e) {}
    }
    NetInfo.fetch()
      .then((state) => show(state.isConnected !== false && state.isInternetReachable !== false))
      .catch(() => show(undefined))
  })

  const request = async operation => {
    const token = await AsyncStorage.getItem('token')

    operation.setContext({
      headers: {
        authorization: token ? `Bearer ${token}` : ''
      }
    })
  }

  const requestLink = new ApolloLink(
    (operation, forward) =>
      new Observable(observer => {
        let handle
        Promise.resolve(operation)
          .then(oper => request(oper))
          .then(() => {
            handle = forward(operation).subscribe({
              next: observer.next.bind(observer),
              error: observer.error.bind(observer),
              complete: observer.complete.bind(observer)
            })
          })
          .catch(observer.error.bind(observer))

        return () => {
          if (handle) handle.unsubscribe()
        }
      })
  )

  const terminatingLink = split(({ query }) => {
    const { kind, operation } = getMainDefinition(query)
    return kind === 'OperationDefinition' && operation === 'subscription'
  }, wsLink)

  const client = new ApolloClient({
    link: concat(ApolloLink.from([terminatingLink, requestLink, persistLink, errorReporter, retryLink]), httpLink),
    cache,
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' }
    },
    resolvers: {}
  })

  // Never keep one user's data on disk after logout / store reset.
  client.onResetStore(async () => {
    AsyncStorage.removeItem(CACHE_KEY).catch(() => {})
  })
  client.onClearStore(async () => {
    AsyncStorage.removeItem(CACHE_KEY).catch(() => {})
  })

  // Resolves when the saved cache is loaded (or after a short timeout, whichever is first).
  client.cacheReady = Promise.race([
    restoreCache(),
    new Promise((resolve) => setTimeout(resolve, RESTORE_TIMEOUT_MS))
  ])

  return client
}

export default setupApollo
