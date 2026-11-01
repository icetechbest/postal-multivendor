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
    MAP_TILE_URL:
      configuration?.mapTileUrl ||
      process.env.EXPO_PUBLIC_MAP_TILE_URL ||
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    GEOCODING_URL:
      configuration?.geocodingUrl ||
      process.env.EXPO_PUBLIC_GEOCODING_URL ||
      "https://nominatim.openstreetmap.org",
    ROUTING_URL:
      configuration?.routingUrl ||
      process.env.EXPO_PUBLIC_ROUTING_URL ||
      "https://router.project-osrm.org",
    ENVIRONMENT: __DEV__ ? "development" : "production",
  };
};

export default getEnvVars;
