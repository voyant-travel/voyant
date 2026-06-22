---
"@voyant-travel/hono": minor
"@voyant-travel/framework": minor
---

Anonymous-access declarations (ADR-0008 Phase 1). A module/extension can now declare which of its PUBLIC routes are reachable without a session via an `anonymous?: boolean | string[]` field on `HonoModule`/`HonoExtension` — `true` opens the whole public mount, a string array opens specific sub-paths relative to it. `createApp` assembles the global anonymous allow-list from these declarations (unioned with any explicit `publicPaths`, now an escape hatch) and feeds it to both the auth middleware and the public-write rate-limit matcher, so the "reachable-without-auth" decision lives next to the route instead of in a hand-maintained list. New pure helper `assembleAnonymousPaths(modules, extensions, explicit)` is exported for tooling/audit.

The standard framework families that own anonymous routes now declare it (catalog, bookings, finance payment/collections/accountant sub-paths, legal, public-document-delivery, storefront verification + intake, customer-portal contact-exists, proposals); the framework's `anonymous-surface` test asserts the full assembled standard surface as an auditable snapshot.

Additive and non-breaking: a deployment that declares no `anonymous` and passes `publicPaths` explicitly gets identical behavior.
