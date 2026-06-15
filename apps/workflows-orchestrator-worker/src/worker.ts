// Legacy Voyant Workflows reference orchestrator Worker.
//
// Wraps `@voyant-travel/workflows-orchestrator-cloudflare` into a deployable
// Cloudflare Worker + Durable Object pair. The Worker exposes the
// public `/api/runs/*` surface; each run lives in a dedicated
// `WorkflowRunDO` instance whose storage holds the journal + status
// cache. Step requests flow out via a service binding to a sibling
// "workflows" Worker that hosts the workflow body.
//
// Pre-requisites on your Cloudflare account (see README.md):
//   - A workflows Worker deployed under the script name referenced
//     by the `WORKFLOWS` service binding in wrangler.jsonc
//
// This app is kept for compatibility with the old Worker/DO orchestrator path.
// Current supported workflow execution is node-only via the Node self-host
// adapter or managed Cloud.
//
// Multi-tenant deployments (e.g. hosted services that need to route
// each run to a different tenant Worker) implement a custom
// `StepDispatcher` in their own deployment code rather than using the
// service-binding form here.
//
// What this Worker does NOT do (yet):
//   - Cross-run list/filter queries. Each DO holds one run; global
//     queries need an external index (e.g. a Postgres mirror).

import { parseTokenList, resolveRequestVerifier } from "@voyant-travel/workflows/auth"
import {
  createKvManifestStore,
  createKvScheduleStateStore,
  createServiceBindingDispatcher,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
  handleWorkerRequest,
} from "@voyant-travel/workflows-orchestrator-cloudflare"

export interface Env {
  WORKFLOW_RUN_DO: DurableObjectNamespace
  /**
   * Service binding to the sibling workflows Worker — the one that
   * actually hosts the step bodies. Declared in wrangler.jsonc as
   * `services: [{ binding: "WORKFLOWS", service: "<workflows-worker-name>" }]`.
   */
  WORKFLOWS: Fetcher
  /**
   * KV namespace storing serialized `WorkflowManifest` envelopes per
   * environment. Written by `POST /api/manifests`, read by
   * `POST /api/events` and `GET /api/manifests/:env`. Optional — when
   * unset, those routes return 404 `manifests_not_configured`.
   */
  WORKFLOW_MANIFESTS?: KVNamespace
  /**
   * KV namespace storing schedule fire/run/error state keyed by schedule id.
   * Optional — when unset, `/api/schedules/:env` only returns manifest
   * projection fields.
   */
  WORKFLOW_SCHEDULE_STATE?: KVNamespace
  /**
   * Comma-separated bearer tokens accepted on the public
   * `/api/runs/*` + `/api/events` + `/api/manifests*` surfaces. Unset
   * fails closed unless VOYANT_WORKFLOWS_ALLOW_UNAUTHENTICATED=1 is set.
   * A control plane issues per-tenant short-lived tokens in hosted deployments.
   */
  VOYANT_API_TOKENS?: string
  /** Local-development escape hatch only. */
  VOYANT_WORKFLOWS_ALLOW_UNAUTHENTICATED?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleWorkerRequest(request, {
      runDO: env.WORKFLOW_RUN_DO,
      verifyRequest: resolveRequestVerifier({
        tokens: parseTokenList(env.VOYANT_API_TOKENS),
        allowUnauthenticated: env.VOYANT_WORKFLOWS_ALLOW_UNAUTHENTICATED === "1",
      }),
      manifestStore: env.WORKFLOW_MANIFESTS
        ? createKvManifestStore({ kv: env.WORKFLOW_MANIFESTS })
        : undefined,
      scheduleStateStore: env.WORKFLOW_SCHEDULE_STATE
        ? createKvScheduleStateStore({ kv: env.WORKFLOW_SCHEDULE_STATE })
        : undefined,
    })
  },
} satisfies ExportedHandler<Env>

/**
 * One DO per run. The class name must match
 * `durable_objects.bindings[].class_name` in wrangler.jsonc.
 */
export class WorkflowRunDO implements DurableObject {
  private readonly state: DurableObjectState
  private readonly env: Env

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    return handleDurableObjectRequest(request, this.deps())
  }

  /**
   * Called by the CF runtime at the wake time scheduled by
   * `storage.setAlarm(...)`. Resolves any DATETIME waitpoints whose
   * wakeAt has passed and re-drives the run. Implementing this is
   * how `ctx.sleep(...)` actually sleeps: the waitpoint is stored,
   * the alarm scheduled, and execution resumes when the alarm fires.
   */
  async alarm(): Promise<void> {
    await handleDurableObjectAlarm(this.deps())
  }

  private deps() {
    return {
      storage: this.state.storage,
      dispatcher: createServiceBindingDispatcher({ binding: this.env.WORKFLOWS }),
    }
  }
}
