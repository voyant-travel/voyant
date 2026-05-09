// In-memory WorkflowDriver — primarily for tests, also for short-lived
// scripts and the parameterized compliance suite.
//
// Wraps the existing pure orchestrator functions (trigger / resume / cancel)
// with `createInMemoryRunStore` for state and an in-process `StepHandler`
// glue (`handleStepRequest` from `@voyantjs/workflows/handler`). Manifests
// live in a `Map<environment, { manifest, versionId }>`.
//
// State lives in the closure returned by `createInMemoryDriver` — every
// call to the factory yields a fresh, isolated driver. No global state.
//
// Authoritative architecture: docs/architecture/workflows-runtime-architecture.md §6.

import type {
  EnvironmentName,
  ListRunsOptions,
  Run,
  RunDetail,
  RunSummary,
  TriggerOptions,
} from "@voyantjs/workflows"
import {
  type DriverFactory,
  type DriverFactoryDeps,
  type IngestEventArgs,
  type IngestEventResponse,
  ManifestNotRegisteredError,
  type WorkflowAdmin,
  type WorkflowDriver,
} from "@voyantjs/workflows/driver"
import { handleStepRequest, type WorkflowStepRequest } from "@voyantjs/workflows/handler"
import type { WorkflowManifest } from "@voyantjs/workflows/protocol"

import { createInMemoryRunStore } from "./in-memory-store.js"
import { cancel as orchestratorCancel, trigger as orchestratorTrigger } from "./orchestrator.js"
import type { RunRecord, StepHandler } from "./types.js"

// ---- Public factory options ----

export interface InMemoryDriverOptions {
  /** Default environment for `trigger()` calls that don't specify one. */
  defaultEnvironment?: EnvironmentName
  /** Tenant metadata stamped onto every triggered run. */
  tenantMeta?: RunRecord["tenantMeta"]
  /** Injectable clock; defaults to `Date.now`. */
  now?: () => number
  /** Step handler override — defaults to in-process `handleStepRequest`. */
  handler?: StepHandler
}

const DEFAULT_TENANT_META: RunRecord["tenantMeta"] = {
  tenantId: "default",
  projectId: "default",
  organizationId: "default",
}

/**
 * Build an in-memory driver factory. The factory closes over its
 * options and returns a fresh `WorkflowDriver` when `createApp()`
 * (or a test) calls it with `DriverFactoryDeps`.
 *
 * Usage in tests:
 *
 *     const driver = createInMemoryDriver()(testFactoryDeps())
 *     await driver.registerManifest({ environment: "production", manifest })
 *     await driver.trigger(myWorkflow, { … }, { idempotencyKey: "abc" })
 */
export function createInMemoryDriver(opts: InMemoryDriverOptions = {}): DriverFactory {
  return (deps: DriverFactoryDeps): WorkflowDriver => {
    const store = createInMemoryRunStore()
    const manifests = new Map<EnvironmentName, { manifest: WorkflowManifest; versionId: string }>()
    const now = opts.now ?? deps.now ?? (() => Date.now())
    const tenantMeta = opts.tenantMeta ?? DEFAULT_TENANT_META
    const defaultEnv: EnvironmentName = opts.defaultEnvironment ?? "development"
    // Wire the framework-supplied service container through to step bodies.
    // The handler closes over `deps.services` so every step invocation
    // surfaces it as `ctx.services` inside the workflow body.
    const handler: StepHandler =
      opts.handler ??
      (async (req: WorkflowStepRequest, stepOpts) =>
        handleStepRequest(req, { services: deps.services }, stepOpts))

    let shuttingDown = false

    // ---- WorkflowDriver implementation ----

    async function registerManifest(args: {
      environment: EnvironmentName
      manifest: WorkflowManifest
    }): Promise<{ versionId: string }> {
      assertNotShutdown(shuttingDown)
      manifests.set(args.environment, {
        manifest: args.manifest,
        versionId: args.manifest.versionId,
      })
      return { versionId: args.manifest.versionId }
    }

    async function getManifest(args: {
      environment: EnvironmentName
    }): Promise<WorkflowManifest | null> {
      return manifests.get(args.environment)?.manifest ?? null
    }

    async function trigger<TIn, TOut>(
      workflow: { id: string } | string,
      input: TIn,
      triggerOpts?: TriggerOptions,
    ): Promise<Run<TOut>> {
      assertNotShutdown(shuttingDown)
      const workflowId = typeof workflow === "string" ? workflow : workflow.id
      const env = triggerOpts?.environment ?? defaultEnv

      // The orchestrator core handles idempotencyKey natively (deterministic
      // runId derivation from `(workflowId, idempotencyKey)`); the driver just
      // forwards the field. Persistent stores like `voyant_snapshot_runs`
      // additionally read `RunRecord.idempotencyKey` to populate their own
      // dedup column.
      const record = await orchestratorTrigger(
        {
          workflowId,
          workflowVersion: triggerOpts?.lockToVersion ?? "v1",
          input: input as unknown,
          tenantMeta,
          environment: env,
          tags: triggerOpts?.tags,
          idempotencyKey: triggerOpts?.idempotencyKey,
        },
        { store, handler, now },
      )
      return runRecordToRun<TOut>(record)
    }

    async function ingestEvent(args: IngestEventArgs): Promise<IngestEventResponse> {
      assertNotShutdown(shuttingDown)
      const stored = manifests.get(args.environment)
      if (!stored) {
        return {
          ok: false,
          reason: "manifest_not_registered",
          message: new ManifestNotRegisteredError(args.environment).message,
        }
      }
      const eventId = ensureEventId(args.envelope, now)
      // Filter matching arrives in PR2 (the event-router).
      // PR1 ships ingestEvent that validates the manifest is registered and
      // returns the no-matches response when there are no filters or when the
      // event router hasn't been wired yet.
      // Matching against `stored.manifest.eventFilters[]` will replace this
      // body once the predicate evaluator + input mapper land.
      void stored
      return { ok: true, eventId, matches: [] }
    }

    async function shutdown(): Promise<void> {
      shuttingDown = true
    }

    // ---- WorkflowAdmin (partial; sufficient for compliance tests) ----

    const admin: Partial<WorkflowAdmin> = {
      async listRuns(listOpts?: ListRunsOptions) {
        const filterEnv = listOpts?.environment
        const filterStatus = normalizeStatusFilter(listOpts?.status)
        const filterWorkflow = listOpts?.workflowId
        const filterTag = listOpts?.tag
        const filterSince = toEpoch(listOpts?.since)
        const filterUntil = toEpoch(listOpts?.until)
        const limit = listOpts?.limit ?? 100

        const results: RunSummary[] = []
        for (const rec of await store.list({})) {
          if (filterEnv && rec.environment !== filterEnv) continue
          if (filterStatus && !filterStatus.includes(rec.status as never)) continue
          if (filterWorkflow && rec.workflowId !== filterWorkflow) continue
          if (filterTag && !rec.tags.includes(filterTag)) continue
          if (filterSince !== undefined && rec.startedAt < filterSince) continue
          if (filterUntil !== undefined && rec.startedAt > filterUntil) continue
          results.push(runRecordToSummary(rec))
        }
        results.sort((a, b) => b.startedAt - a.startedAt)
        const page = results.slice(0, limit)
        const nextCursor = results.length > limit ? String(limit) : undefined
        return { runs: page, nextCursor }
      },

      async getRun(runId: string): Promise<RunDetail | null> {
        const rec = await store.get(runId)
        return rec ? runRecordToDetail(rec) : null
      },

      async cancelRun(runId: string, cancelOpts?: { reason?: string; compensate?: boolean }) {
        // The orchestrator core's cancel() does NOT run compensations by default
        // (per workflows-runtime-architecture.md §21.21). The `compensate` flag
        // is accepted but no-ops in v1; honoring it would require an engine
        // behavior change tracked separately.
        void cancelOpts?.compensate
        await orchestratorCancel({ runId, reason: cancelOpts?.reason }, { store, handler, now })
      },

      // streamRun is not implemented for InMemory in PR1. Dashboards that
      // probe `driver.admin.streamRun` get `undefined` and fall back to
      // their non-streaming view. Mode 2 + Mode 1 implement this in later
      // PRs against their respective journal sources.
    }

    return {
      registerManifest,
      trigger,
      ingestEvent,
      getManifest,
      shutdown,
      admin,
    }
  }
}

// ---- Helpers ----

function assertNotShutdown(shuttingDown: boolean): void {
  if (shuttingDown) {
    throw new Error("InMemoryDriver: shutdown() has been called; new operations are refused.")
  }
}

function ensureEventId(envelope: { metadata?: { eventId?: string } }, now: () => number): string {
  if (envelope.metadata?.eventId) return envelope.metadata.eventId
  // Best-effort fallback when the caller hasn't stamped an id. The framework's
  // EventBus forwarder (PR4) stamps a ULID before calling ingestEvent, so this
  // path is mostly hit by tests + external callers.
  return `evt_${now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`
}

function runRecordToRun<TOut>(rec: RunRecord): Run<TOut> {
  return {
    id: rec.id,
    workflowId: rec.workflowId,
    status: rec.status as Run["status"],
    startedAt: rec.startedAt,
  }
}

function runRecordToSummary(rec: RunRecord): RunSummary {
  return {
    id: rec.id,
    workflowId: rec.workflowId,
    status: rec.status as RunSummary["status"],
    startedAt: rec.startedAt,
    completedAt: rec.completedAt,
    tags: [...rec.tags],
    environment: rec.environment,
  }
}

function runRecordToDetail(rec: RunRecord): RunDetail {
  return {
    ...runRecordToSummary(rec),
    version: rec.workflowVersion,
    input: rec.input,
    output: rec.output,
    error: rec.error,
    durationMs:
      rec.completedAt !== undefined ? Math.max(0, rec.completedAt - rec.startedAt) : undefined,
  }
}

function normalizeStatusFilter(
  s: ListRunsOptions["status"] | undefined,
): readonly string[] | undefined {
  if (s === undefined) return undefined
  return Array.isArray(s) ? s : [s]
}

function toEpoch(v: number | Date | undefined): number | undefined {
  if (v === undefined) return undefined
  return typeof v === "number" ? v : v.getTime()
}
