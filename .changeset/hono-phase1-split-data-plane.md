---
"@voyantjs/hono": minor
---

Split data plane + auth caching (Phase 1 of the enterprise-scale plan, RFC #1687):

- **Per-surface db routing.** `createApp` accepts `dbTransactional` (and `dbTransactionalPaths`): when provided, requests are routed by path — surfaces of modules/extensions declaring `requiresTransactionalDb` get the transactional (WebSocket) factory, everything else gets the cheap default (typically neon-http: one fetch per query, zero connection handshake). The auth/permission/db middlewares accept the new `DbSource` (factory or selector) and keep sharing one client per request. The transaction-capability assertion becomes per-surface: the default client is allowed to be transaction-incapable. `createPathDbSelector` is exported for custom wiring. Without `dbTransactional`, behavior is unchanged.
- **API-key KV cache.** `voy_` API-key validation caches the key row in the `env.CACHE` KV binding (60s TTL) for quota-less keys, eliminating the per-request Postgres SELECT for steady-state server-to-server traffic. Quota-limited keys always read fresh. Trade-off: revoking/disabling a cached key takes up to 60s. Usage counters now update via SQL increments (no stale arithmetic under concurrency).
