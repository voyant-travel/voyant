# @voyant-travel/vite-config

## 0.1.3

### Patch Changes

- d2d2a44: Anchor the React vendor chunk heuristic to actual `react`, `react-dom`, and `scheduler` package boundaries so third-party package internals such as Better Auth's `dist/client/react/*` subpaths stay out of the eager React chunk.

## 0.1.2

### Patch Changes

- a155321: Declare `rollup-plugin-visualizer` as an optional peer for the opt-in bundle analysis helper.

## 0.1.1

### Patch Changes

- ecec979: Improve operator bundle boundaries by adding route-local admin message provider support, exposing admin extension route helpers, keeping pending skeletons structural, and tightening Vite route ignores and vendor chunk splitting so heavy admin route dependencies stay out of the initial entry.

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
