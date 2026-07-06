# @voyant-travel/dedicated-runtime

Bindings emulation and a Node server entry so an operator app's **identical**
`fetch(request, env, ctx)` / `scheduled(event, env, ctx)` code runs unchanged on
a dedicated Node runtime (Cloud Run) as it does on Cloudflare Workers for
Platforms.

Composed operator APIs cannot stay resident on Workers for Platforms
(evaluated-heap eviction). The platform's per-app **dedicated** runtime runs the
same bundle on Cloud Run behind the existing dispatcher. This package supplies
the shims the app expects the runtime to provide — KV, R2, the Cache API, a real
`waitUntil`, and an HTTP `scheduled()` trigger — plus a Node server that wires
them together. See voyant-travel/platform#935.

It builds on [`@voyant-travel/worker-runtime`](../worker-runtime) (dispatch glue)
and [`@voyant-travel/storage`](../storage) (SigV4 signing) rather than
duplicating them.

## Install

```sh
pnpm add @voyant-travel/dedicated-runtime
```

## Usage

```ts
import {
  buildDedicatedEnv,
  createKvNamespaceShim,
  createNodeServer,
  createR2BucketShim,
  installCachesShim,
} from "@voyant-travel/dedicated-runtime"

// Your app — the SAME module you ship to Workers.
import app, { scheduled } from "./entry.js"

// 1. Resident in-process response cache (picked up by public-cache middleware).
installCachesShim({ maxEntries: 5_000, maxBytes: 512 * 1024 })

// 2. Rebuild the bindings the Workers runtime would have injected.
const env = buildDedicatedEnv(process.env, {
  kv: {
    CACHE: createKvNamespaceShim({
      accountId: process.env.CF_ACCOUNT_ID!,
      namespaceId: process.env.CF_KV_CACHE_ID!,
      apiToken: process.env.CF_API_TOKEN!,
      lru: { maxEntries: 10_000, ttlMs: 30_000 }, // a resident process can hold one
    }),
  },
  r2: {
    DOCUMENTS_BUCKET: createR2BucketShim({
      endpoint: process.env.R2_S3_ENDPOINT!,
      bucket: "documents",
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    }),
  },
})

// 3. Serve. Trust header, waitUntil, scheduled hook, graceful SIGTERM.
createNodeServer({
  fetch: app.fetch,
  scheduled,
  env,
  port: Number(process.env.PORT ?? 8080),
  originTrustSecret: process.env.ORIGIN_TRUST_SECRET,
})
```

### Cloud Scheduler → `scheduled()`

Cron jobs (outbox drain, draft reaper, promotion boundary, reconcilers, …) can't
run on a timer on Cloud Run. Point a Cloud Scheduler job at:

```
POST /__voyant/scheduled?cron=<expr>
x-voyant-origin-trust: <shared-secret>
```

Each cron expression gets its own scheduler job. The handler returns `202` on
success, `400` if `cron` is missing, `500` if the handler throws.

### Origin trust

The platform dispatcher stamps every forwarded request with a per-app shared
secret in the **`x-voyant-origin-trust`** header (pinned across repos — do not
change). `createNodeServer({ originTrustSecret })` rejects any request lacking a
constant-time match with `403`, exempting `/healthz` for container probes. The
low-level pieces (`originTrustMiddleware`, `verifyOriginTrust`,
`constantTimeEqual`, `scheduledHandler`) are exported for custom server loops.

## Shim coverage

| Binding / capability | Shim | Backed by | Notes |
| --- | --- | --- | --- |
| KV namespace | `createKvNamespaceShim` | Cloudflare KV REST API | `get`/`get(k,"json")`/`put({expirationTtl})`/`delete`; optional read-through LRU |
| R2 bucket | `createR2BucketShim` | R2 S3-compatible API + `@voyant-travel/storage` SigV4 | `put`/`get`/`delete`/`head`; `get` returns `{ arrayBuffer, body, httpMetadata, customMetadata, size }` |
| Cache API (`caches.default`) | `installCachesShim` | in-process LRU on `globalThis` | honors `s-maxage`/`max-age`; idempotent install |
| `ctx.waitUntil` | `createWaitUntilRegistry` | in-process promise set | real background tracking + graceful drain |
| `scheduled()` | `createNodeServer` / `scheduledHandler` | HTTP `POST /__voyant/scheduled` | Cloud Scheduler hook |
| env bindings bag | `buildDedicatedEnv` | `process.env` + shims | same shape app code sees on Workers |
| Node server + shutdown | `createNodeServer` | `@hono/node-server` | trust gate, waitUntil ctx, SIGTERM drain |

## Intentionally NOT shimmed

- **Durable Objects** — no in-process equivalent; DO-dependent features are out
  of scope for the dedicated runtime and must be provided by the platform.
- **Analytics Engine (`METRICS`)** — the metrics middleware is already a no-op
  when the binding is absent, so a dedicated deployment degrades gracefully. An
  AE HTTP-ingest shim was evaluated as optional stretch scope and skipped to
  keep the package small; add one here later if metrics parity is needed.
- **`request.cf`** — Cloudflare's per-request geo/TLS object is not reconstructed;
  app code that reads `request.cf` must tolerate `undefined` (it already does on
  non-Workers runtimes).
- **KV `list` / R2 `list`** — not part of the audited usage surface; add on
  demand (R2 list needs multipart XML parsing, which isn't cheap).
```
