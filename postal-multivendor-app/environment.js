// TODO(rebrand): replace placeholder(s): YOUR-BACKEND.up.railway.app
// /*****************************
//  * environment.js
//  * path: '/environment.js' (root of your project)
//  ******************************/

import { useContext } from 'react'
import ConfigurationContext from './src/context/Configuration'
import * as Updates from 'expo-updates'

const useEnvVars = (env = Updates.channel) => {
  const configuration = useContext(ConfigurationContext)
  if (env === 'production' || env === 'staging') {
    return {
      GRAPHQL_URL: 'https://YOUR-BACKEND.up.railway.app/graphql',
      WS_GRAPHQL_URL: 'wss://YOUR-BACKEND.up.railway.app/graphql',
      SERVER_URL: 'https://YOUR-BACKEND.up.railway.app/graphql',
      SERVER_REST_URL: 'https://YOUR-BACKEND.up.railway.app/',
      IOS_CLIENT_ID_GOOGLE: configuration?.iOSClientID,
      ANDROID_CLIENT_ID_GOOGLE: configuration?.androidClientID,
      AMPLITUDE_API_KEY: configuration?.appAmplitudeApiKey,
      GOOGLE_MAPS_KEY: configuration?.googleApiKey,
      EXPO_CLIENT_ID: configuration?.expoClientID,
      TERMS_AND_CONDITIONS: configuration?.termsAndConditions,
      PRIVACY_POLICY: configuration?.privacyPolicy,
      TEST_OTP: configuration?.testOtp,
      GOOGLE_PACES_API_BASE_URL: configuration?.googlePlacesApiBaseUrl
    }
  }

  return {
    GRAPHQL_URL: 'http://192.168.18.107:8001/graphql',
    WS_GRAPHQL_URL: 'ws://192.168.18.107:8001/graphql',
    SERVER_URL: 'http://192.168.18.107:8001/graphql',
    SERVER_REST_URL: 'http://192.168.18.107:8001/',
    // GRAPHQL_URL: 'https://YOUR-BACKEND.up.railway.app/graphql',
    // WS_GRAPHQL_URL: 'wss://YOUR-BACKEND.up.railway.app/graphql',
    // SERVER_URL: 'https://YOUR-BACKEND.up.railway.app/graphql',
    // SERVER_REST_URL: 'https://YOUR-BACKEND.up.railway.app/',
    IOS_CLIENT_ID_GOOGLE: configuration?.iOSClientID,
    ANDROID_CLIENT_ID_GOOGLE: configuration?.androidClientID,
    AMPLITUDE_API_KEY: configuration?.appAmplitudeApiKey,
    GOOGLE_MAPS_KEY: configuration?.googleApiKey,
    EXPO_CLIENT_ID: configuration?.expoClientID,
    TERMS_AND_CONDITIONS: configuration?.termsAndConditions,
    PRIVACY_POLICY: configuration?.privacyPolicy,
    TEST_OTP: configuration?.testOtp,
    GOOGLE_PACES_API_BASE_URL: configuration?.googlePlacesApiBaseUrl
  }
}

export default useEnvVars
