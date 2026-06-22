---
"@voyant-travel/hono": minor
"@voyant-travel/plugin-netopia": patch
---

Bundle-level anonymous-access declarations (ADR-0008). `HonoBundle` gains an `anonymous?: string[]` field for **absolute** API paths a plugin exposes that are reachable without a session — for routes that mount outside the `/v1/public/{name}` convention, like a payment-processor webhook. `expandHonoBundles` collects these into `ExpandedHonoBundles.anonymousPaths`, and `createApp` folds them into the assembled anonymous allow-list alongside module/extension `anonymous` declarations and explicit `publicPaths`.

`netopiaHonoBundle` now declares its callback (`/v1/finance/providers/netopia/callback`) anonymous, so deployments no longer carry it in `publicPaths` — the "reachable-without-auth" decision lives with the plugin that owns the route.

Additive and non-breaking: a bundle that declares no `anonymous` contributes nothing to the allow-list.
