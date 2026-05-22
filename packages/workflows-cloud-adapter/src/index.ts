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
  type CfManifestStore,
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

import { type AutoPublishContext, scheduleAutoPublishManifest } from "./auto-publish.js"

export {
  type AutoPublishContext,
  publishManifest,
  scheduleAutoPublishManifest,
  type WorkflowEnvironment,
} from "./auto-publish.js"

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
   * Deployment environment label used when the cloud adapter auto-publishes
   * the in-process workflow registry to `WORKFLOW_MANIFESTS`. Voyant Cloud
   * injects this on tenant workers; defaults to `"production"` when unset.
   */
  VOYANT_WORKFLOWS_ENVIRONMENT?: "production" | "preview" | "development" | string
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
  /** Platform-managed Cloud Run node step runner endpoint. */
  VOYANT_WORKFLOW_NODE_RUNNER_URL?: string
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
  /**
   * Opt out of the cold-start auto-publish of the in-process workflow
   * registry to `WORKFLOW_MANIFESTS` KV. Default: auto-publish is on
   * whenever the KV binding is present. Set to `false` if your deploy
   * pipeline already POSTs `/api/manifests` and you want a single
   * source of truth.
   */
  autoPublishManifest?: boolean
  /**
   * Cloudflare `ctx.waitUntil` — when provided, the auto-publish
   * background task is registered with it so the response isn't held
   * back by the KV write. Pass `(p) => ctx.waitUntil(p)` from the
   * outer `fetch(request, env, ctx)` handler.
   */
  waitUntil?: (promise: Promise<unknown>) => void
}

/**
 * Cloudflare ExecutionContext-like shape consumed by the cloud
 * orchestrator. Declared structurally so this package doesn't pull in
 * `@cloudflare/workers-types` — pass the real `ctx` from your worker's
 * `fetch(request, env, ctx)` and the structural shape will match.
 */
export interface CloudExecutionCtx {
  waitUntil?: (promise: Promise<unknown>) => void
}

export interface CloudOrchestrator<Env extends CloudWorkflowsEnv = CloudWorkflowsEnv> {
  fetch: (request: Request, env?: Env, ctx?: CloudExecutionCtx) => Promise<Response>
  WorkflowRunDO: WorkflowRunDOClass<Env>
}

type EnvCache = {
  dispatcher?: StepDispatcher
  dispatcherOptions?: CloudExecutionOptions<CloudWorkflowsEnv>
  stepHandler?: StepHandler
  stepHandlerOptions?: CloudExecutionOptions<CloudWorkflowsEnv>
  manifestStore?: CfManifestStore
  manifestStoreKv?: KvNamespaceLike
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
    fetch(request, requestEnv, ctx) {
      const env = resolveBoundEnv(boundEnv, requestEnv, options)
      const callOptions = ctx?.waitUntil
        ? { ...options, waitUntil: options.waitUntil ?? ctx.waitUntil.bind(ctx) }
        : options
      return handleCloudFetch(request, env, callOptions)
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
      const ctx = extractCtx(args)
      return orchestrator.fetch(request, requestEnv, ctx)
    })
    return app
  }

  if (typeof app.fetch === "function") {
    const originalFetch = app.fetch.bind(app)
    ;(app as { fetch: typeof app.fetch }).fetch = (request, requestEnv, ctx) => {
      if (isMountedPath(new URL(request.url).pathname, pathPrefix)) {
        return orchestrator.fetch(
          request,
          (requestEnv as Env | undefined) ?? env,
          ctx as CloudExecutionCtx | undefined,
        )
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

  const manifestStore = resolveManifestStore(resolvedEnv)

  if (manifestStore && options.autoPublishManifest !== false) {
    const autoPublishCtx: AutoPublishContext = {
      manifestStore,
      environment: resolvedEnv.VOYANT_WORKFLOWS_ENVIRONMENT,
      logger: options.logger,
      ...(options.waitUntil ? { waitUntil: options.waitUntil } : {}),
    }
    scheduleAutoPublishManifest(autoPublishCtx)
  }

  return handleWorkerRequest(request, {
    runDO: resolvedEnv.WORKFLOW_RUN_DO,
    verifyRequest:
      options.verifyRequest ?? (tokens.length > 0 ? createBearerVerifier(tokens) : undefined),
    logger: options.logger,
    idGenerator: options.idGenerator,
    now: options.now,
    tenantMeta: options.tenantMeta,
    manifestStore,
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

function resolveManifestStore(env: CloudWorkflowsEnv): CfManifestStore | undefined {
  const kv = env.WORKFLOW_MANIFESTS
  if (!kv) return undefined
  const cache = cacheFor(env)
  // Re-create when the KV binding identity changes (e.g. a test that
  // swaps namespaces on the same env reference). In production the
  // binding is stable across requests so this path is a cache hit and
  // the WeakSet-based latch in scheduleAutoPublishManifest works as
  // intended.
  if (!cache.manifestStore || cache.manifestStoreKv !== kv) {
    cache.manifestStoreKv = kv
    cache.manifestStore = createKvManifestStore({ kv })
  }
  return cache.manifestStore
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
  if (env.VOYANT_WORKFLOW_NODE_RUNNER_URL) {
    return createHttpNodeStepRunner(env, options)
  }

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

async function createHttpNodeStepRunner<Env extends CloudWorkflowsEnv>(
  env: Env,
  options: CloudExecutionOptions<Env>,
): Promise<StepRunner> {
  const serviceUrl = env.VOYANT_WORKFLOW_NODE_RUNNER_URL?.replace(/\/+$/, "")
  if (!serviceUrl) {
    throw new Error("@voyantjs/workflows-cloud-adapter: VOYANT_WORKFLOW_NODE_RUNNER_URL is empty")
  }
  const key = env.VOYANT_WORKFLOW_BUNDLE_KEY
  const hash = env.VOYANT_WORKFLOW_BUNDLE_HASH
  const missing = [
    ["VOYANT_WORKFLOW_BUNDLE_KEY", key],
    ["VOYANT_WORKFLOW_BUNDLE_HASH", hash],
  ].filter(([, value]) => typeof value !== "string" || value.length === 0)
  if (missing.length > 0) {
    throw new Error(
      `@voyantjs/workflows-cloud-adapter: Cloud Run node runner is configured but bundle env is incomplete: ${missing
        .map(([name]) => name)
        .join(", ")}`,
    )
  }
  const sign = env.VOYANT_WORKFLOW_STEP_AUTH_SECRET
    ? await createHmacSigner(env.VOYANT_WORKFLOW_STEP_AUTH_SECRET)
    : undefined

  return async ({
    stepId,
    attempt,
    input,
    stepCtx,
    runId,
    workflowId,
    workflowVersion,
    projectId,
    organizationId,
    options: stepOptions,
    journal,
  }): Promise<StepJournalEntry> => {
    const startedAt = Date.now()
    const payload = {
      runId,
      workflowId,
      workflowVersion,
      projectId,
      organizationId,
      stepId,
      attempt,
      input,
      options: {
        machine: stepOptions.machine,
        timeout:
          typeof stepOptions.timeout === "string" || typeof stepOptions.timeout === "number"
            ? stepOptions.timeout
            : undefined,
      },
      bundle: {
        key,
        hash,
      },
      journal,
    }
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
    }
    if (sign) headers["x-voyant-step-auth"] = await sign(body)

    let response: Response
    try {
      response = await fetch(`${serviceUrl}/step`, {
        method: "POST",
        headers,
        body,
        signal: stepCtx.signal,
      })
    } catch (err) {
      options.logger?.("error", "cloud-run-node: fetch threw", {
        runId,
        stepId,
        error: err instanceof Error ? err.message : String(err),
      })
      return failedNodeStep(attempt, startedAt, "NODE_RUNNER_DISPATCH_FAILED", err)
    }

    const text = await response.text()
    if (!response.ok) {
      options.logger?.("warn", "cloud-run-node: non-2xx response", {
        runId,
        stepId,
        status: response.status,
        body: text.slice(0, 500),
      })
      return failedNodeStep(
        attempt,
        startedAt,
        "NODE_RUNNER_HTTP_ERROR",
        new Error(`node runner returned HTTP ${response.status}: ${text}`),
      )
    }

    try {
      return JSON.parse(text) as StepJournalEntry
    } catch (err) {
      return failedNodeStep(
        attempt,
        startedAt,
        "NODE_RUNNER_INVALID_RESPONSE",
        new Error(`node runner returned non-JSON body: ${String(err)}`),
      )
    }
  }
}

function failedNodeStep(
  attempt: number,
  startedAt: number,
  code: string,
  err: unknown,
): StepJournalEntry {
  const e = err instanceof Error ? err : new Error(String(err))
  return {
    attempt,
    status: "err",
    startedAt,
    finishedAt: Date.now(),
    runtime: "node",
    error: {
      category: "RUNTIME_ERROR",
      code,
      message: e.message,
      name: e.name,
      stack: e.stack,
    },
  }
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

function extractCtx(args: readonly unknown[]): CloudExecutionCtx | undefined {
  // Hono passes (c, next) with executionCtx on the context; raw workers
  // pass (request, env, ctx) directly. Probe both shapes so the auto-publish
  // background task can register with the right waitUntil.
  const honoCtx = args[0] as { executionCtx?: CloudExecutionCtx } | undefined
  if (honoCtx?.executionCtx?.waitUntil) return honoCtx.executionCtx
  const rawCtx = args[2] as CloudExecutionCtx | undefined
  if (rawCtx && typeof rawCtx.waitUntil === "function") return rawCtx
  return undefined
}
