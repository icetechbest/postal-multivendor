// TODO(rebrand): replace placeholder(s): YOUR-BACKEND.up.railway.app
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import * as Updates from "expo-updates";
import { useContext } from "react";
import { ConfigurationContext } from "./lib/context/global/configuration.context";
const getEnvVars = (env = Updates.channel) => {
  const configuration = useContext(ConfigurationContext);
  if (__DEV__) {
    loadDevMessages();
    loadErrorMessages();
  }
  if (!__DEV__) {
    return {
      // GRAPHQL_URL: "https://YOUR-BACKEND.up.railway.app/graphql",
      // WS_GRAPHQL_URL: "wss://YOUR-BACKEND.up.railway.app/graphql",
      GRAPHQL_URL: "https://YOUR-BACKEND.up.railway.app/graphql",
      WS_GRAPHQL_URL: "wss://YOUR-BACKEND.up.railway.app/graphql",
      // GOOGLE_MAPS_KEY: 'AIzaSyBk4tvTtPaSEAVSvaao2yISz4m8Q-BeE1M',
      GOOGLE_MAPS_KEY:configuration?.googleApiKey,
      ENVIRONMENT: "production",
    };
  }

  return {
      GRAPHQL_URL: "https://YOUR-BACKEND.up.railway.app/graphql",
      WS_GRAPHQL_URL: "wss://YOUR-BACKEND.up.railway.app/graphql",
    // GOOGLE_MAPS_KEY: 'AIzaSyBk4tvTtPaSEAVSvaao2yISz4m8Q-BeE1M',
    GOOGLE_MAPS_KEY:configuration?.googleApiKey,
    ENVIRONMENT: "development",
  };
};

export default getEnvVars;
