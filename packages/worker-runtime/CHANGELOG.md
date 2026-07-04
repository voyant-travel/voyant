# @voyant-travel/worker-runtime

## 0.3.0

### Minor Changes

- 5d994d1: Add `lazySsr` so the TanStack Start SSR handler can be loaded behind the
  non-API branch. Statically constructing the start handler in `entry.ts` pulls
  React + `react-dom/server` (~2.2 MB) into the Worker's startup graph, which
  Cloudflare parses on every cold isolate before routing — so even a no-op
  `/api/health` paid the React cold-load and the isolate could not stay warm.
  `lazySsr(() => import("./ssr-handler"))` memoizes the loader and keeps the
  React SSR graph off the startup path, the same win `lazyApp` already gives the
  Hono API. API-only isolates never load `react-dom/server`.

## 0.2.1

### Patch Changes

- 2a9fe00: Keep lean auth dispatch isolated from the full API graph by default. Auth
  requests no longer background-warm `loadApiApp()` unless a host explicitly sets
  `warmApiOnAuth: true`, preventing `/api/auth/*` cold requests from triggering
  the heavy framework module import path.

## 0.2.0

### Minor Changes

- 9a1197b: Move the operator media upload and serve routes off the bare `/v1/*` surface and onto `/v1/admin/*`.

  Uploads now post to `/v1/admin/uploads` and video tickets to `/v1/admin/uploads/video`; stored media is served from `/v1/admin/media/*`. The Hono app no longer mounts the bare `/v1/*` catch-all actor guard, and worker-runtime hosts can use `rewriteAppPath` to preserve compatibility for persisted legacy media URLs.

## 0.1.0

### Minor Changes

- 2e716a2: New packages — Phase 0 of the packaged-admin RFC (#1643): framework-owned
  Worker infrastructure ships as versioned packages instead of copied template
  files.

  - `@voyant-travel/worker-runtime`: `createApiDispatch` (prefix-routed API/auth
    dispatch with lean-auth cold-start protection and background API warm-up),
    `createWorkerFetch` (API-vs-SSR Worker entrypoint), `lazyApp` (memoized app
    loaders), and `withActiveRouteSsrManifest` (restricts the TanStack Start SSR
    manifest to active route matches).
  - `@voyant-travel/vite-config`: `voyantStartViteConfig` build preset (vendor
    chunking, SSR optimizeDeps, `@` alias, dev-tunnel hosts) plus à-la-carte
    exports (`voyantVendorChunk`, `VOYANT_SSR_OPTIMIZE_DEPS`,
    `VOYANT_ROUTE_FILE_IGNORE_PATTERN`, `createAnalyzePlugin`).

  The operator template consumes both: `entry.ts` shrinks to bindings + factory
  calls (scheduled crons, the workflow Durable Object, and step services remain
  app-owned per RFC §4.4), and `vite.config.ts` shrinks to plugin instantiation.
