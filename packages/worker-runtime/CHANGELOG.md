# @voyant-travel/worker-runtime

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
