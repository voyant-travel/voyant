// Cold-start auto-publish of the in-process workflow registry to the
// `WORKFLOW_MANIFESTS` KV namespace.
//
// Background (issue #1070): the KV manifest is only populated when a
// tenant explicitly calls `registerManifest` (driver path) or POSTs
// `/api/manifests` (HTTP path). Tenants that compose workflows from
// many packages and never wire either path end up with an empty KV,
// which means voyant-cloud's scheduler can't pull the runtime manifest
// to seed `workflow_schedules`. The cron tick then has nothing to fire.
//
// This module bridges the gap: when the cloud adapter sees its first
// request, it builds the manifest from the in-process registry and
// writes it to KV if the current envelope is missing or its versionId
// differs. The manifest is content-addressed, so concurrent cold
// starts converge on the same versionId — repeated publishes are
// no-ops after the first.

import { __listRegisteredWorkflows } from "@voyant-travel/workflows"
import { buildManifest, getEventFilterRegistry } from "@voyant-travel/workflows/events"
import type { WorkflowManifest } from "@voyant-travel/workflows/protocol"
import type { CfManifestStore } from "@voyant-travel/workflows-orchestrator-cloudflare"

const ALLOWED_ENVS = new Set<WorkflowEnvironment>(["production", "preview", "development"])

export type WorkflowEnvironment = "production" | "preview" | "development"

export interface AutoPublishContext {
  manifestStore: CfManifestStore
  environment?: WorkflowEnvironment | string
  projectId?: string
  /**
   * Hook to schedule the publish so it doesn't block the hot path.
   * In a CF Worker, pass `ctx.waitUntil`. Defaults to fire-and-forget
   * (the returned promise is unhandled).
   */
  waitUntil?: (promise: Promise<unknown>) => void
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
  /**
   * Internal seam — defaults to the global `__listRegisteredWorkflows()`.
   * Tests inject a fixture registry without polluting the process-wide
   * registry.
   */
  listWorkflows?: () => ReadonlyArray<{
    id: string
    config?: Parameters<typeof buildManifest>[0]["workflows"][number]["config"]
  }>
  /**
   * Internal seam — defaults to the global event-filter registry.
   */
  listEventFilters?: () => Parameters<typeof buildManifest>[0]["eventFilters"]
}

/**
 * Per-store latch so we only check KV once per cold start. The store
 * object is created from the KV binding, which is stable across
 * requests on the same isolate.
 */
const PUBLISHED = new WeakSet<CfManifestStore>()

/**
 * Schedule an auto-publish of the in-process registry. Idempotent —
 * the latch prevents repeated KV reads per isolate, and the publish
 * itself short-circuits when the current envelope already matches the
 * registry's versionId.
 */
export function scheduleAutoPublishManifest(ctx: AutoPublishContext): void {
  if (PUBLISHED.has(ctx.manifestStore)) return
  PUBLISHED.add(ctx.manifestStore)

  const env = normalizeEnvironment(ctx.environment)
  const work = (async () => {
    try {
      await publishManifest({ ...ctx, environment: env })
    } catch (err) {
      // Cold-start publish is best-effort — never let a KV hiccup take
      // down the request that triggered it. Clear the latch so a
      // subsequent request re-tries.
      PUBLISHED.delete(ctx.manifestStore)
      ctx.logger?.("warn", "workflows: auto-publish manifest failed", {
        error: err instanceof Error ? err.message : String(err),
        environment: env,
      })
    }
  })()

  if (ctx.waitUntil) {
    ctx.waitUntil(work)
  } else {
    // No waitUntil — let it run; we already swallowed errors inside.
    void work
  }
}

/**
 * Build the registry-derived manifest and write it to KV when needed.
 * Exported so tests (and the rare caller that wants synchronous
 * semantics) can await the result. Returns the published manifest, or
 * `null` when the registry is empty or KV already has a matching
 * envelope.
 */
export async function publishManifest(ctx: AutoPublishContext): Promise<WorkflowManifest | null> {
  const workflows = (ctx.listWorkflows ?? __listRegisteredWorkflows)()
  if (workflows.length === 0) return null

  const eventFilters = ctx.listEventFilters
    ? ctx.listEventFilters()
    : getEventFilterRegistry().list()

  const environment = normalizeEnvironment(ctx.environment)
  const manifest = await buildManifest({
    projectId: ctx.projectId,
    environment,
    workflows: workflows.map((wf) => ({ id: wf.id, config: wf.config })),
    eventFilters,
  })

  const current = await ctx.manifestStore.getCurrent(environment)
  if (current && current.versionId === manifest.versionId) {
    ctx.logger?.("info", "workflows: auto-publish manifest is a no-op", {
      environment,
      versionId: manifest.versionId,
    })
    return null
  }

  await ctx.manifestStore.registerManifest({
    environment,
    versionId: manifest.versionId,
    manifest: { ...manifest },
  })
  ctx.logger?.("info", "workflows: auto-published manifest", {
    environment,
    versionId: manifest.versionId,
    workflowCount: workflows.length,
    eventFilterCount: eventFilters.length,
  })
  return manifest
}

function normalizeEnvironment(value: string | undefined): WorkflowEnvironment {
  if (value && ALLOWED_ENVS.has(value as WorkflowEnvironment)) {
    return value as WorkflowEnvironment
  }
  return "production"
}
