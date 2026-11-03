# Store & Rider app compatibility layer

This backend now accepts every GraphQL document shipped in `store-app/lib` and
`rider-app/lib`. Nothing was renamed or removed: the new surface is additive, and
the two operations whose argument shape differed accept **both** the old and the
new shape.

Verification (run from `backend/`):

```bash
npm run validate:clients
# ✓ ../store-app/lib: 25 document(s) validated, 0 errors (30 unused skipped)
# ✓ ../rider-app/lib: 34 document(s) validated, 0 errors (51 unused skipped)
```

---

## 1. New operations and what they map to

### Store (vendor) app

| Operation | Kind | Backend implementation |
| --- | --- | --- |
| `restaurantOrders` | Query | `Order.find({ restaurant ∈ restaurants owned by caller })`, newest first, limit 200, populated restaurant/user/rider/review. |
| `storeCurrentWithdrawRequest(storeId)` | Query | Latest `WithdrawRequest { userType: STORE, store, status: REQUESTED }`. Ownership checked when `storeId` is sent; otherwise the vendor's own store is used. |
| `storeEarningsGraph(storeId, page, limit, startDate, endDate)` | Query | Aggregation over `DELIVERED`/`COMPLETED` orders, grouped by day. `totalEarnings = orderAmount − orderAmount × restaurant.commissionRate / 100`; also returns `totalOrderAmount`, `totalDeliveries`, `totalCount`. |
| `acceptOrder(_id, time)` | Mutation | PENDING → ACCEPTED, sets `acceptedAt`, `preparationTime = Number(time)` (minutes). Vendor must own the order's restaurant. |
| `orderPickedUp(_id)` | Mutation | → PICKED, sets `pickedAt`, `isPickedUp`. Vendor-owned only. |
| `muteRing(orderId)` | Mutation | Clears `isRinged` / `isRiderRinged`. Allowed for the order's customer, assigned rider, owning vendor, or admin. |
| `toggleAvailability(restaurantId)` / `toggleStoreAvailability(restaurantId)` | Mutation | Flips `Restaurant.isAvailable`. Vendor-owned only. |
| `saveRestaurantToken(token, isEnabled)` | Mutation | Writes `notificationToken` / `enableNotification` on the vendor's restaurant. |
| `updateRiderLocation(latitude, longitude)` | Mutation | Args are now optional `String`; parsed with `Number()` and validated (`validCoordinates`). |
| `updateRiderLicenseDetails` / `updateRiderVehicleDetails` | Mutation | Merge into `User.licenseDetails` / `User.vehicleDetails` (Mixed). Self-only for riders. |
| `createWithdrawRequest(requestAmount, userId)` | Mutation | `userId` is accepted for compatibility but **ignored**; the authenticated user is always used. |

### Rider app

| Operation | Kind | Backend implementation |
| --- | --- | --- |
| `riderOrders` | Query | `Order.find({ rider: caller })`, newest first, populated. `Order.chat` is resolved from `ChatMessage`. |
| `riderCurrentWithdrawRequest(riderId)` | Query | Latest `REQUESTED` rider withdraw request; riders may only read their own. |
| `riderEarningsGraph(riderId, page, limit, startDate, endDate)` | Query | Aggregation over completed orders grouped by day: `tip` (`tipping`), `deliveryFee` (`deliveryCharges`), `totalEarnings = deliveryFee + tip`, `totalEarningsSum`, `totalTipsSum`, `totalDeliveries`, `totalHours` (sum of `deliveredAt − pickedAt`). Self-only. |
| `assignOrder(id)` | Mutation | Rider self-assign: order must be unassigned, not `AWAITING_ADMIN`, and inside the rider's zone when both zones are known. Sets rider, ASSIGNED, `assignedAt`/`riderAssignedAt`. |
| `updateOrderStatusRider(id, status)` | Mutation | Same transitions as `updateOrderStatus`; only for orders assigned to the calling rider (admins may act on any). |
| `updateRiderBussinessDetails(id, bussinessDetails)` | Mutation | Merge into `User.bussinessDetails`. Self-only. |
| `updateWorkSchedule(riderId, workSchedule, timeZone)` | Mutation | Persists `User.timeZone` and `User.workSchedule` (new fields). Self-only. |
| `subscriptionAssignRider(riderId)` | Subscription | Channel `RIDER_ASSIGN_<riderId>`; published by `assignOrder`, `assignRider`, and admin assignment. Payload `{ order, origin: "new" | "remove" }`. |
| `subscriptionZoneOrders(zoneId)` | Subscription | Channel `ZONE_ORDERS_<zoneId>`; published when an unassigned order becomes PENDING/ACCEPTED and removed when it is assigned. |

### Fields added to existing types

- `Order.chat: [Chat!]` — latest 50 `ChatMessage` rows mapped to `{ user, message, images, isActive }`.
- `User.timeZone`, `User.workSchedule` — new optional columns.
- `Earning.grandTotalEarnings`, `EarningsData.message` — the aggregate is merged into every earnings row so both the admin row shape and the mobile app's `grandTotalEarnings` read work.
- `DateFilter` (`startDate`/`endDate`) and `PaginationInput` aliases for the admin `DateFilterInput`/`PageInput`.

---

## 2. Behaviour decisions

- **Status mapping is 1:1.** Both apps already use `PENDING / ACCEPTED / ASSIGNED / PICKED / DELIVERED / COMPLETED / CANCELLED`. `AWAITING_ADMIN` is backend-only and is never produced by the compatibility mutations.
- **Dual argument shapes** for `cancelOrder` (`id` or `_id`), `reviewOrder` (`reviewInput` or flat `order/rating/description`), `updateRiderLocation` (string or number), `earnings` (`DateFilterInput`/`PageInput` or `DateFilter`/`PaginationInput`).
- **Riders are always self-scoped** in `earnings`, `transactionHistory`, `riderEarningsGraph`, `riderCurrentWithdrawRequest`, and rider detail mutations, regardless of any `userId`/`riderId` sent by the client. A client-sent id is only accepted when it matches the token, or when the caller is an admin.
- **Vendors are always scoped to their own restaurants** (`restaurant.owner === token.userId`). `restaurantOrders` returns `[]` when the vendor owns no restaurant instead of leaking other stores' orders.
- **Work schedule** had no backend equivalent: added two optional fields on `User` (`timeZone: String`, `workSchedule: [{ day, enabled, slots: [{ startTime, endTime }] }]`). It is stored verbatim and returned by `User.timeZone` / `User.workSchedule`.
- **Earnings graphs** only include `DELIVERED` and `COMPLETED` orders, matching the admin earnings report.
- **`saveRestaurantToken`** resolves the restaurant from the authenticated vendor's ownership (the app does not send an id).
- **`muteRing`** returns a Boolean as the app's document selects no sub-fields.

---

## 3. Railway / deployment notes

No new environment variables are required and no migration is needed (MongoDB
accepts the two new optional `User` fields as-is).

Existing variables used by this work:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Database connection. |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Tokens for store/rider login and WebSocket auth. |
| `API_PUBLIC_URL` | Public base URL used for uploaded images. |
| `WHATSAPP_*`, `TWILIO_*` | OTP delivery (already configured). |
| `FIREBASE_*` | Optional push notifications. |

After deploying, restart the service so Apollo rebuilds the schema. WebSocket
clients must connect with the same `Authorization` header used for HTTP; the two
new subscriptions call `requireAuth`/`requireRole` in the subscription context.

---

## 4. Smoke tests (curl)

Set these first:

```bash
API="https://<your-railway-domain>/graphql"
```

### 4.1 Store login

```bash
STORE=$(curl -s "$API" -H 'Content-Type: application/json' -d '{
  "query": "mutation($u:String,$p:String){ restaurantLogin(username:$u,password:$p){ token restaurantId } }",
  "variables": { "u": "store@example.com", "p": "StorePass123" }
}')
echo "$STORE"
STORE_TOKEN=$(echo "$STORE" | jq -r '.data.restaurantLogin.token')
STORE_ID=$(echo "$STORE" | jq -r '.data.restaurantLogin.restaurantId')
```

### 4.2 Rider login

```bash
RIDER=$(curl -s "$API" -H 'Content-Type: application/json' -d '{
  "query": "mutation($u:String,$p:String){ riderLogin(username:$u,password:$p){ token user { _id } } }",
  "variables": { "u": "rider@example.com", "p": "RiderPass123" }
}')
echo "$RIDER"
RIDER_TOKEN=$(echo "$RIDER" | jq -r '.data.riderLogin.token')
RIDER_ID=$(echo "$RIDER" | jq -r '.data.riderLogin.user._id')
```

### 4.3 Store: list orders

```bash
curl -s "$API" -H 'Content-Type: application/json' -H "Authorization: Bearer $STORE_TOKEN" -d '{
  "query": "{ restaurantOrders { _id orderId orderStatus orderAmount preparationTime restaurant { _id name } } }"
}' | jq
```

### 4.4 Store: accept an order

```bash
ORDER_ID=$(curl -s "$API" -H 'Content-Type: application/json' -H "Authorization: Bearer $STORE_TOKEN" -d '{
  "query": "{ restaurantOrders { _id orderStatus } }"
}' | jq -r '.data.restaurantOrders[] | select(.orderStatus=="PENDING") | ._id' | head -1)

curl -s "$API" -H 'Content-Type: application/json' -H "Authorization: Bearer $STORE_TOKEN" -d "{
  \"query\": \"mutation(\$_id:String!,\$time:String){ acceptOrder(_id:\$_id,time:\$time){ _id orderStatus preparationTime } }\",
  \"variables\": { \"_id\": \"$ORDER_ID\", \"time\": \"25\" }
}" | jq
```

### 4.5 Store: toggle availability

```bash
curl -s "$API" -H 'Content-Type: application/json' -H "Authorization: Bearer $STORE_TOKEN" -d "{
  \"query\": \"mutation(\$id:String!){ toggleAvailability(restaurantId:\$id){ _id isAvailable } }\",
  \"variables\": { \"id\": \"$STORE_ID\" }
}" | jq
```

### 4.6 Rider: list orders and self-assign

```bash
curl -s "$API" -H 'Content-Type: application/json' -H "Authorization: Bearer $RIDER_TOKEN" -d '{
  "query": "{ riderOrders { _id orderStatus rider { _id } chat { user message } } }"
}' | jq

curl -s "$API" -H 'Content-Type: application/json' -H "Authorization: Bearer $RIDER_TOKEN" -d "{
  \"query\": \"mutation(\$id:String!){ assignOrder(id:\$id){ _id orderStatus rider { _id name } } }\",
  \"variables\": { \"id\": \"$ORDER_ID\" }
}" | jq
```

### 4.7 Rider: update status, earnings, schedule

```bash
curl -s "$API" -H 'Content-Type: application/json' -H "Authorization: Bearer $RIDER_TOKEN" -d "{
  \"query\": \"mutation(\$id:String!,\$s:String!){ updateOrderStatusRider(id:\$id,status:\$s){ _id orderStatus } }\",
  \"variables\": { \"id\": \"$ORDER_ID\", \"s\": \"PICKED\" }
}" | jq

curl -s "$API" -H 'Content-Type: application/json' -H "Authorization: Bearer $RIDER_TOKEN" -d "{
  \"query\": \"query(\$id:ID!){ riderEarningsGraph(riderId:\$id,page:1,limit:10){ totalCount earnings { _id totalEarningsSum totalDeliveries totalHours earningsArray { totalEarnings deliveryFee tip date } } } }\",
  \"variables\": { \"id\": \"$RIDER_ID\" }
}" | jq

curl -s "$API" -H 'Content-Type: application/json' -H "Authorization: Bearer $RIDER_TOKEN" -d "{
  \"query\": \"mutation(\$id:String!,\$w:[DayScheduleInput!]!,\$tz:String!){ updateWorkSchedule(riderId:\$id,workSchedule:\$w,timeZone:\$tz){ _id timeZone workSchedule { day enabled slots { startTime endTime } } } }\",
  \"variables\": { \"id\": \"$RIDER_ID\", \"tz\": \"Asia/Riyadh\", \"w\": [{ \"day\": \"MONDAY\", \"enabled\": true, \"slots\": [{ \"startTime\": \"09:00\", \"endTime\": \"17:00\" }] }] }
}" | jq
```

Expected: no `400` validation errors, `acceptOrder` returns `ACCEPTED`, `assignOrder`
returns `ASSIGNED`, and `updateWorkSchedule` echoes the stored schedule.
