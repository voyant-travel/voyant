// Importing the workflows module here side-loads every `workflow({...})`
// and `trigger.on(...)` declaration into the process-local registries
// before `createApp()` collects them. Without this import the modules /
// plugins arrays in app.ts would carry empty workflow + filter lists.
import "./workflows.js"

import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { BULK_REINDEX_SERVICE_KEY } from "@voyantjs/promotions"
import { handleStepRequest } from "@voyantjs/workflows/handler"
import { createInMemoryRateLimiter } from "@voyantjs/workflows/rate-limit"
import type { StepHandler } from "@voyantjs/workflows-orchestrator"
import {
  createInlineDispatcher,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
  type StepDispatcher,
} from "@voyantjs/workflows-orchestrator-cloudflare"

import { app as apiApp } from "./api/app"
import { runScheduledChannelPushReconciler } from "./api/channel-push-scheduled"
import { DRAFT_REAPER_CRON, runScheduledDraftReaper } from "./api/draft-reaper-scheduled"
import { createBulkReindexProductsService } from "./api/lib/bulk-reindex-service"
import {
  PROMOTION_BOUNDARY_SCHEDULER_CRON,
  runScheduledPromotionBoundary,
} from "./api/promotion-scheduled"

const startHandler = createStartHandler(defaultStreamHandler)

export default {
  async fetch(request: Request, env: CloudflareBindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Route /api/* to Hono (strip prefix so Hono sees /v1/*, /auth/*, /health)
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const stripped = url.pathname.slice(4) || "/"
      const apiUrl = new URL(stripped, url.origin)
      apiUrl.search = url.search
      const apiRequest = new Request(apiUrl.toString(), request)
      return apiApp.fetch(apiRequest, env, ctx)
    }

    // Everything else → TanStack Start SSR
    return startHandler(request)
  },

  // Cloudflare Workers cron entrypoint. Triggers are declared in
  // wrangler.jsonc; the channel-push reconciler picks the right scanner
  // based on `event.cron`.
  async scheduled(
    event: ScheduledController,
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ): Promise<void> {
    if (event.cron === DRAFT_REAPER_CRON) {
      ctx.waitUntil(
        runScheduledDraftReaper(event, env).then((result) => {
          console.info("[draft-reaper] result", result)
        }),
      )
      return
    }
    if (event.cron === PROMOTION_BOUNDARY_SCHEDULER_CRON) {
      ctx.waitUntil(
        runScheduledPromotionBoundary(event, env).then((result) => {
          console.info("[promotion-scheduler] result", result)
        }),
      )
      return
    }
    ctx.waitUntil(runScheduledChannelPushReconciler(event, env))
  },
}

/**
 * Per-run Durable Object backing the inline workflow runtime.
 *
 * The CF edge driver in `@voyantjs/workflows-orchestrator-cloudflare`
 * addresses one DO per `runId`, each holding the run journal in DO
 * storage and dispatching steps through the `StepDispatcher` resolved
 * here. We use the inline dispatcher because workflow code lives in
 * THIS Worker (loaded by the side-effect import of `./workflows.js`
 * above), so step bodies can be invoked by direct call — no HTTP, no
 * service binding.
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
    return handleDurableObjectRequest(request, this.deps())
  }

  async alarm(): Promise<void> {
    await handleDurableObjectAlarm(this.deps())
  }

  private deps() {
    return {
      storage: this.state.storage,
      dispatcher: this.resolveDispatcher(),
    }
  }

  private resolveDispatcher(): StepDispatcher {
    if (this.dispatcher) return this.dispatcher
    this.dispatcher = createInlineDispatcher(buildStepHandler(this.env))
    return this.dispatcher
  }
}

/**
 * Build the in-process StepHandler. One per DO instance. Threads:
 *   - the workflow registry (populated by the `import "./workflows.js"`
 *     side effect at the top of this file)
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
  const rateLimiter = createInMemoryRateLimiter()
  const services = buildWorkflowStepServices(env)
  return (req, opts) =>
    handleStepRequest(
      req,
      {
        rateLimiter,
        services,
      },
      opts,
    )
}

/**
 * Tiny `ServiceResolver` for the workflow runtime. Independent of the
 * Hono `createApp()` container because the DO is constructed by the CF
 * runtime separately from the request pipeline that builds it. Add
 * services here as new workflows need them.
 */
function buildWorkflowStepServices(env: CloudflareBindings): {
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
