# Postal · Order Confirmation Console

Standalone Next.js 14 console for the operations team to confirm or reject incoming
orders in real time. It talks to the existing Postal GraphQL API — no backend rewrite.

## Features

- Email + password sign-in against the existing `login` mutation. Access tokens live in
  memory only; the refresh token is stored in an `httpOnly` cookie by Next.js route
  handlers and rotated on every refresh.
- Live queue of `AWAITING_ADMIN` orders, oldest first, with a live “waiting for X min”
  timer that turns amber and then red at configurable thresholds.
- Realtime updates over `graphql-ws` (`subscriptionPendingOrders`), with sound alert,
  browser notification and a `(N) New orders` title badge. Automatic reconnect with
  exponential backoff and a 15-second polling fallback when the socket drops.
- Confirm (optional note) and reject (required reason with quick-pick reasons) actions.
  If another operator handled the order first, the card is removed and a clear toast is
  shown instead of a generic error.
- Order details drawer with items, variations, add-ons/options, notes, coupon, tips,
  delivery fee and taxes.
- Search, pagination, and counters for pending now / confirmed today / rejected today.
- Arabic and English with full RTL support, light and dark themes.
- Mobile responsive, keyboard shortcuts (`↑`/`↓` to move, `C` confirm, `R` reject).

## Requirements

- Node.js 20+
- A running Postal backend exposing GraphQL at `POST /graphql` and `WS /graphql`
- An `ADMIN` or `STAFF` account. Other roles are redirected to `/forbidden`.

## Environment variables

Copy `.env.example` to the environment file you need (`.env.dev`, `.env.stage`,
`.env.prod`) and fill in the values. Never commit real `.env` files.

| Variable | Description | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_SERVER_URL` | Backend base URL (HTTP) | `http://localhost:8001` |
| `NEXT_PUBLIC_WS_SERVER_URL` | Backend base URL (WebSocket) | `ws://localhost:8001` |
| `NEXT_PUBLIC_WARN_MINUTES` | Minutes before a waiting order turns amber | `5` |
| `NEXT_PUBLIC_DANGER_MINUTES` | Minutes before it turns red | `10` |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | Polling fallback interval | `15000` |

`NEXT_PUBLIC_*` values are inlined at build time, so rebuild the image whenever they
change.

## Local development

```bash
npm install
cp .env.example .env.dev
npm run dev          # http://localhost:3002
```

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run lint
npm run build && npm start
npm run cy:open      # Cypress UI
npm run test:e2e     # starts the dev server and runs Cypress headless
```

## Docker

```bash
docker compose build
docker compose up -d
```

The compose file passes the public URLs as build arguments. Override them with a `.env`
file next to `docker-compose.yml` (Compose reads it automatically):

```dotenv
NEXT_PUBLIC_SERVER_URL=https://api.example.com
NEXT_PUBLIC_WS_SERVER_URL=wss://api.example.com
CONSOLE_PORT=3002
```

Or build directly:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SERVER_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_WS_SERVER_URL=wss://api.example.com \
  -t postal-order-console .
docker run -p 3002:3002 postal-order-console
```

## Backend configuration

The console must be allowed by CORS in production. Add its origin to the backend
environment and restart the API:

```dotenv
CORS_ORIGIN=https://admin.example.com
ORDER_CONSOLE_ORIGIN=https://orders.example.com
```

Both values are comma-separated lists and are merged into the Express CORS allow-list.
The pending-order subscription already checks the JWT role and only allows `ADMIN` and
`STAFF`.

## Admin credentials troubleshooting

The backend creates its first admin at boot from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
(defaults: `admin@postal.local` / `admin123`) **only when that email does not exist
yet**. If the account already exists with an older password, the console answers
`Invalid email or password`. Reset it from the backend repository:

```bash
cd postal-backend
npm run create-admin -- --email admin@postal.local --password "Str0ngPass!" --role ADMIN
# or a staff operator
npm run create-admin -- --email staff@postal.local --password "Str0ngPass!" --role STAFF --name "Night Shift"
```

The script upserts the account, re-hashes the password, activates it, and clears any
old refresh token. Run it against the same `MONGODB_URI` the API uses (locally, or on
Railway with `railway run npm run create-admin -- ...`).

## Deployment checklist

1. Build the image with the production `NEXT_PUBLIC_*` URLs.
2. Add the console origin to `ORDER_CONSOLE_ORIGIN` on the backend and restart it.
3. Terminate TLS in front of the container; the refresh cookie is `secure` in production,
   so the console must be served over HTTPS.
4. Point the WebSocket URL at the same host (`wss://…`).
5. Verify `/login`, a live order, confirm, reject, and the concurrent-conflict path.

## Project structure

```
app/
  (console)/          authenticated shell + live queue page
  api/auth/           login, refresh and logout route handlers (httpOnly cookie)
  login/              sign-in page
  forbidden/          shown to roles other than ADMIN/STAFF
components/           header, order card, drawer, dialogs, UI primitives
lib/
  apollo/             Apollo Client (HTTP + graphql-ws split link)
  auth/               auth context, token store, backend calls
  graphql/            GraphQL documents
  hooks/              realtime stream, sound, browser notifications
  interfaces/         TypeScript interfaces (prefixed with I)
  utils/              formatting and waiting-level helpers
cypress/e2e/          login, live queue and order action specs
```

## Manual test checklist

- [ ] Sign in with an `ADMIN` account and land on the queue.
- [ ] Sign in with a `VENDOR` account and land on `/forbidden`.
- [ ] Create an order from the customer app: it appears within 2 seconds without a
      refresh, plays a sound, shows a browser notification and updates the title badge.
- [ ] Stop the backend WebSocket: the indicator switches to “Polling” and new orders
      still appear within 15 seconds. Restart it: the indicator returns to “Live”.
- [ ] Confirm an order with a note: the card disappears and “Confirmed today” increments.
- [ ] Reject an order without a reason: validation blocks it. Add a quick reason and
      submit: the card disappears and “Rejected today” increments.
- [ ] Open the same order in two browsers and confirm in both: exactly one succeeds; the
      other shows “already handled by another operator” and removes the card.
- [ ] Use `↑`/`↓`, `C` and `R` to work the queue without the mouse.
- [ ] Switch to Arabic: layout flips to RTL. Toggle dark mode.
- [ ] Resize to a phone width: cards stack and dialogs remain usable.
