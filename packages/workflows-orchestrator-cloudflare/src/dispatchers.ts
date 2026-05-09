// Step dispatchers — abstract "given a run's context, produce a
// StepHandler that delivers step requests to whatever Worker (or
// isolate) hosts the workflow code." Replaces the WfP-only path with a
// pluggable surface so Voyant Cloud (multi-tenant WfP), self-host
// single-Worker (inline), self-host two-Worker (service binding), and
// cross-host (HTTP) deployments can all reuse the same orchestrator
// + run DO without leaking deployment plumbing into authoring code.
//
// See issue #528 + docs/architecture/workflows-runtime-architecture.md §8.

import {
  createHttpStepHandler,
  type StepHandler,
  type WorkflowStepRequest,
} from "@voyantjs/workflows-orchestrator"

import type { DispatchNamespaceLike } from "./types.js"

/**
 * Context the run DO supplies when asking a dispatcher for a
 * StepHandler. Different dispatchers care about different fields:
 *  - WfP routes by `tenantScript` to the right tenant Worker
 *  - Service-binding / inline / HTTP dispatchers usually ignore it
 *  - All dispatchers can use `workflowId` for logging
 */
export interface StepDispatcherContext {
  /**
   * Dispatch-namespace script name from the run's `tenantMeta`. Empty
   * for self-host single-tenant deployments — only WfP dispatchers
   * use it.
   */
  tenantScript?: string
  /** Workflow id, useful for label / logging. */
  workflowId?: string
}

/**
 * Pluggable step-dispatch primitive. Replaces the previous
 * `resolveStepHandler: (tenantScript) => StepHandler` closure with a
 * shape that doesn't bake WfP's tenant-script identifier into the
 * core contract.
 *
 * Pick a factory below based on where workflow code lives in your
 * deployment; the run DO calls the dispatcher once per drive and
 * forwards step requests through the handler it returns.
 */
export type StepDispatcher = (ctx: StepDispatcherContext) => StepHandler

// ---- Factory: Workers-for-Platforms ----

export interface WfpDispatcherOptions {
  /** Dispatch namespace binding (e.g. `env.DISPATCHER`). */
  namespace: DispatchNamespaceLike
  /** Optional HMAC signer for the X-Voyant-Dispatch-Auth header. */
  sign?: (body: string) => Promise<string> | string
  /** Optional structured logger. */
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
  /** URL presented to the tenant Worker. Defaults to `https://tenant.voyant.internal`. */
  baseUrl?: string
}

/**
 * Workers-for-Platforms dispatcher. Routes step requests through a
 * dispatch namespace to the tenant Worker named by `ctx.tenantScript`.
 * The mode Voyant Cloud uses internally for multi-tenant deployments —
 * many tenant bundles uploaded over time, dynamic dispatch by name.
 */
export function createWfpDispatcher(opts: WfpDispatcherOptions): StepDispatcher {
  const baseUrl = opts.baseUrl ?? "https://tenant.voyant.internal"
  return (ctx) => {
    const tenantScript = ctx.tenantScript ?? ""
    return createHttpStepHandler({
      sign: opts.sign ? (body) => opts.sign!(body) : undefined,
      logger: opts.logger,
      resolveTarget(_req: WorkflowStepRequest) {
        const binding = opts.namespace.get(tenantScript)
        return {
          url: `${baseUrl}/__voyant/workflow-step`,
          label: tenantScript,
          fetch(request: Request) {
            return binding.fetch(request)
          },
        }
      },
    })
  }
}

// ---- Factory: Service binding ----

/**
 * Subset of a Cloudflare service-binding interface (`env.SOMETHING`
 * declared as `services: [{ binding, service }]` in wrangler.jsonc).
 * `fetch(req)` delivers to the bound Worker.
 */
export interface ServiceBindingLike {
  fetch(request: Request): Promise<Response>
}

export interface ServiceBindingDispatcherOptions {
  /** Service binding to a sibling Worker that hosts the workflow code. */
  binding: ServiceBindingLike
  /** Optional HMAC signer. */
  sign?: (body: string) => Promise<string> | string
  /** Optional structured logger. */
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
  /** URL presented to the bound Worker. Defaults to `https://tenant.voyant.internal`. */
  baseUrl?: string
  /** Optional label for logs. Defaults to `"service-binding"`. */
  label?: string
}

/**
 * Service-binding dispatcher. Routes step requests to a sibling Worker
 * via `services: [{ binding, service }]` in the orchestrator's
 * wrangler.jsonc. Use this for self-host two-Worker deployments
 * (orchestrator + workflows are separate Workers in the same account).
 * No WfP needed; works on the standard Workers paid plan.
 */
export function createServiceBindingDispatcher(
  opts: ServiceBindingDispatcherOptions,
): StepDispatcher {
  const baseUrl = opts.baseUrl ?? "https://tenant.voyant.internal"
  const label = opts.label ?? "service-binding"
  return (_ctx) =>
    createHttpStepHandler({
      sign: opts.sign ? (body) => opts.sign!(body) : undefined,
      logger: opts.logger,
      resolveTarget() {
        return {
          url: `${baseUrl}/__voyant/workflow-step`,
          label,
          fetch(request: Request) {
            return opts.binding.fetch(request)
          },
        }
      },
    })
}

// ---- Factory: Inline ----

/**
 * Inline dispatcher. Returns the supplied StepHandler directly — used
 * when workflow code lives in the SAME Worker as the orchestrator
 * (single-Worker self-host). No HTTP, no DO traversal, just a function
 * call. Pair with `handleStepRequest` from `@voyantjs/workflows/handler`
 * for the typical setup.
 */
export function createInlineDispatcher(handler: StepHandler): StepDispatcher {
  return () => handler
}

// ---- Factory: HTTP ----

export interface HttpDispatcherOptions {
  /** Absolute URL of the workflow-step endpoint. */
  url: string
  /** Optional HMAC signer. */
  sign?: (body: string) => Promise<string> | string
  /** Optional structured logger. */
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
  /**
   * Optional fetch override (e.g. `env.SOMETHING.fetch.bind(env.SOMETHING)`
   * for typed bindings, or a custom client for testing). Defaults to
   * `globalThis.fetch`.
   */
  fetch?: (request: Request) => Promise<Response>
  /** Optional label for logs; defaults to the URL host. */
  label?: string
}

/**
 * HTTP dispatcher. Routes step requests to a configurable URL via
 * `globalThis.fetch` (or a supplied fetch). Use for cross-host setups
 * (e.g. a CF orchestrator forwarding to a Node-side workflows Worker)
 * or test fakes.
 */
export function createHttpDispatcher(opts: HttpDispatcherOptions): StepDispatcher {
  const fetchImpl = opts.fetch ?? ((req: Request) => globalThis.fetch(req))
  let label = opts.label
  if (!label) {
    try {
      label = new URL(opts.url).host
    } catch {
      label = opts.url
    }
  }
  return (_ctx) =>
    createHttpStepHandler({
      sign: opts.sign ? (body) => opts.sign!(body) : undefined,
      logger: opts.logger,
      resolveTarget() {
        return {
          url: opts.url,
          label,
          fetch(request: Request) {
            return fetchImpl(request)
          },
        }
      },
    })
}
