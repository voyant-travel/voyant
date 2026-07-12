import { fileURLToPath, pathToFileURL } from "node:url"

import { serveAdminHost } from "@voyant-travel/admin-host/serve"
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

import {
  assertOperatorDeploymentGraphResourceEnv,
  loadOperatorDeploymentGraphArtifacts,
} from "./deployment-graph-artifacts"
import { fetch as appFetch, scheduled } from "./entry"
import {
  type OperatorNodeKvProvider,
  type OperatorNodeObjectStorageProvider,
  type OperatorNodeProviderPlan,
  resolveOperatorNodeProviderPlan,
  validateOperatorNodeProviderPlanEnv,
} from "./operator-node-provider-plan"

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
 * Bindings are real Node providers selected by the deployment graph, not
 * Cloudflare emulation: in-process KV for memory `CACHE`/`RATE_LIMIT`,
 * Postgres/Redis when the graph selects them, and S3/R2-backed object storage
 * only when graph providers require it.
 */

/** Built client assets (`dist/client`), served for `/assets/*` and public files. */
const CLIENT_DIR =
  process.env.CLIENT_ASSETS_DIR ?? fileURLToPath(new URL("../client", import.meta.url))
const deploymentGraphArtifacts = loadOperatorDeploymentGraphArtifacts()
const deploymentProviderPlan = resolveOperatorNodeProviderPlan(deploymentGraphArtifacts.providers)
assertOperatorNodeProviderPlanEnv(deploymentProviderPlan, process.env)

function objectStore(
  bucketEnvName: string,
  bucketEnv: string | undefined,
  provider: OperatorNodeObjectStorageProvider = deploymentProviderPlan.storage,
): R2BucketShim {
  switch (provider) {
    case "memory":
      return createMemoryR2Bucket()
    case "r2":
    case "s3":
      return createR2BucketShim({
        endpoint: requiredStringEnv("R2_S3_ENDPOINT", `storage provider ${provider}`),
        bucket: requiredStringValue(bucketEnvName, bucketEnv, `storage provider ${provider}`),
        accessKeyId: requiredStringEnv("R2_ACCESS_KEY_ID", `storage provider ${provider}`),
        secretAccessKey: requiredStringEnv("R2_SECRET_ACCESS_KEY", `storage provider ${provider}`),
      })
  }
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

function resolveSharedStoreDb(role: string) {
  const url = dbUrl()
  if (!url) {
    throw new Error(
      `DATABASE_URL or DATABASE_URL_DIRECT must be a postgres URL for graph-selected ${role}`,
    )
  }
  sharedStoreDb ??= createDbClient(url, { adapter: "node" })
  return sharedStoreDb
}

function createRuntimeStores(plan: OperatorNodeProviderPlan = deploymentProviderPlan): {
  CACHE: KVStore
  RATE_LIMIT: KVStore
  RATE_LIMIT_STORE: NonNullable<AppBindings["RATE_LIMIT_STORE"]>
} {
  const l1Cache = createMemoryKvNamespace()
  const l1RateLimit = createMemoryKvNamespace()

  return {
    CACHE: createKvStoreForProvider("cache", plan.cache, l1Cache),
    RATE_LIMIT: createKvStoreForProvider("rateLimit", plan.rateLimit, l1RateLimit),
    RATE_LIMIT_STORE: createRateLimitStoreForProvider(plan.rateLimit),
  }
}

function createKvStoreForProvider(
  role: "cache" | "rateLimit",
  provider: OperatorNodeKvProvider,
  l1Store: KVStore,
): KVStore {
  switch (provider) {
    case "memory":
      return l1Store
    case "redis":
      return createTieredKvStore(
        l1Store,
        createRedisKvStore(requiredStringEnv("REDIS_URL", `${role} provider redis`)),
      )
    case "postgres":
      return createTieredKvStore(
        l1Store,
        createPostgresKvStore(resolveSharedStoreDb(`${role} provider postgres`)),
      )
  }
}

function createRateLimitStoreForProvider(
  provider: OperatorNodeKvProvider,
): NonNullable<AppBindings["RATE_LIMIT_STORE"]> {
  switch (provider) {
    case "memory":
      return createMemoryRateLimitStore()
    case "redis":
      return createRedisRateLimitStore(requiredStringEnv("REDIS_URL", "rateLimit provider redis"))
    case "postgres":
      return createPostgresFixedWindowRateLimitStore(
        resolveSharedStoreDb("rateLimit provider postgres"),
      )
  }
}

function requiredStringEnv(name: string, context: string): string {
  return requiredStringValue(name, process.env[name], context)
}

function requiredStringValue(name: string, value: string | undefined, context: string): string {
  const trimmed = value?.trim()
  if (trimmed) return trimmed
  throw new Error(`${name} is required for graph-selected ${context}`)
}

const stores = createRuntimeStores()

// Compose the env bag app code reads (`env.CACHE`, `env.MEDIA_BUCKET`, …).
const env = composeNodeEnv<AppBindings>(process.env, {
  kv: {
    CACHE: stores.CACHE,
    RATE_LIMIT: stores.RATE_LIMIT,
  },
  r2: {
    MEDIA_BUCKET: objectStore("R2_BUCKET_MEDIA", process.env.R2_BUCKET_MEDIA),
    DOCUMENTS_BUCKET: objectStore("R2_BUCKET_DOCUMENTS", process.env.R2_BUCKET_DOCUMENTS),
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
const web = serveAdminHost<AppBindings>({
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
  assertOperatorDeploymentGraphResourceEnv(deploymentGraphArtifacts, process.env)

  const handle = createNodeServer<AppBindings>({
    fetch: (request, bindings, ctx) => web.fetch(request, bindings, toExecutionContext(ctx)),
    scheduled: (event, bindings, ctx) => scheduled(event, bindings, toExecutionContext(ctx)),
    env,
    port: Number.parseInt(process.env.PORT ?? "8080", 10),
    ...(process.env.ORIGIN_TRUST_SECRET
      ? { originTrustSecret: process.env.ORIGIN_TRUST_SECRET }
      : {}),
  })
  console.info(
    `[operator] Node runtime listening on :${handle.port} (${deploymentGraphArtifacts.graphHash})`,
  )
}

function assertOperatorNodeProviderPlanEnv(
  plan: OperatorNodeProviderPlan,
  envValues: Record<string, unknown>,
): void {
  const issues = validateOperatorNodeProviderPlanEnv(plan, envValues)
  if (issues.length === 0) return
  throw new Error(
    `Operator deployment graph provider plan requirements are not satisfied:\n${formatIssues(
      issues,
    )}`,
  )
}

function formatIssues(issues: readonly string[]): string {
  return issues.map((issue) => `- ${issue}`).join("\n")
}
