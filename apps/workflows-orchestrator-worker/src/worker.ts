// Voyant Workflows reference orchestrator Worker.
//
// Wraps `@voyantjs/workflows-orchestrator-cloudflare` into a deployable Cloudflare
// Worker + Durable Object pair. The Worker exposes the public
// `/api/runs/*` surface; each run lives in a dedicated
// `WorkflowRunDO` instance whose storage is the journal + status
// cache. Step requests flow out via a Workers-for-Platforms dispatch
// namespace to the tenant Worker bundled by `voyant workflows build`.
//
// Pre-requisites on your Cloudflare account (see README.md):
//   - Workers-for-Platforms enabled
//   - A dispatch namespace named `voyant-tenants` (or rename the
//     `DISPATCHER` binding in wrangler.jsonc)
//   - Tenant Workers uploaded into that namespace under the same
//     script name(s) you pass in `tenantMeta.tenantScript`
//   - Cloudflare Containers enabled on the account; a container
//     image built from `apps/workflows-node-step-container/Dockerfile`
//   - An R2 bucket `voyant-bundles` holding per-tenant
//     `container.mjs` artifacts and a KV namespace `BUNDLE_HASHES`
//     holding their deploy-time SHA-256
//
// The `NodeStepContainer` class is exported here so the CF runtime
// can materialize the container referenced by `wrangler.jsonc`
// `containers[]`. It is NOT invoked directly by this Worker — the
// tenant Worker (whose bundle is uploaded to the dispatch namespace)
// imports `createCfContainerStepRunner` and dispatches to the pool
// when a step declares `runtime: "node"`.
//
// What this Worker does NOT do (yet):
//   - Cross-run list/filter queries. Each DO holds one run; global
//     queries need the Postgres index that lives in voyant-cloud.

import { Container } from "@cloudflare/containers"
import { createBearerVerifier } from "@voyantjs/workflows/auth"
import {
  createDispatchStepHandler,
  createKvManifestStore,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
  handleWorkerRequest,
} from "@voyantjs/workflows-orchestrator-cloudflare"

export interface Env {
  WORKFLOW_RUN_DO: DurableObjectNamespace
  /** DO namespace for the `NodeStepContainer` class — the node-step pool. */
  NODE_STEP_POOL: DurableObjectNamespace
  DISPATCHER: DispatchNamespace
  /** R2 bucket storing per-tenant container bundles. */
  BUNDLE_R2: R2Bucket
  /** KV namespace storing `<projectId>:<workflowVersion>` → SHA-256 of the bundle. */
  BUNDLE_HASHES: KVNamespace
  /**
   * KV namespace storing serialized `WorkflowManifest` envelopes per
   * environment. Written by `POST /api/manifests`, read by
   * `POST /api/events` and `GET /api/manifests/:env`. Optional — when
   * unset, those routes return 404 `manifests_not_configured`. See
   * docs/architecture/workflows-runtime-architecture.md §14.
   */
  WORKFLOW_MANIFESTS?: KVNamespace
  /**
   * Comma-separated bearer tokens accepted on the public
   * `/api/runs/*` + `/api/events` + `/api/manifests*` surfaces. Unset =
   * no auth (fine for local dev, dangerous in production). A control
   * plane issues per-tenant short-lived tokens in the hosted deployment.
   */
  VOYANT_API_TOKENS?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const tokens = (env.VOYANT_API_TOKENS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    return handleWorkerRequest(request, {
      runDO: env.WORKFLOW_RUN_DO,
      verifyRequest: tokens.length > 0 ? createBearerVerifier(tokens) : undefined,
      manifestStore: env.WORKFLOW_MANIFESTS
        ? createKvManifestStore({ kv: env.WORKFLOW_MANIFESTS })
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
      resolveStepHandler: (tenantScript: string) =>
        createDispatchStepHandler(tenantScript, {
          dispatcher: this.env.DISPATCHER,
        }),
    }
  }
}

/**
 * Cloudflare Container class for `runtime: "node"` steps. One instance
 * per addressable DO id; the tenant Worker's `createCfContainerStepRunner`
 * routes step dispatches here via the `NODE_STEP_POOL` binding.
 *
 * The container image (built from
 * `apps/workflows-node-step-container/Dockerfile`) boots a small HTTP server
 * that accepts `POST /step`, fetches the tenant bundle from R2 if
 * needed, imports it, executes the requested step, and returns the
 * journal entry.
 */
export class NodeStepContainer extends Container<Env> {
  defaultPort = 8080
  /** Idle timeout before the instance is stopped to reclaim capacity. */
  sleepAfter = "10m"
}
