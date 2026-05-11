// @voyantjs/workflows-cloud-adapter
//
// Tenant Worker adapter for Voyant Cloud's workflows runtime. The package
// keeps tenant entrypoints small while preserving the same Cloudflare
// Durable Object run model used by the lower-level orchestrator adapter.

import { createBearerVerifier, createHmacSigner } from "@voyantjs/workflows/auth"
import {
  handleStepRequest,
  type StepJournalEntry,
  type StepRunner,
} from "@voyantjs/workflows/handler"
import { createInMemoryRateLimiter } from "@voyantjs/workflows/rate-limit"
import type { StepHandler } from "@voyantjs/workflows-orchestrator"
import {
  type ContainerNamespaceLike,
  createCfContainerStepRunner,
  createInlineDispatcher,
  createKvManifestStore,
  createR2Presigner,
  type DurableObjectNamespaceLike,
  type DurableObjectStorageLike,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
  handleWorkerRequest,
  type KvNamespaceLike,
  type StepDispatcher,
  type WorkerFetchDeps,
} from "@voyantjs/workflows-orchestrator-cloudflare"

export interface CloudWorkflowsEnv {
  /** Per-run Durable Object namespace declared by the tenant Worker. */
  WORKFLOW_RUN_DO: DurableObjectNamespaceLike
  /**
   * Platform-injected namespace for the node step-runner Container fleet.
   * The binding may target the shared platform fleet or a platform-operated
   * per-org dedicated runner; the tenant adapter treats both the same.
   */
  STEP_RUNNER?: ContainerNamespaceLike
  /**
   * Optional KV namespace for workflow manifests. When present,
   * `/api/manifests*` and `/api/events` are enabled.
   */
  WORKFLOW_MANIFESTS?: KvNamespaceLike
  /**
   * Comma-separated bearer tokens for public `/api/*` routes. Omit for local
   * development only.
   */
  VOYANT_API_TOKENS?: string
  /**
   * Prefix for the R2 S3 API URL that hosts the container bundle.
   * Expected form: `https://<account>.r2.cloudflarestorage.com/<bucket>`.
   */
  VOYANT_WORKFLOW_BUNDLE_URL_PREFIX?: string
  /** R2 object key for this tenant Worker version's `container.mjs`. */
  VOYANT_WORKFLOW_BUNDLE_KEY?: string
  /** SHA-256 hex, or `sha256:<hex>`, for the container bundle bytes. */
  VOYANT_WORKFLOW_BUNDLE_HASH?: string
  /** R2 read-only access key id used to mint short-lived signed bundle URLs. */
  VOYANT_WORKFLOW_BUNDLE_R2_ACCESS_KEY_ID?: string
  /** R2 read-only secret access key used to mint short-lived signed bundle URLs. */
  VOYANT_WORKFLOW_BUNDLE_R2_SECRET_ACCESS_KEY?: string
  /** Optional explicit R2 account id. Defaults to parsing URL_PREFIX. */
  VOYANT_WORKFLOW_BUNDLE_R2_ACCOUNT_ID?: string
  /** Optional explicit R2 bucket. Defaults to parsing URL_PREFIX. */
  VOYANT_WORKFLOW_BUNDLE_R2_BUCKET?: string
  /** Optional signed URL TTL in seconds. Defaults to 300. */
  VOYANT_WORKFLOW_BUNDLE_URL_TTL_SECONDS?: string
  /** Shared secret used to sign dispatches to the platform step runner. */
  VOYANT_WORKFLOW_STEP_AUTH_SECRET?: string
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike
}

export interface CloudOrchestratorOptions<Env extends CloudWorkflowsEnv = CloudWorkflowsEnv> {
  verifyRequest?: WorkerFetchDeps["verifyRequest"]
  logger?: WorkerFetchDeps["logger"]
  idGenerator?: WorkerFetchDeps["idGenerator"]
  now?: () => number
  tenantMeta?: WorkerFetchDeps["tenantMeta"]
  services?: import("@voyantjs/workflows/driver").ServiceResolver
  resolveEnv?: (env: Env) => Env
}

export interface CloudOrchestrator<Env extends CloudWorkflowsEnv = CloudWorkflowsEnv> {
  fetch: (request: Request, env?: Env) => Promise<Response>
  WorkflowRunDO: WorkflowRunDOClass<Env>
}

type EnvCache = {
  dispatcher?: StepDispatcher
  dispatcherOptions?: CloudExecutionOptions<CloudWorkflowsEnv>
  stepHandler?: StepHandler
  stepHandlerOptions?: CloudExecutionOptions<CloudWorkflowsEnv>
}

const envCache = new WeakMap<object, EnvCache>()
const defaultExecutionOptions: CloudExecutionOptions<CloudWorkflowsEnv> = {}

export type WorkflowRunDOClass<Env extends CloudWorkflowsEnv = CloudWorkflowsEnv> = new (
  state: DurableObjectStateLike,
  env: Env,
) => WorkflowRunDO<Env>

type CloudExecutionOptions<Env extends CloudWorkflowsEnv = CloudWorkflowsEnv> = Pick<
  CloudOrchestratorOptions<Env>,
  "services" | "now" | "logger"
>

export function createCloudOrchestrator<Env extends CloudWorkflowsEnv = CloudWorkflowsEnv>(
  workflows?: unknown,
  boundEnv?: Env,
  options: CloudOrchestratorOptions<Env> = {},
): CloudOrchestrator<Env> {
  void workflows
  const WorkflowRunDOWithOptions = createWorkflowRunDOClass<Env>(options)

  return {
    fetch(request, requestEnv) {
      const env = resolveBoundEnv(boundEnv, requestEnv, options)
      return handleCloudFetch(request, env, options)
    },
    WorkflowRunDO: WorkflowRunDOWithOptions,
  }
}

export function mountWorkflows<
  App extends {
    all?: (path: string, handler: (...args: unknown[]) => Response | Promise<Response>) => unknown
    fetch?: (request: Request, env?: unknown, ctx?: unknown) => Response | Promise<Response>
  },
  Env extends CloudWorkflowsEnv = CloudWorkflowsEnv,
>(app: App, env?: Env, options: CloudOrchestratorOptions<Env> & { pathPrefix?: string } = {}): App {
  const orchestrator = createCloudOrchestrator(undefined, env, options)
  const pathPrefix = normalizePathPrefix(options.pathPrefix ?? "/api")

  if (typeof app.all === "function") {
    app.all(`${pathPrefix}/*`, (...args) => {
      const request = extractRequest(args)
      const requestEnv = extractEnv<Env>(args, env)
      return orchestrator.fetch(request, requestEnv)
    })
    return app
  }

  if (typeof app.fetch === "function") {
    const originalFetch = app.fetch.bind(app)
    ;(app as { fetch: typeof app.fetch }).fetch = (request, requestEnv, ctx) => {
      if (isMountedPath(new URL(request.url).pathname, pathPrefix)) {
        return orchestrator.fetch(request, (requestEnv as Env | undefined) ?? env)
      }
      return originalFetch(request, requestEnv, ctx)
    }
    return app
  }

  throw new Error(
    "mountWorkflows: app must expose either all(path, handler) or fetch(request, env)",
  )
}

export async function handleCloudFetch<Env extends CloudWorkflowsEnv = CloudWorkflowsEnv>(
  request: Request,
  env: Env,
  options: CloudOrchestratorOptions<Env> = {},
): Promise<Response> {
  const resolvedEnv = options.resolveEnv?.(env) ?? env
  const tokens = (resolvedEnv.VOYANT_API_TOKENS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return handleWorkerRequest(request, {
    runDO: resolvedEnv.WORKFLOW_RUN_DO,
    verifyRequest:
      options.verifyRequest ?? (tokens.length > 0 ? createBearerVerifier(tokens) : undefined),
    logger: options.logger,
    idGenerator: options.idGenerator,
    now: options.now,
    tenantMeta: options.tenantMeta,
    manifestStore: resolvedEnv.WORKFLOW_MANIFESTS
      ? createKvManifestStore({ kv: resolvedEnv.WORKFLOW_MANIFESTS })
      : undefined,
  })
}

export class WorkflowRunDO<Env extends CloudWorkflowsEnv = CloudWorkflowsEnv> {
  private readonly state: DurableObjectStateLike
  private readonly env: Env

  constructor(state: DurableObjectStateLike, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    return handleDurableObjectRequest(request, {
      storage: this.state.storage,
      dispatcher: resolveDispatcher(this.env, this.executionOptions()),
      now: this.executionOptions().now,
    })
  }

  async alarm(): Promise<void> {
    await handleDurableObjectAlarm({
      storage: this.state.storage,
      dispatcher: resolveDispatcher(this.env, this.executionOptions()),
      now: this.executionOptions().now,
    })
  }

  protected executionOptions(): CloudExecutionOptions<Env> {
    return defaultExecutionOptions as CloudExecutionOptions<Env>
  }
}

export function createCloudStepDispatcher<Env extends CloudWorkflowsEnv = CloudWorkflowsEnv>(
  env: Env,
  options: CloudExecutionOptions<Env> = defaultExecutionOptions as CloudExecutionOptions<Env>,
): StepDispatcher {
  return createInlineDispatcher(resolveStepHandler(env, options))
}

function createWorkflowRunDOClass<Env extends CloudWorkflowsEnv>(
  options: CloudExecutionOptions<Env>,
): WorkflowRunDOClass<Env> {
  return class CloudWorkflowRunDO extends WorkflowRunDO<Env> {
    protected override executionOptions(): CloudExecutionOptions<Env> {
      return options
    }
  }
}

function resolveDispatcher<Env extends CloudWorkflowsEnv>(
  env: Env,
  options: CloudExecutionOptions<Env> = defaultExecutionOptions as CloudExecutionOptions<Env>,
): StepDispatcher {
  const cache = cacheFor(env)
  if (!cache.dispatcher || cache.dispatcherOptions !== options) {
    cache.dispatcherOptions = options
    cache.dispatcher = createCloudStepDispatcher(env, options)
  }
  return cache.dispatcher
}

function resolveStepHandler<Env extends CloudWorkflowsEnv>(
  env: Env,
  options: CloudExecutionOptions<Env> = defaultExecutionOptions as CloudExecutionOptions<Env>,
): StepHandler {
  const cache = cacheFor(env)
  if (!cache.stepHandler || cache.stepHandlerOptions !== options) {
    cache.stepHandlerOptions = options
    const handlerPromise = buildStepHandler(env, options)
    cache.stepHandler = (req, stepOptions) =>
      handlerPromise.then((handler) => handler(req, stepOptions))
  }
  return cache.stepHandler
}

async function buildStepHandler<Env extends CloudWorkflowsEnv>(
  env: Env,
  options: CloudExecutionOptions<Env> = defaultExecutionOptions as CloudExecutionOptions<Env>,
): Promise<StepHandler> {
  const nodeStepRunner = await createNodeStepRunner(env, options)
  const rateLimiter = createInMemoryRateLimiter()

  return (req, stepOptions) =>
    handleStepRequest(
      req,
      {
        rateLimiter,
        nodeStepRunner,
        services: options.services,
        now: options.now,
        logger: options.logger,
      },
      stepOptions,
    )
}

async function createNodeStepRunner<Env extends CloudWorkflowsEnv>(
  env: Env,
  options: CloudExecutionOptions<Env>,
): Promise<StepRunner> {
  if (!env.STEP_RUNNER) {
    return createInlineNodeStepRunner(options.now)
  }

  const bundle = resolveBundleConfig(env)
  const presign = createR2Presigner({
    accountId: bundle.accountId,
    accessKeyId: bundle.accessKeyId,
    secretAccessKey: bundle.secretAccessKey,
    bucket: bundle.bucket,
  })
  const sign = env.VOYANT_WORKFLOW_STEP_AUTH_SECRET
    ? await createHmacSigner(env.VOYANT_WORKFLOW_STEP_AUTH_SECRET)
    : undefined

  return createCfContainerStepRunner({
    namespace: env.STEP_RUNNER,
    sign,
    logger: options.logger,
    resolveBundle: async () => ({
      url: await presign({
        key: bundle.key,
        expiresIn: bundle.expiresIn,
      }),
      hash: bundle.hash,
    }),
  })
}

function createInlineNodeStepRunner(now = () => Date.now()): StepRunner {
  return async ({ attempt, fn, stepCtx }): Promise<StepJournalEntry> => {
    const startedAt = now()
    try {
      return {
        attempt,
        status: "ok",
        output: await fn(stepCtx),
        startedAt,
        finishedAt: now(),
      }
    } catch (err) {
      const e = err as Error
      return {
        attempt,
        status: "err",
        startedAt,
        finishedAt: now(),
        error: {
          category: "USER_ERROR",
          code:
            typeof (err as { code?: unknown }).code === "string"
              ? (err as { code: string }).code
              : "UNKNOWN",
          message: e?.message ?? String(err),
          name: e?.name,
          stack: e?.stack,
        },
      }
    }
  }
}

function resolveBundleConfig(env: CloudWorkflowsEnv): {
  accountId: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  key: string
  hash: string
  expiresIn: number
} {
  const parsedPrefix = parseBundleUrlPrefix(env.VOYANT_WORKFLOW_BUNDLE_URL_PREFIX)
  const accountId = env.VOYANT_WORKFLOW_BUNDLE_R2_ACCOUNT_ID ?? parsedPrefix.accountId
  const bucket = env.VOYANT_WORKFLOW_BUNDLE_R2_BUCKET ?? parsedPrefix.bucket
  const accessKeyId = env.VOYANT_WORKFLOW_BUNDLE_R2_ACCESS_KEY_ID
  const secretAccessKey = env.VOYANT_WORKFLOW_BUNDLE_R2_SECRET_ACCESS_KEY
  const key = env.VOYANT_WORKFLOW_BUNDLE_KEY
  const hash = env.VOYANT_WORKFLOW_BUNDLE_HASH

  const missing = [
    ["VOYANT_WORKFLOW_BUNDLE_R2_ACCESS_KEY_ID", accessKeyId],
    ["VOYANT_WORKFLOW_BUNDLE_R2_SECRET_ACCESS_KEY", secretAccessKey],
    ["VOYANT_WORKFLOW_BUNDLE_KEY", key],
    ["VOYANT_WORKFLOW_BUNDLE_HASH", hash],
  ].filter(([, value]) => typeof value !== "string" || value.length === 0)

  if (!env.VOYANT_WORKFLOW_BUNDLE_URL_PREFIX && (!accountId || !bucket)) {
    missing.push(["VOYANT_WORKFLOW_BUNDLE_URL_PREFIX", env.VOYANT_WORKFLOW_BUNDLE_URL_PREFIX])
  }
  if (!accountId) missing.push(["VOYANT_WORKFLOW_BUNDLE_R2_ACCOUNT_ID", accountId])
  if (!bucket) missing.push(["VOYANT_WORKFLOW_BUNDLE_R2_BUCKET", bucket])
  if (missing.length > 0) {
    throw new Error(
      `@voyantjs/workflows-cloud-adapter: STEP_RUNNER is configured but bundle env is incomplete: ${missing
        .map(([name]) => name)
        .join(", ")}`,
    )
  }

  const expiresIn = Number(env.VOYANT_WORKFLOW_BUNDLE_URL_TTL_SECONDS ?? 300)
  if (!Number.isFinite(expiresIn) || expiresIn < 1 || expiresIn > 604_800) {
    throw new Error(
      "@voyantjs/workflows-cloud-adapter: VOYANT_WORKFLOW_BUNDLE_URL_TTL_SECONDS must be 1..604800",
    )
  }

  return {
    accountId: accountId!,
    bucket: bucket!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    key: key!,
    hash: hash!,
    expiresIn,
  }
}

function parseBundleUrlPrefix(prefix: string | undefined): {
  accountId?: string
  bucket?: string
} {
  if (!prefix) return {}
  const url = new URL(prefix)
  const suffix = ".r2.cloudflarestorage.com"
  const accountId = url.hostname.endsWith(suffix)
    ? url.hostname.slice(0, -suffix.length)
    : undefined
  const bucket = url.pathname.replace(/^\/+/, "").split("/")[0]
  return {
    accountId: accountId && accountId.length > 0 ? accountId : undefined,
    bucket: bucket && bucket.length > 0 ? bucket : undefined,
  }
}

function cacheFor(env: object): EnvCache {
  let cache = envCache.get(env)
  if (!cache) {
    cache = {}
    envCache.set(env, cache)
  }
  return cache
}

function resolveBoundEnv<Env extends CloudWorkflowsEnv>(
  boundEnv: Env | undefined,
  requestEnv: Env | undefined,
  options: CloudOrchestratorOptions<Env>,
): Env {
  const env = requestEnv ?? boundEnv
  if (!env) {
    throw new Error(
      "@voyantjs/workflows-cloud-adapter: env must be passed to fetch(request, env) or createCloudOrchestrator(workflows, env)",
    )
  }
  return options.resolveEnv?.(env) ?? env
}

function normalizePathPrefix(prefix: string): string {
  if (prefix === "/") return ""
  return `/${prefix.replace(/^\/+|\/+$/g, "")}`
}

function isMountedPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function extractRequest(args: readonly unknown[]): Request {
  const first = args[0]
  if (first instanceof Request) return first
  const raw = (first as { req?: { raw?: unknown } } | undefined)?.req?.raw
  if (raw instanceof Request) return raw
  throw new Error("mountWorkflows: could not resolve Request from route handler arguments")
}

function extractEnv<Env extends CloudWorkflowsEnv>(
  args: readonly unknown[],
  boundEnv: Env | undefined,
): Env | undefined {
  if (boundEnv) return boundEnv
  const firstEnv = (args[0] as { env?: unknown } | undefined)?.env
  return (firstEnv as Env | undefined) ?? (args[1] as Env | undefined)
}
