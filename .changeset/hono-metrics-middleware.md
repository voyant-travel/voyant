---
"@voyantjs/hono": minor
---

Per-request metrics middleware (RFC #1687 Phase 3.4, the in-worker half). `createApp` mounts it by default; it is inert without an `env.METRICS` Analytics Engine binding (`metrics: false` disables). One data point per request: blobs `[method, routePattern, surface, cacheStatus]`, doubles `[durationMs, status, dbQueryCount]`, index `routePattern` — complementing the platform dispatcher's per-dispatch dataset with what only the worker can see (matched route, db query count via a counting view the db middleware exposes, in-worker cache hits). The operator template declares the binding (`voyant_operator_metrics`; namespaced per tenant by the Voyant Cloud publisher).
