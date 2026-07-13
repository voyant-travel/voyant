# @voyant-travel/runtime-core

Low-level request dispatch, Node server, trust, and storage primitives used by
Voyant framework and host packages. Application starters use
`@voyant-travel/runtime` instead of depending on this package directly.

## Request dispatch (runtime-neutral)

The `fetch`/API/SSR routing an app entry composes. Reused verbatim on Node and
Cloudflare Workers.

- `createWorkerFetch({ api, ssr })` — the `(request, env, ctx)` entry that routes
  `/api/*` to the API dispatch and everything else to SSR.
- `lazySsr(() => import("./ssr-handler"))` — memoize the dynamic import of the
  TanStack Start server graph (React + `react-dom/server`) so it stays out of the
  module's startup cost.
- `createApiDispatch` / `lazyApp` — prefix-routed `/api/*` app dispatch with a
  memoized loader.
- `restrictSsrManifestToActiveRoutes` / `withActiveRouteSsrManifest` — trim the
  TanStack SSR preload manifest to matched routes.

## Node runtime

The resident-process server plus the real providers it wires. See
[docs/architecture/deployment-targets.md](../../docs/architecture/deployment-targets.md).

- `createNodeServer({ fetch, scheduled, env, originTrustSecret })` — boots a Node
  HTTP server (`@hono/node-server`) running the app's `fetch` unchanged, adding a
  real per-request `waitUntil` (background work tracked + drained on shutdown), an
  origin-trust gate, an HTTP `scheduled()` hook at `POST /__voyant/scheduled`, and
  graceful SIGTERM/SIGINT drain.
- `composeNodeEnv(process.env, { kv, r2 })` — assemble the env bag app code reads
  (`env.CACHE`, `env.MEDIA_BUCKET`, …) from string vars + real provider objects.
- `createMemoryKvNamespace()` — in-process KV (`Map` + TTL + LRU) for
  `CACHE`/`RATE_LIMIT` in a single resident process.
- `createR2BucketShim({ endpoint, bucket, … })` — S3-compatible object store for
  production; `createMemoryR2Bucket()` — in-process store for dev/offline.
- `originTrustMiddleware` / `verifyOriginTrust` / `constantTimeEqual` — the
  `x-voyant-origin-trust` gate the platform dispatcher stamps.
- `createWaitUntilRegistry()` — the in-process `waitUntil` registry + drain.

## Out of scope

- **Cache API (`caches.default`)** — not shimmed; the public-cache middleware
  reads `env.CACHE` KV directly on Node.
- **Distributed KV / object store** — the in-process providers are single-process;
  a multi-instance deployment swaps them for a shared KV/S3 provider behind the
  same interface (platform#940). The S3-backed `createR2BucketShim` covers durable
  object storage.
- **Durable Objects, Analytics Engine, `request.cf`** — no in-process equivalent;
  app code tolerates their absence on Node.
