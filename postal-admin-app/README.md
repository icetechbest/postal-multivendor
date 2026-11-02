# Postal Admin — Mobile App

A deliberately **simple** React Native admin app built with **Expo (SDK 51) + Expo
Router + TypeScript**. It reuses the existing Postal GraphQL API and the shared
`@postal/graphql-docs` package so the web admin and the mobile app never drift
apart. It is an operational companion to the web admin, not a replacement: heavy
configuration screens (zones editor, banners, cuisines, shop types, commission
rates, configurations, audit logs) stay on the website and are reachable through
an **Open on web** shortcut.

---

## What's inside

| Tab | Purpose |
| --- | --- |
| **Home** | KPI cards (orders today, revenue, active riders, pending withdrawals) + one simple bar chart. Pull-to-refresh. |
| **Orders** | Paginated list with status filter chips, debounced search, infinite scroll, live polling. Tap for details. |
| **Stores & Vendors** | Paginated stores list with search, enable/disable toggle, store detail with owner + status. |
| **Riders** | Rider list with availability status, wallet, and **View location** (opens the device maps app). |
| **Wallet** | Earnings, transaction history, and withdrawal requests with approve (`TRANSFERRED`) / reject (`CANCELLED`). |
| **More** | Profile, users, support tickets, send notification, language (EN/AR), appearance (light/dark/system), biometric lock, Open on web, logout. |

Order detail screen supports **change status** (`updateStatus`) and **assign
rider** (`assignRider`).

### Cross-cutting features

- **Auth** — email/password login against the existing `login` mutation, tokens
  stored in `expo-secure-store`, in-memory access token, automatic refresh on
  `UNAUTHENTICATED`, auto-logout on expiry. Only `ADMIN` and `STAFF` roles are
  allowed; anything else is sent back to login with a forbidden message.
- **Biometric lock** — optional Face ID / fingerprint unlock on cold start
  (`expo-local-authentication`).
- **Realtime** — Apollo Client with `graphql-ws` for subscriptions plus polling
  fallbacks on the order list/detail and riders list.
- **Push notifications** — native device token (FCM on Android, APNs on iOS)
  registered through the existing `uploadToken` mutation; new-order
  notifications deep-link straight to the order screen.
- **i18n + RTL** — English and Arabic with automatic `I18nManager` RTL.
- **Theming** — light / dark / system via a small in-house theme provider.
- **Offline / error states** — every list has skeleton loaders, empty states, and
  a retry-able error state.

---

## Requirements

- Node.js 18+ and npm
- Expo Go (quick preview) **or** a development build for push notifications
  (Expo Go cannot receive remote push on Android/iOS SDK 51+)
- A running Postal backend (`postal-backend`) with the GraphQL API + WS server

---

## Environment variables

Copy `.env.example` to `.env` and set the URLs. Expo only exposes variables
prefixed with `EXPO_PUBLIC_`.

| Variable | Description | Example |
| --- | --- | --- |
| `EXPO_PUBLIC_SERVER_URL` | Backend base URL (no `/graphql`) | `https://api.example.com` |
| `EXPO_PUBLIC_WS_SERVER_URL` | WS base URL for subscriptions | `wss://api.example.com` |
| `EXPO_PUBLIC_WEB_ADMIN_URL` | Web admin URL for "Open on web" | `https://admin.example.com` |

Never commit real `.env` files. Values fall back to `app.json` → `expo.extra`
(`serverUrl`, `wsServerUrl`, `webAdminUrl`) and finally to `localhost`.

---

## Run locally

```bash
cd postal-admin-app
npm install
cp .env.example .env        # then edit the URLs
npx expo start              # press a / i / w, or scan the QR with Expo Go
```

Other scripts:

```bash
npm run typecheck           # tsc --noEmit (strict)
npm run lint                # eslint
npm test                    # jest (order list screen)
```

### Shared GraphQL package

The app imports every operation from `@postal/graphql-docs` (a local package at
`../packages/graphql-docs`). `metro.config.js` adds it to `watchFolders` and the
root `node_modules` to `nodeModulesPaths`, so no publishing step is needed. If
you move the app, update those paths.

---

## Push notifications (FCM / APNs)

The backend already uses `firebase-admin`, so the app registers the **native
device token** via `Notifications.getDevicePushTokenAsync()` and the existing
`uploadToken(id, pushToken)` mutation.

1. Create a Firebase project and add Android (`com.postal.admin`) and iOS
   (`com.postal.admin`) apps.
2. Download `google-services.json` → `android/app/` and
   `GoogleService-Info.plist` → `ios/`.
3. Provide your FCM server credentials to the backend (`firebase-admin` service
   account) — already supported by `postal-backend`.
4. Set a real EAS `projectId` in `app.json` → `expo.extra.eas.projectId`.
5. Build a development/production build (Expo Go will not deliver remote push):

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
# or: eas build --profile production --platform all
```

Deep links use the `postaladmin://` scheme. Notification payloads should include
an `orderId` (or `order_id` / `id`) field; tapping the notification routes to
`/orders/<id>`.

---

## Project structure

```
app/
  _layout.tsx            Providers (theme → i18n → auth/Apollo) + auth routing
  login.tsx              Email/password login
  (tabs)/
    _layout.tsx          6 bottom tabs + notification deep-link listener
    index.tsx            Home (KPIs + chart)
    orders/index.tsx     Orders list (filter, search, infinite scroll)
    stores/index.tsx     Stores list (toggle enable/disable)
    riders/index.tsx     Riders list + location
    wallet/index.tsx     Earnings / withdrawals / transactions
    more/index.tsx       Profile, users, tickets, notifications, settings
  orders/[id].tsx        Order detail (status + assign rider)
  stores/[id].tsx        Store detail
components/              Shared UI kit, order row, biometric lock screen
lib/
  apollo/client.ts       Apollo Client (http + ws + auth/error links)
  auth/                  Token store, session refresh, auth context, types
  config.ts              Env-derived config + constants
  hooks/                 useDebouncedValue
  i18n.tsx               EN/AR dictionaries + provider
  interfaces.ts          All interfaces (prefixed with I)
  notifications.ts       Permission, token, registration, deep-link parsing
  theme.tsx              Light/dark theme provider
  utils/format.ts        Money/number/date/status helpers
__tests__/orders.test.tsx
```

---

## Manual test checklist

- [ ] Log in with an `ADMIN` or `STAFF` account → lands on Home.
- [ ] Log in with a non-admin role → forbidden message, no access.
- [ ] Kill and relaunch the app → session restored; biometric prompt if enabled.
- [ ] Home shows KPIs and the chart; pull-to-refresh updates them.
- [ ] Orders: filter by each status, search by order id/customer, scroll to load
      more pages.
- [ ] Open an order → change status → list reflects the new status.
- [ ] Assign a rider → rider appears on the order.
- [ ] Stores: toggle a store off/on → status badge updates.
- [ ] Riders: "View location" opens the maps app at the rider's coordinates.
- [ ] Wallet: approve a `REQUESTED` withdrawal → becomes `TRANSFERRED`; reject →
      `CANCELLED`.
- [ ] More: switch language EN/AR → layout flips RTL; switch theme light/dark.
- [ ] Send a notification to a user → success toast.
- [ ] Trigger a new order on the backend → push notification arrives and tapping
      it opens that order.
- [ ] Enable biometric lock → relaunch → unlock screen appears.

---

## Notes & limitations

- No secrets or URLs are hard-coded; everything comes from env / `app.json`.
- Only GraphQL operations that exist in `postal-backend/src/graphql/typeDefs` are
  used (verified against the schema).
- Withdrawal statuses match the backend: pending = `REQUESTED`, approve =
  `TRANSFERRED`, reject = `CANCELLED`.
