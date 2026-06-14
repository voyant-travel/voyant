import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { BULK_REINDEX_SERVICE_KEY } from "@voyant-travel/commerce"
import { createWorkerFetch, withActiveRouteSsrManifest } from "@voyant-travel/worker-runtime"
import type { StepHandler } from "@voyant-travel/workflows-orchestrator"
import type {
  createInlineDispatcher,
  StepDispatcher,
} from "@voyant-travel/workflows-orchestrator-cloudflare"
import { operatorApiDispatch } from "./hono-api-dispatch"
import {
  CHANNEL_PUSH_AVAILABILITY_CRON,
  CHANNEL_PUSH_BOOKING_LINK_CRON,
  CHANNEL_PUSH_CONTENT_CRON,
  DRAFT_REAPER_CRON,
  EXTERNAL_CRUISE_CATALOG_REFRESH_CRON,
  OUTBOX_DRAIN_CRON,
  PROMOTION_BOUNDARY_SCHEDULER_CRON,
} from "./scheduled-crons"

const startHandler = createStartHandler(withActiveRouteSsrManifest(defaultStreamHandler))

const workerFetch = createWorkerFetch<CloudflareBindings, ExecutionContext>({
  api: operatorApiDispatch,
  ssr: (request, env) => startHandler(request, { context: { env } } as never),
})

let workflowDefinitionsPromise: Promise<unknown> | undefined
function loadWorkflowDefinitions(): Promise<unknown> {
  workflowDefinitionsPromise ??= import("./workflows.js")
  return workflowDefinitionsPromise
}

let workflowRuntimePromise:
  | Promise<typeof import("@voyant-travel/workflows-orchestrator-cloudflare")>
  | undefined
function loadWorkflowRuntime(): Promise<
  typeof import("@voyant-travel/workflows-orchestrator-cloudflare")
> {
  workflowRuntimePromise ??= import("@voyant-travel/workflows-orchestrator-cloudflare")
  return workflowRuntimePromise
}

type InlineDispatcherFactory = typeof createInlineDispatcher

export default {
  fetch: workerFetch,

  // Cloudflare Workers cron entrypoint. Triggers are declared in
  // wrangler.jsonc; the channel-push reconciler picks the right scanner
  // based on `event.cron`.
  async scheduled(
    event: ScheduledController,
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ): Promise<void> {
    if (event.cron === OUTBOX_DRAIN_CRON) {
      ctx.waitUntil(
        import("./api/outbox-drain-scheduled")
          .then((mod) => mod.runScheduledOutboxDrain(event, env))
          .then((result) => {
            if (result.claimed > 0 || result.deadLettered > 0) {
              console.info("[outbox-drain] result", result)
            }
          }),
      )
      return
    }
    if (event.cron === DRAFT_REAPER_CRON) {
      ctx.waitUntil(
        import("./api/draft-reaper-scheduled")
          .then((mod) => mod.runScheduledDraftReaper(event, env))
          .then((result) => {
            console.info("[draft-reaper] result", result)
          }),
      )
      return
    }
    if (event.cron === PROMOTION_BOUNDARY_SCHEDULER_CRON) {
      ctx.waitUntil(
        import("./api/promotion-scheduled")
          .then((mod) => mod.runScheduledPromotionBoundary(event, env))
          .then((result) => {
            console.info("[promotion-scheduler] result", result)
          }),
      )
      return
    }
    if (
      event.cron === CHANNEL_PUSH_BOOKING_LINK_CRON ||
      event.cron === CHANNEL_PUSH_AVAILABILITY_CRON ||
      event.cron === CHANNEL_PUSH_CONTENT_CRON
    ) {
      ctx.waitUntil(
        import("./api/channel-push-scheduled").then((mod) =>
          mod.runScheduledChannelPushReconciler(event, env),
        ),
      )
      return
    }
    if (event.cron === EXTERNAL_CRUISE_CATALOG_REFRESH_CRON) {
      ctx.waitUntil(
        import("./api/external-cruise-refresh-scheduled")
          .then((mod) => mod.runScheduledExternalCruiseCatalogRefresh(event, env))
          .then((result) => {
            console.info("[external-cruise-refresh] result", result)
          }),
      )
      return
    }
    console.warn("[scheduled] unknown cron expression", { cron: event.cron })
  },
}

/**
 * Per-run Durable Object backing the inline workflow runtime.
 *
 * The CF edge driver in `@voyant-travel/workflows-orchestrator-cloudflare`
 * addresses one DO per `runId`, each holding the run journal in DO
 * storage and dispatching steps through the `StepDispatcher` resolved
 * here. We use the inline dispatcher because workflow code lives in
 * THIS Worker. The workflow definitions are loaded lazily by the step
 * handler before execution, so step bodies can be invoked by direct call
 * without forcing the full workflow graph into Worker startup.
 *
 * Services available to step bodies via `ctx.services.resolve(...)` are
 * registered by `buildWorkflowStepServices(env)` below. Keep the surface
 * narrow — only services workflows actually need belong here.
 */
export class WorkflowRunDO implements DurableObject {
  private readonly state: DurableObjectState
  private readonly env: CloudflareBindings
  private dispatcher: StepDispatcher | undefined

  constructor(state: DurableObjectState, env: CloudflareBindings) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const { createInlineDispatcher, handleDurableObjectRequest } = await loadWorkflowRuntime()
    return handleDurableObjectRequest(request, this.deps(createInlineDispatcher))
  }

  async alarm(): Promise<void> {
    const { createInlineDispatcher, handleDurableObjectAlarm } = await loadWorkflowRuntime()
    await handleDurableObjectAlarm(this.deps(createInlineDispatcher))
  }

  private deps(inlineDispatcherFactory: InlineDispatcherFactory) {
    return {
      storage: this.state.storage,
      dispatcher: this.resolveDispatcher(inlineDispatcherFactory),
    }
  }

  private resolveDispatcher(inlineDispatcherFactory: InlineDispatcherFactory): StepDispatcher {
    if (this.dispatcher) return this.dispatcher
    this.dispatcher = inlineDispatcherFactory(buildStepHandler(this.env))
    return this.dispatcher
  }
}

/**
 * Build the in-process StepHandler. One per DO instance. Threads:
 *   - the workflow registry (populated by lazy-importing `./workflows.js`
 *     before the first step request)
 *   - the workflow-step service resolver (built from env so each step
 *     body can reach DB / indexer through a clean container)
 *   - an in-memory rate limiter so `step.rateLimit` declarations work
 *
 * No node-step runner: this template runs everything on edge runtime.
 * Workflows that declare `runtime: "node"` will fail at dispatch with
 * `NODE_RUNTIME_UNAVAILABLE` — wire `createCfContainerStepRunner` here
 * if you need node steps.
 */
function buildStepHandler(env: CloudflareBindings): StepHandler {
  let depsPromise:
    | Promise<{
        handleStepRequest: typeof import("@voyant-travel/workflows/handler").handleStepRequest
        rateLimiter: ReturnType<
          typeof import("@voyant-travel/workflows/rate-limit").createInMemoryRateLimiter
        >
        services: ReturnType<typeof buildWorkflowStepServices>
      }>
    | undefined

  return async (req, opts) => {
    depsPromise ??= Promise.all([
      import("@voyant-travel/workflows/handler"),
      import("@voyant-travel/workflows/rate-limit"),
      import("./api/lib/bulk-reindex-service"),
      loadWorkflowDefinitions(),
    ]).then(([handler, rateLimit, bulkReindex]) => ({
      handleStepRequest: handler.handleStepRequest,
      rateLimiter: rateLimit.createInMemoryRateLimiter(),
      services: buildWorkflowStepServices(env, bulkReindex.createBulkReindexProductsService),
    }))

    const { handleStepRequest, rateLimiter, services } = await depsPromise
    return handleStepRequest(
      req,
      {
        rateLimiter,
        services,
      },
      opts,
    )
  }
}

/**
 * Tiny `ServiceResolver` for the workflow runtime. Independent of the
 * Hono `createApp()` container because the DO is constructed by the CF
 * runtime separately from the request pipeline that builds it. Add
 * services here as new workflows need them.
 */
function buildWorkflowStepServices(
  env: CloudflareBindings,
  createBulkReindexProductsService: typeof import("./api/lib/bulk-reindex-service").createBulkReindexProductsService,
): {
  resolve<T>(name: string): T
  has(name: string): boolean
} {
  const bulkReindex = createBulkReindexProductsService(env)
  const registry: Record<string, unknown> = {
    [BULK_REINDEX_SERVICE_KEY]: bulkReindex,
  }
  return {
    has(name: string): boolean {
      return name in registry
    },
    resolve<T>(name: string): T {
      const value = registry[name]
      if (value === undefined) {
        throw new Error(
          `[workflow-step-services] no service registered for "${name}". ` +
            `Add it to \`buildWorkflowStepServices\` in entry.ts.`,
        )
      }
      return value as T
    },
  }
}
