# @voyant-travel/dedicated-runtime

A Node server entry plus the real in-process providers an operator app needs so
its **identical** `fetch(request, env, ctx)` / `scheduled(event, env, ctx)` code
runs on a dedicated Node runtime (Cloud Run).

Composed operator APIs cannot stay resident on Cloudflare Workers for Platforms
(evaluated-heap eviction — every request pays multi-second graph evaluation).
Node is the first-class production target for operator deployments; the composed
graph is built once and reused for the process lifetime. See
voyant-travel/platform#935 and issue voyant#2966.

Because there is **no Workers lane for the operator**, this package supplies real
Node providers rather than emulating Cloudflare bindings: an in-process KV, an
in-process object store for dev (and an S3-backed one for prod), a real
`waitUntil`, an origin-trust gate, and an HTTP `scheduled()` trigger — plus a Node
server that wires them together. It builds on
[`@voyant-travel/worker-runtime`](../worker-runtime) (dispatch glue) and
[`@voyant-travel/storage`](../storage) (SigV4 signing) rather than duplicating
them.

> The old Cloudflare-emulation shims (`createKvNamespaceShim` over the KV REST
> API, the `caches.default` shim, `buildDedicatedEnv`) were removed — with no
> Workers shape to emulate they no longer had a purpose. Their runtime-true
> replacements live here (`createMemoryKvNamespace`, `composeNodeEnv`); the
> `caches.default` path is gone (the operator reads `env.CACHE` KV directly).

## Install

```sh
pnpm add @voyant-travel/dedicated-runtime
```

## Usage

```ts
import {
  composeNodeEnv,
  createMemoryKvNamespace,
  createMemoryR2Bucket,
  createNodeServer,
  createR2BucketShim,
} from "@voyant-travel/dedicated-runtime"

// Your app — plain fetch + scheduled handlers.
import { fetch, scheduled } from "./entry.js"

// 1. Real in-process / S3-backed providers (not Cloudflare-binding shims).
const documents = process.env.R2_S3_ENDPOINT
  ? createR2BucketShim({
      endpoint: process.env.R2_S3_ENDPOINT,
      bucket: "documents",
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    })
  : createMemoryR2Bucket() // dev / offline

// 2. Compose the env bag app code reads (`env.CACHE`, `env.DOCUMENTS_BUCKET`, …).
const env = composeNodeEnv(process.env, {
  kv: { CACHE: createMemoryKvNamespace(), RATE_LIMIT: createMemoryKvNamespace() },
  r2: { DOCUMENTS_BUCKET: documents },
})

// 3. Serve. Trust header, waitUntil, scheduled hook, graceful SIGTERM.
createNodeServer({
  fetch,
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

## Provider coverage

| Binding / capability | Provider | Backed by | Notes |
| --- | --- | --- | --- |
| KV namespace (`CACHE`, `RATE_LIMIT`) | `createMemoryKvNamespace` | in-process `Map` + TTL + LRU | `get`/`get(k,"json")`/`put({expirationTtl})`/`delete`; single-process |
| R2 bucket (prod) | `createR2BucketShim` | R2 S3-compatible API + `@voyant-travel/storage` SigV4 | `put`/`get`/`delete`/`head`; `get` returns `{ arrayBuffer, body, httpMetadata, customMetadata, size }` |
| R2 bucket (dev) | `createMemoryR2Bucket` | in-process `Map` | same surface, no credentials |
| `ctx.waitUntil` | `createWaitUntilRegistry` | in-process promise set | real background tracking + graceful drain |
| `scheduled()` | `createNodeServer` / `scheduledHandler` | HTTP `POST /__voyant/scheduled` | Cloud Scheduler hook |
| env bindings bag | `composeNodeEnv` | `process.env` + providers | the shape app code reads (`env.CACHE`, …) |
| Node server + shutdown | `createNodeServer` | `@hono/node-server` | trust gate, waitUntil ctx, SIGTERM drain |

## Out of scope

- **Cache API (`caches.default`)** — removed. `@voyant-travel/hono`'s
  `publicResponseCache` reads `env.CACHE` KV directly when `caches.default` is
  absent (which it always is on Node), so the in-process KV serves the response
  cache. No `globalThis` shim is installed.
- **Distributed KV / object store** — `createMemoryKvNamespace` and
  `createMemoryR2Bucket` are single-process. A multi-instance deployment swaps
  them for a shared KV/Redis/S3 provider behind the same interface
  (platform#940); the S3-backed `createR2BucketShim` already covers durable
  object storage.
- **Analytics Engine (`METRICS`)** — the metrics middleware is a no-op when the
  binding is absent, so a Node deployment degrades gracefully.
- **`request.cf`** — not reconstructed; app code tolerates `undefined` (it
  already does on non-Workers runtimes).
