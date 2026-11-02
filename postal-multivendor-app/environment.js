import { useContext } from 'react'
import Constants from 'expo-constants'
import ConfigurationContext from './src/context/Configuration'

export const isProduction = process.env.NODE_ENV === 'production'

const trimTrailingSlash = value => value.replace(/\/+$/, '')
const configuredServerUrl =
  process.env.EXPO_PUBLIC_SERVER_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000'
const SERVER_REST_URL = `${trimTrailingSlash(configuredServerUrl)}/`
const GRAPHQL_URL = process.env.EXPO_PUBLIC_GRAPHQL_URL || `${SERVER_REST_URL}graphql`
const WS_GRAPHQL_URL =
  process.env.EXPO_PUBLIC_WS_GRAPHQL_URL || GRAPHQL_URL.replace(/^http/, 'ws')

const useEnvVars = () => {
  const configuration = useContext(ConfigurationContext)
  return {
    GRAPHQL_URL,
    WS_GRAPHQL_URL,
    SERVER_URL: SERVER_REST_URL,
    SERVER_REST_URL,
    AMPLITUDE_API_KEY: configuration?.appAmplitudeApiKey,
    MAP_TILE_URL:
      configuration?.mapTileUrl ||
      process.env.EXPO_PUBLIC_MAP_TILE_URL ||
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    GEOCODING_URL:
      configuration?.geocodingUrl ||
      process.env.EXPO_PUBLIC_GEOCODING_URL ||
      'https://nominatim.openstreetmap.org',
    ROUTING_URL:
      configuration?.routingUrl ||
      process.env.EXPO_PUBLIC_ROUTING_URL ||
      'https://router.project-osrm.org',
    TERMS_AND_CONDITIONS: configuration?.termsAndConditions,
    PRIVACY_POLICY: configuration?.privacyPolicy,
    IOS_STORE_URL: configuration?.appleStoreUrl || process.env.EXPO_PUBLIC_IOS_STORE_URL,
    ANDROID_STORE_URL:
      configuration?.playStoreUrl ||
      process.env.EXPO_PUBLIC_ANDROID_STORE_URL ||
      'https://play.google.com/store/apps/details?id=com.postal.customer',
    TEST_OTP: configuration?.testOtp
  }
}

export default useEnvVars
