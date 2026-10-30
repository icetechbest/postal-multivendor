import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { useContext } from "react";
import { ConfigurationContext } from "./lib/context/global/configuration.context";

const getEnvVars = () => {
  const configuration = useContext(ConfigurationContext);
  if (__DEV__) {
    loadDevMessages();
    loadErrorMessages();
  }
  return {
    GRAPHQL_URL: process.env.EXPO_PUBLIC_GRAPHQL_URL || "http://localhost:8001/graphql",
    WS_GRAPHQL_URL: process.env.EXPO_PUBLIC_WS_GRAPHQL_URL || "ws://localhost:8001/graphql",
    GOOGLE_MAPS_KEY: configuration?.googleApiKey,
    ENVIRONMENT: __DEV__ ? "development" : "production",
  };
};

export default getEnvVars;
