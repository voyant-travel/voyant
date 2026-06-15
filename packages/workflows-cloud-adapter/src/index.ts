// agent-quality: file-size exception -- owner: workflows-cloud-adapter; existing module stays co-located until a dedicated split preserves behavior and tests.
// @voyant-travel/workflows-cloud-adapter
//
// Legacy Tenant Worker adapter for Cloudflare-hosted workflow experiments.

import { createBearerVerifier } from "@voyant-travel/workflows/auth"
import { handleStepRequest } from "@voyant-travel/workflows/handler"
import { createInMemoryRateLimiter } from "@voyant-travel/workflows/rate-limit"
import type { StepHandler } from "@voyant-travel/workflows-orchestrator"
import {
  type CfManifestStore,
  createInlineDispatcher,
  createKvManifestStore,
  type DurableObjectNamespaceLike,
  type DurableObjectStorageLike,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
  handleWorkerRequest,
  type KvNamespaceLike,
  type StepDispatcher,
  type WorkerFetchDeps,
} from "@voyant-travel/workflows-orchestrator-cloudflare"

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
  services?: import("@voyant-travel/workflows/driver").ServiceResolver
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
  void env
  const rateLimiter = createInMemoryRateLimiter()

  return (req, stepOptions) =>
    handleStepRequest(
      req,
      {
        rateLimiter,
        services: options.services,
        now: options.now,
        logger: options.logger,
      },
      stepOptions,
    )
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
      "@voyant-travel/workflows-cloud-adapter: env must be passed to fetch(request, env) or createCloudOrchestrator(workflows, env)",
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
