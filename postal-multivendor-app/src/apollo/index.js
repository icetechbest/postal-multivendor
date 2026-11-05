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
    link: concat(ApolloLink.from([terminatingLink, requestLink, errorReporter, retryLink]), httpLink),
    cache,
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' }
    },
    resolvers: {}
  })

  return client
}

export default setupApollo
