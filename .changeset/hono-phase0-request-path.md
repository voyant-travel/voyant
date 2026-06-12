---
"@voyantjs/hono": minor
---

Request-path performance pass (Phase 0 of the enterprise-scale plan, RFC #1687):

- **Single shared per-request db client.** `requireAuth`, `requirePermission`, and the `db` middleware now resolve one client per request via an internal lease (`acquireRequestDb`) instead of each constructing its own — an authenticated request previously opened 2–3 Neon WebSocket Pools (each a full TLS+auth handshake); it now opens exactly one. The creating middleware owns the single dispose, scheduled via `waitUntil` after the response.
- **`publicResponseCache` middleware** (mounted by `createApp` by default; disable/tune via the new `publicCache` config). Caches `GET /v1/public/*` responses that a route explicitly marks `Cache-Control: public, s-maxage=…` (and that carry no `Set-Cookie`). Cache hits are served before auth, the db client, and the runtime bootstrap — a hit costs no Postgres connection and no module-graph instantiation. Uses the Cache API where available and falls back to the `env.CACHE` KV binding (Workers-for-Platforms namespaced scripts have no `caches.default`); transparent no-op when neither exists.
- **Event emits no longer block responses.** Inside a request, `createApp` exposes a request-scoped EventBus whose emits defer non-`inline` subscribers past the response via `executionCtx.waitUntil` — booking confirmations stop waiting on third-party subscriber HTTP calls (CMS sync, e-invoicing). Subscribers that need read-your-writes visibility within the request opt in with `inline: true` on the plugin subscriber.
- **CORS allowlist memoized** per `CORS_ALLOWLIST` value (was re-split + wildcard-RegExp-recompiled on every request).
- **Guarded `executionCtx` access** in auth/permission middlewares — Hono throws on `executionCtx` outside Workers; auth integrations now receive `ctx: undefined` on such runtimes instead of the request 500ing.
