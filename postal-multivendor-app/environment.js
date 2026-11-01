import { useContext } from 'react'
import Constants from 'expo-constants'
import ConfigurationContext from './src/context/Configuration'

export const isProduction = process.env.NODE_ENV === 'production'

// Existing native IDs remain fallbacks; database configuration can override them.
const GOOGLE_IDS = {
  web: '650001300965-9ochl634tuvv6iguei6dl57jkmfto6r9.apps.googleusercontent.com',
  android: '650001300965-ii3nafver2uiu4qat9gbde9rkmhmvj0j.apps.googleusercontent.com',
  ios: '650001300965-dkji7jutv8gc5m4n7cdg3nft87sauhn7.apps.googleusercontent.com'
}

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
    IOS_CLIENT_ID_GOOGLE: configuration?.iOSClientID || GOOGLE_IDS.ios,
    ANDROID_CLIENT_ID_GOOGLE: configuration?.androidClientID || GOOGLE_IDS.android,
    EXPO_CLIENT_ID: configuration?.expoClientID || GOOGLE_IDS.web,
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
