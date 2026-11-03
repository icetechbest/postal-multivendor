# Changed / new files

## New

| File | Purpose |
| --- | --- |
| `scripts/validate-client-docs.ts` | Extracts every `gql` / `#graphql` document from a client folder, resolves fragment interpolation, validates against the backend schema, and prints each error with file/line. Exit code 1 on errors. |
| `src/graphql/typeDefs/appCompat.ts` | Additive SDL for all Store/Rider operations, subscription payloads, earnings graph types, `Chat`, work-schedule types, and the `DateFilter` input. |
| `src/graphql/resolvers/appCompat.ts` | Resolvers for the new queries/mutations/subscriptions, with vendor-ownership and rider-self authorization. |
| `test/app-compat.test.js` | 16 tests: happy path, unauthorized role, and wrong-owner/wrong-rider for every new mutation/query. |
| `docs/APP_COMPATIBILITY.md` | Operation → implementation map, behaviour decisions, Railway notes, and curl smoke tests. |
| `docs/CHANGES.md` | This file. |

## Modified

| File | Change |
| --- | --- |
| `package.json` | Added `validate:clients` and `test:app-compat` scripts. |
| `src/graphql/typeDefs/index.ts` | Merged `appCompatTypeDefs`; dual-shape `cancelOrder`, `reviewOrder`, `updateRiderLocation`; optional `otp` on the OTP/forgot-password mutations. |
| `src/graphql/typeDefs/admin.ts` | `Earning.grandTotalEarnings`, `EarningsData.message`, optional `userId` on `createWithdrawRequest`. |
| `src/graphql/resolvers/index.ts` | Merged `appCompatResolvers` into Query/Mutation/Subscription. |
| `src/graphql/resolvers/appFields.ts` | `Order.chat` (from `ChatMessage`), `User.timeZone`, `User.workSchedule`. |
| `src/graphql/resolvers/appHelpers.ts` | `orderZoneId`, `publishRiderAssignment`, `publishZoneOrder`. |
| `src/graphql/resolvers/appMutations.ts` | Dual-shape args; publishes rider-assignment and zone-order events. |
| `src/graphql/resolvers/adminUsers.ts` | Rider self-scoping, dual date/pagination shapes, `grandTotalEarnings` on every row, `message` on `EarningsData`. |
| `src/models/User.ts` | `timeZone` and `workSchedule` fields. |

## Verification commands

```bash
cd backend
npm run build                 # tsc, exit 0
npm run validate:clients      # 0 errors for store-app and rider-app
npm run test:app-compat       # 16/16 pass
```
