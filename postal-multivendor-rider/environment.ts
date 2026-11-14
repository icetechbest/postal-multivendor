import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { useContext } from "react";
import { ConfigurationContext } from "./lib/context/global/configuration.context";

const DEFAULT_MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_GEOCODING_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_ROUTING_URL = "https://router.project-osrm.org";

/**
 * Values that come only from the build environment.
 * Safe to call anywhere (it is NOT a hook), e.g. when creating the Apollo client.
 * Note: `process.env.EXPO_PUBLIC_*` must be read literally so Expo can inline it.
 */
export const getStaticEnvVars = () => ({
  GRAPHQL_URL:
    process.env.EXPO_PUBLIC_GRAPHQL_URL || "https://postal-multivendor-production-573f.up.railway.app/graphql",
  WS_GRAPHQL_URL:
    process.env.EXPO_PUBLIC_WS_GRAPHQL_URL || "wss://postal-multivendor-production-573f.up.railway.app/graphql",
  ENVIRONMENT: __DEV__ ? "development" : "production",
});

if (__DEV__) {
  loadDevMessages();
  loadErrorMessages();
}

/**
 * Hook: build-time values + the map URLs that can be overridden from the
 * backend Configuration. Call it only inside React components / hooks.
 */
const getEnvVars = () => {
  const configuration = useContext(ConfigurationContext);
  return {
    ...getStaticEnvVars(),
    MAP_TILE_URL:
      configuration?.mapTileUrl ||
      process.env.EXPO_PUBLIC_MAP_TILE_URL ||
      DEFAULT_MAP_TILE_URL,
    GEOCODING_URL:
      configuration?.geocodingUrl ||
      process.env.EXPO_PUBLIC_GEOCODING_URL ||
      DEFAULT_GEOCODING_URL,
    ROUTING_URL:
      configuration?.routingUrl ||
      process.env.EXPO_PUBLIC_ROUTING_URL ||
      DEFAULT_ROUTING_URL,
  };
};

export default getEnvVars;
