// The managed-operator reference is a Node-only, source-free admin host: it
// serves the packaged Voyant admin UI from published `@voyant-travel/*` packages
// with NO admin route files, building its route tree at runtime from packaged
// extension factories. It has no API of its own (the managed API is a separate
// process, voyant#2987), so this env bag is deliberately minimal — just the
// runtime bindings `src/server.ts` composes and the URL knobs the fetcher reads.
//
// The `KVNamespace` / `ExecutionContext` / `ScheduledController` names below
// resolve to the Node structural aliases declared at the bottom of this file,
// not `@cloudflare/workers-types`.
interface AppBindings {
  // KV namespaces (in-process on Node — see `createMemoryKvNamespace`).
  CACHE: KVNamespace
  RATE_LIMIT: KVNamespace

  /**
   * Standalone-boot HTTP port (`node dist/server/server.js`). Defaults to 8080
   * in `createNodeServer` when unset.
   */
  PORT?: string
  /**
   * Shared secret gating the origin-trust header on the standalone Node server.
   * Optional — omitted when running behind a trusted ingress.
   */
  ORIGIN_TRUST_SECRET?: string

  // URL knobs read by the packaged managed-profile fetcher during SSR.
  DATABASE_URL?: string
  APP_URL?: string
  API_BASE_URL?: string
  /** SSR origin the fetcher loops `/api/*` back through. */
  DASH_BASE_URL?: string
}

// ── Node structural aliases (replacing @cloudflare/workers-types) ───────────
// These global aliases keep the binding-typed members above resolving without
// a dependency on @cloudflare/workers-types. `import(...)` type expressions do
// NOT turn this ambient declaration file into a module, so the globals stay
// global.

/** Per-request execution context. Aliased to Hono's `ExecutionContext`. */
type ExecutionContext = import("hono").ExecutionContext
/** Cron event echoed from the Cloud Scheduler HTTP trigger. */
type ScheduledController = import("@voyant-travel/runtime").ScheduledEventLike
/** In-process KV store (`@voyant-travel/utils` `KVStore` contract). */
type KVNamespace = import("@voyant-travel/utils").KVStore
