---
---

Closes #510 (mostly): audit and clean up Pool-lifecycle on the templates' non-Hono code paths after the Neon WebSocket switch in #500.

What changed in both `templates/dmc` and `templates/operator`:

- **Hono route handlers** stop calling `getDbFromEnv(c.env)` — they now read the request-scoped client from `c.get("db")`, which is owned by the `dbFromEnvForApp` factory + Hono db middleware (introduced in #511) and disposed via `executionCtx.waitUntil` after the response.
- **Helper functions** (`assertSuperAdmin`, `getBetterAuth`) own their own Pool lifecycle now. `assertSuperAdmin` wraps the query in `withDbFromEnv` (open → query → close). `getBetterAuth` returns `{ auth, dispose }`; every caller schedules `dispose()` via `executionCtx.waitUntil` (or awaits inline when no `executionCtx` is reachable, e.g. in `resolveAuthRequest`).
- **Event-bus subscribers** (catalog-bridge, channel-push, catalog-checkout, booking-schedule, smartbill, dmc/catalog-bridge) wrap their bodies in `withDbFromEnv` so the Pool lives only for the subscriber call.
- **Scheduled handlers** (`channel-push-scheduled`, `draft-reaper-scheduled`) wrap their tick bodies in `withDbFromEnv`.
- **Booking-engine handler closures** in `templates/operator/src/api/lib/booking-engine-runtime.ts` (products holds + quickCreate, hospitality + cruises commit bridges) — six closures, each now wraps its query in `withDbFromEnv`.
- **`mountChannelPushAdminRoutes`** middleware reads `c.var.db` instead of building a new Pool.
- The Hono sub-app declarations for `auth/handler.ts` (both templates) and the `InvitationsVariables` types now include `db: VoyantDb` so `c.get("db")` is properly typed under those sub-apps' contexts.

What's still leaking (deliberately deferred):

- `app.ts:resolveDb` callbacks passed to `createBookingsHonoModule` and `createLegalHonoModule`. The module-factory contract is `(bindings) => VoyantDb` with no dispose hook; widening it to accept `DisposableDb` is a separate shared-package change. Volume is low (one Pool per booking-confirmed / legal-event subscriber call), so this isn't moving the operational needle today. Both sites have `KNOWN LEAK` comments pointing to the remaining audit. Tracked under #510.

No behavior change for HTTP API contracts. No schema migration. Pure lifecycle / Pool-management cleanup.
