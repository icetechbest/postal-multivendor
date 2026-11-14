const getEnvVars = () => ({
  GRAPHQL_URL: process.env.EXPO_PUBLIC_GRAPHQL_URL || "http://localhost:8001/graphql",
  WS_GRAPHQL_URL: process.env.EXPO_PUBLIC_WS_GRAPHQL_URL || "ws://localhost:8001/graphql",
});

export default getEnvVars;
