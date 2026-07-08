import { fileURLToPath, pathToFileURL } from "node:url"

import { serveManagedProfileAdmin } from "@voyant-travel/admin-host/serve"
import {
  composeNodeEnv,
  createMemoryKvNamespace,
  createNodeServer,
  createWaitUntilRegistry,
  type ExecutionContextLike,
} from "@voyant-travel/runtime"

import { fetch as appFetch, scheduled } from "./entry"

/**
 * Node entry for the managed-operator reference (voyant#3044). This file is also
 * TanStack Start's conventional server entry (`src/server.ts`), so it plays two
 * roles:
 *
 *   1. **Dev** — the Vite dev server imports this module and drives requests
 *      through the `default` export below, so SSR (and the stub API) run under
 *      Node with the same composed env as production.
 *   2. **Production** — `node dist/server/server.js` runs it directly, and the
 *      guarded block at the bottom boots a resident HTTP server via
 *      `createNodeServer`, serving the built client assets and falling through
 *      to the app.
 *
 * Unlike the operator this reference has NO API/database of its own (the managed
 * API is a separate process, voyant#2987), so the env is deliberately minimal:
 * in-process KV for `CACHE`/`RATE_LIMIT`, nothing else.
 */

/** Built client assets (`dist/client`), served for `/assets/*` and public files. */
const CLIENT_DIR =
  process.env.CLIENT_ASSETS_DIR ?? fileURLToPath(new URL("../client", import.meta.url))

// Compose the minimal env bag app code reads. No DB, no Redis, no object store —
// just in-process KV namespaces so `env.CACHE` / `env.RATE_LIMIT` resolve.
const env = composeNodeEnv<AppBindings>(process.env, {
  kv: {
    CACHE: createMemoryKvNamespace(),
    RATE_LIMIT: createMemoryKvNamespace(),
  },
})

/**
 * Adapt the dedicated runtime's minimal `ExecutionContextLike` (real
 * `waitUntil`) to Hono's `ExecutionContext`, which additionally declares `props`
 * (only touched by app code that never runs on this path).
 */
function toExecutionContext(ctx: ExecutionContextLike): ExecutionContext {
  return {
    waitUntil: (promise) => ctx.waitUntil(promise),
    passThroughOnException: () => ctx.passThroughOnException?.(),
    props: undefined,
  }
}

// Serve built client assets, then fall through to the app (stub API + SSR). The
// SSR handler renders the document shell for any non-asset route, so no explicit
// SPA index fallback is needed. In dev the assets 404 here and are served by
// Vite's own middleware instead.
const web = serveManagedProfileAdmin<AppBindings>({
  clientAssetsDir: CLIENT_DIR,
  app: appFetch,
})

// Per-request waitUntil context for the dev-server path (see toExecutionContext).
const devRegistry = createWaitUntilRegistry()

/**
 * Dev server entry: TanStack Start invokes this per request. We inject the
 * composed Node `env` and a real `waitUntil` context so bindings resolve in dev
 * exactly as in production.
 */
export default {
  fetch: (request: Request): Response | Promise<Response> =>
    web.fetch(request, env, toExecutionContext(devRegistry.context())),
}

// Production standalone boot. Guarded so the dev-server import above does not
// spawn a second listener — only a direct `node dist/server/server.js` run does.
const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? "").href
if (isMainModule) {
  const handle = createNodeServer<AppBindings>({
    fetch: (request, bindings, ctx) => web.fetch(request, bindings, toExecutionContext(ctx)),
    scheduled: (event, bindings, ctx) => scheduled(event, bindings, toExecutionContext(ctx)),
    env,
    port: Number.parseInt(process.env.PORT ?? "8080", 10),
    ...(process.env.ORIGIN_TRUST_SECRET
      ? { originTrustSecret: process.env.ORIGIN_TRUST_SECRET }
      : {}),
  })
  console.info(`[managed-operator] Node runtime listening on :${handle.port}`)
}
