import { fileURLToPath, pathToFileURL } from "node:url"

import { serveManagedProfileAdmin } from "@voyant-travel/admin-host/serve"
import {
  createDbClient,
  createPostgresFixedWindowRateLimitStore,
  createPostgresKvStore,
} from "@voyant-travel/db/runtime"
import { createMemoryRateLimitStore, createRedisRateLimitStore } from "@voyant-travel/hono"
import {
  composeNodeEnv,
  createMemoryKvNamespace,
  createMemoryR2Bucket,
  createNodeServer,
  createR2BucketShim,
  createWaitUntilRegistry,
  type ExecutionContextLike,
  type R2BucketShim,
} from "@voyant-travel/runtime"
import type { KVStore } from "@voyant-travel/utils/cache"
import { createRedisKvStore } from "@voyant-travel/utils/redis-kv"
import { createTieredKvStore } from "@voyant-travel/utils/tiered-kv"

import { fetch as appFetch, scheduled } from "./entry"

/**
 * Node entry for the operator (voyant#2966). This file is also TanStack Start's
 * conventional server entry (`src/server.ts`), so it plays two roles:
 *
 *   1. **Dev** — the Vite dev server imports this module and drives requests
 *      through the `default` export below, so the API + SSR run under Node with
 *      the same composed env as production.
 *   2. **Production** — `node dist/server/server.js` runs it directly, and the
 *      guarded block at the bottom boots a resident HTTP server via
 *      `createNodeServer`, wiring the pieces Cloudflare used to provide
 *      implicitly: a real per-request `waitUntil`, an origin-trust gate, an HTTP
 *      `scheduled()` hook for Cloud Scheduler, graceful drain, and static asset
 *      serving for the client build.
 *
 * Bindings are real Node providers, not Cloudflare emulation: in-process KV for
 * `CACHE`/`RATE_LIMIT`, and an S3-backed (or, offline, in-process) object store
 * for `MEDIA_BUCKET`/`DOCUMENTS_BUCKET`.
 */

/** Built client assets (`dist/client`), served for `/assets/*` and public files. */
const CLIENT_DIR =
  process.env.CLIENT_ASSETS_DIR ?? fileURLToPath(new URL("../client", import.meta.url))

/**
 * Build an object-store binding: S3-backed when R2 credentials are present,
 * otherwise an in-process store so local/dev/self-host runs work offline.
 */
function objectStore(bucketEnv: string | undefined): R2BucketShim {
  if (
    process.env.R2_S3_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    bucketEnv
  ) {
    return createR2BucketShim({
      endpoint: process.env.R2_S3_ENDPOINT,
      bucket: bucketEnv,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    })
  }
  return createMemoryR2Bucket()
}

function dbUrl(): string | undefined {
  const url = process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim()
  return url && isPostgresConnectionUrl(url) ? url : undefined
}

function isPostgresConnectionUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:"
  } catch {
    return false
  }
}

let sharedStoreDb: ReturnType<typeof createDbClient> | undefined

function resolveSharedStoreDb() {
  const url = dbUrl()
  if (!url) return undefined
  sharedStoreDb ??= createDbClient(url, { adapter: "node" })
  return sharedStoreDb
}

function createRuntimeStores(): {
  CACHE: KVStore
  RATE_LIMIT: KVStore
  RATE_LIMIT_STORE: NonNullable<AppBindings["RATE_LIMIT_STORE"]>
} {
  const l1Cache = createMemoryKvNamespace()
  const l1RateLimit = createMemoryKvNamespace()
  const redisUrl = process.env.REDIS_URL?.trim()

  if (redisUrl) {
    return {
      CACHE: createTieredKvStore(l1Cache, createRedisKvStore(redisUrl)),
      RATE_LIMIT: createTieredKvStore(l1RateLimit, createRedisKvStore(redisUrl)),
      RATE_LIMIT_STORE: createRedisRateLimitStore(redisUrl),
    }
  }

  const db = resolveSharedStoreDb()
  if (db) {
    return {
      CACHE: createTieredKvStore(l1Cache, createPostgresKvStore(db)),
      RATE_LIMIT: createTieredKvStore(l1RateLimit, createPostgresKvStore(db)),
      RATE_LIMIT_STORE: createPostgresFixedWindowRateLimitStore(db),
    }
  }

  return {
    CACHE: l1Cache,
    RATE_LIMIT: l1RateLimit,
    RATE_LIMIT_STORE: createMemoryRateLimitStore(),
  }
}

const stores = createRuntimeStores()

// Compose the env bag app code reads (`env.CACHE`, `env.MEDIA_BUCKET`, …).
const env = composeNodeEnv<AppBindings>(process.env, {
  kv: {
    CACHE: stores.CACHE,
    RATE_LIMIT: stores.RATE_LIMIT,
  },
  r2: {
    MEDIA_BUCKET: objectStore(process.env.R2_BUCKET_MEDIA),
    DOCUMENTS_BUCKET: objectStore(process.env.R2_BUCKET_DOCUMENTS),
  },
  extra: {
    RATE_LIMIT_STORE: stores.RATE_LIMIT_STORE,
  },
})

/**
 * Adapt the dedicated runtime's minimal `ExecutionContextLike` (real
 * `waitUntil`) to Hono's `ExecutionContext`, which additionally declares `props`
 * (only touched by app code that never runs on this path). A narrow seam so the
 * boundary needs no cast.
 */
function toExecutionContext(ctx: ExecutionContextLike): ExecutionContext {
  return {
    waitUntil: (promise) => ctx.waitUntil(promise),
    passThroughOnException: () => ctx.passThroughOnException?.(),
    props: undefined,
  }
}

// Serve built client assets, then fall through to the app (API + SSR). The SSR
// handler renders the document shell for any non-asset route, so no explicit
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
  console.info(`[operator] Node runtime listening on :${handle.port}`)
}
