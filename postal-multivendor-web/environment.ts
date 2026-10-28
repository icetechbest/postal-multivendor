// TODO(rebrand): replace placeholder(s): YOUR-BACKEND-DEV.up.railway.app, YOUR-BACKEND-STAGE.up.railway.app, YOUR-BACKEND.up.railway.app
export default function getEnv(env: "DEV" | "STAGE" | "PROD") {
  switch (env) {
    case "DEV":
      return {
        SERVER_URL:
          "https://YOUR-BACKEND-DEV.up.railway.app/",
        WS_SERVER_URL:
          "wss://YOUR-BACKEND-DEV.up.railway.app/",
      };
    case "STAGE":
      return {
        SERVER_URL: "https://YOUR-BACKEND-STAGE.up.railway.app/",
        WS_SERVER_URL: "wss://YOUR-BACKEND-STAGE.up.railway.app/",
      };
    case "PROD":
      return {
        SERVER_URL: "https://YOUR-BACKEND.up.railway.app/",
        WS_SERVER_URL: "wss://YOUR-BACKEND.up.railway.app/",
      };
    default:
      return {
        SERVER_URL: "https://YOUR-BACKEND.up.railway.app/",
        WS_SERVER_URL: "wss://YOUR-BACKEND.up.railway.app/",

        // SERVER_URL: "http://localhost:8001/",
        // WS_SERVER_URL: "ws://localhost:8001/",
      };
  }
}
