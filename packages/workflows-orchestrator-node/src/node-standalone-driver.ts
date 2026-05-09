// Mode 2 driver — pure Node, Postgres-backed.
//
// Returns a `DriverFactory` (per architecture doc §6.3) that the framework
// invokes after `createApp()` has assembled its `ModuleContainer`. Composes:
//
//   * `createPostgresRunRecordStore` — primary state, against
//      `voyant_snapshot_runs.run_record` JSONB.
//   * `createPostgresManifestStore`   — manifest history, against
//      `voyant_workflow_manifests`.
//   * In-process step handler glued to `handleStepRequest` from
//      `@voyantjs/workflows/handler` — the workflow body executes in the
//      same Node process as the driver.
//
// The Postgres time wheel (`createPersistentWakeupManager`) is started via
// the returned driver's `start()` lifecycle helper or — when used from
// `createApp()` — by the framework's bootstrap.
//
// See architecture doc §7 for the full Mode 2 design.

import type {
  ListRunsOptions,
  Run,
  RunDetail,
  RunSummary,
  TriggerOptions,
} from "@voyantjs/workflows"
import type {
  DriverFactory,
  DriverFactoryDeps,
  IngestEventArgs,
  IngestEventResponse,
  IngestMatch,
  WorkflowAdmin,
  WorkflowDriver,
} from "@voyantjs/workflows/driver"
import { handleStepRequest, type WorkflowStepRequest } from "@voyantjs/workflows/handler"
import type { WorkflowManifest } from "@voyantjs/workflows/protocol"
import {
  cancel as orchestratorCancel,
  trigger as orchestratorTrigger,
  type RunRecord,
  routeEvent,
  type StepHandler,
} from "@voyantjs/workflows-orchestrator"
import type { drizzle } from "drizzle-orm/node-postgres"

import { createPostgresManifestStore } from "./postgres-manifest-store.js"
import { createPostgresRunRecordStore } from "./postgres-run-record-store.js"

type Db = ReturnType<typeof drizzle>

// ---- Public factory options ----

export interface NodeStandaloneDriverOptions {
  /** Long-lived Postgres connection (drizzle-orm `node-postgres` adapter). */
  db: Db
  /** Default environment for `trigger()` calls that don't specify one. */
  defaultEnvironment?: "production" | "preview" | "development"
  /** Tenant metadata stamped onto every triggered run. */
  tenantMeta?: RunRecord["tenantMeta"]
  /** Injectable clock; defaults to `Date.now`. */
  now?: () => number
  /**
   * Step handler override. Defaults to in-process `handleStepRequest`
   * with the framework-supplied `services` container plumbed through
   * (so step bodies can resolve via `ctx.services.resolve(...)`).
   */
  handler?: StepHandler
  /**
   * Latest N manifest versions to retain per environment after each
   * registerManifest. Defaults to 3 (per architecture doc §14.2). Set to
   * a high number to disable pruning effectively.
   */
  manifestVersionsToKeep?: number
}

const DEFAULT_TENANT_META: RunRecord["tenantMeta"] = {
  tenantId: "default",
  projectId: "default",
  organizationId: "default",
}

const DEFAULT_MANIFEST_KEEP = 3

/**
 * Build the Mode 2 driver factory. The factory closes over its options
 * and returns a fresh `WorkflowDriver` when `createApp()` (or a test)
 * calls it with `DriverFactoryDeps`.
 *
 * Usage:
 *
 *     createApp({
 *       workflows: {
 *         driver: createNodeStandaloneDriver({ db, defaultEnvironment: "production" }),
 *       },
 *     })
 *
 * Or in compliance tests:
 *
 *     const driver = createNodeStandaloneDriver({ db: testDb })(testFactoryDeps())
 */
export function createNodeStandaloneDriver(opts: NodeStandaloneDriverOptions): DriverFactory {
  return (deps: DriverFactoryDeps): WorkflowDriver => {
    const runStore = createPostgresRunRecordStore({ db: opts.db })
    const manifestStore = createPostgresManifestStore({ db: opts.db })
    const now = opts.now ?? deps.now ?? (() => Date.now())
    const tenantMeta = opts.tenantMeta ?? DEFAULT_TENANT_META
    const defaultEnv = opts.defaultEnvironment ?? "development"
    const keep = opts.manifestVersionsToKeep ?? DEFAULT_MANIFEST_KEEP

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
      environment: WorkflowDriver["registerManifest"] extends (a: infer A) => unknown
        ? A extends { environment: infer E }
          ? E
          : never
        : never
      manifest: WorkflowManifest
    }): Promise<{ versionId: string }> {
      assertNotShutdown(shuttingDown)
      const result = await manifestStore.registerManifest({
        environment: args.environment as string,
        versionId: args.manifest.versionId,
        manifest: args.manifest as unknown as Record<string, unknown>,
      })
      // Best-effort prune; failures here shouldn't fail boot.
      try {
        await manifestStore.pruneToVersions(args.environment as string, keep)
      } catch (err) {
        deps.logger("warn", "manifest prune failed (non-fatal)", {
          environment: args.environment,
          error: err instanceof Error ? err.message : String(err),
        })
      }
      return result
    }

    async function getManifest(args: { environment: string }): Promise<WorkflowManifest | null> {
      const envelope = await manifestStore.getCurrent(args.environment)
      if (!envelope) return null
      return envelope.manifest as unknown as WorkflowManifest
    }

    async function trigger<TIn, TOut>(
      workflow: { id: string } | string,
      input: TIn,
      triggerOpts?: TriggerOptions,
    ): Promise<Run<TOut>> {
      assertNotShutdown(shuttingDown)
      const workflowId = typeof workflow === "string" ? workflow : workflow.id
      const env = triggerOpts?.environment ?? defaultEnv

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
        { store: runStore, handler, now },
      )
      return runRecordToRun<TOut>(record)
    }

    async function ingestEvent(args: IngestEventArgs): Promise<IngestEventResponse> {
      assertNotShutdown(shuttingDown)
      const stored = await manifestStore.getCurrent(args.environment)
      if (!stored) {
        return {
          ok: false,
          reason: "manifest_not_registered",
          message: `No manifest is registered for environment "${args.environment}".`,
        }
      }
      const eventId = ensureEventId(args.envelope, now)
      const manifest = stored.manifest as unknown as WorkflowManifest
      const routed = routeEvent({
        manifest,
        envelope: args.envelope,
        eventId,
        idempotencyOverride: args.idempotencyKey,
      })

      const matches: IngestMatch[] = []
      let anyTriggered = false
      let anyFailed = false
      for (const entry of routed) {
        if (entry.status === "skipped") {
          matches.push({
            filterId: entry.filterId,
            status: "skipped",
            reason: entry.reason,
            details: entry.details,
          })
          continue
        }
        try {
          const record = await orchestratorTrigger(
            {
              workflowId: entry.targetWorkflowId,
              workflowVersion: "v1",
              input: entry.input,
              tenantMeta,
              environment: args.environment,
              idempotencyKey: entry.idempotencyKey,
              triggeredBy: {
                kind: "event",
                eventId,
                eventType: args.envelope.name,
                filterId: entry.filterId,
              },
            },
            { store: runStore, handler, now },
          )
          matches.push({
            filterId: entry.filterId,
            targetWorkflowId: entry.targetWorkflowId,
            runId: record.id,
            idempotencyKey: entry.idempotencyKey,
            status: "queued",
          })
          anyTriggered = true
        } catch (err) {
          matches.push({
            filterId: entry.filterId,
            targetWorkflowId: entry.targetWorkflowId,
            status: "error",
            reason: err instanceof Error ? err.message : String(err),
          })
          anyFailed = true
        }
      }

      if (matches.length > 0 && !anyTriggered && anyFailed) {
        return {
          ok: false,
          reason: "trigger_failed_for_all_matches",
          message: "every matched filter failed to trigger",
        }
      }
      return { ok: true, eventId, matches }
    }

    async function shutdown(): Promise<void> {
      shuttingDown = true
    }

    // ---- WorkflowAdmin (full; Mode 2 has Postgres-native query support) ----

    const admin: WorkflowAdmin = {
      async listRuns(listOpts?: ListRunsOptions) {
        const filterStatus = normalizeStatusFilter(listOpts?.status)
        const filterEnv = listOpts?.environment
        const filterWorkflow = listOpts?.workflowId
        const filterTag = listOpts?.tag
        const filterSince = toEpoch(listOpts?.since)
        const filterUntil = toEpoch(listOpts?.until)
        const limit = listOpts?.limit ?? 100

        // Take a generous fetch window; in-memory filter for fields the
        // store doesn't index (env, tag, since/until). For real load we'd
        // push these down into the query — out of scope for PR1 step 6.
        const records = await runStore.list({
          workflowId: filterWorkflow,
          status: filterStatus?.[0] as never,
          limit: limit * 2,
        })

        const results: RunSummary[] = []
        for (const rec of records) {
          if (filterStatus && !filterStatus.includes(rec.status as never)) continue
          if (filterEnv && rec.environment !== filterEnv) continue
          if (filterTag && !rec.tags.includes(filterTag)) continue
          if (filterSince !== undefined && rec.startedAt < filterSince) continue
          if (filterUntil !== undefined && rec.startedAt > filterUntil) continue
          results.push(runRecordToSummary(rec))
        }
        const page = results.slice(0, limit)
        const nextCursor = results.length > limit ? String(limit) : undefined
        return { runs: page, nextCursor }
      },

      async getRun(runId: string): Promise<RunDetail | null> {
        const rec = await runStore.get(runId)
        return rec ? runRecordToDetail(rec) : null
      },

      async cancelRun(runId: string, cancelOpts?: { reason?: string; compensate?: boolean }) {
        // The orchestrator core's cancel() does NOT run compensations by
        // default (architecture doc §21.21). The `compensate` flag is
        // accepted but no-ops in v1.
        void cancelOpts?.compensate
        await orchestratorCancel(
          { runId, reason: cancelOpts?.reason },
          { store: runStore, handler, now },
        )
      },

      streamRun(runId: string): AsyncIterable<never> {
        // Live journal-event streaming is a follow-up — needs LISTEN/NOTIFY
        // wired against the run store or a polling source. PR1 ships
        // listRuns + getRun; streamRun returns an immediately-exhausted
        // iterable so dashboards probing it get a clean empty stream
        // instead of an undefined.
        void runId
        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => ({ value: undefined as never, done: true as const }),
            }
          },
        }
      },
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
    throw new Error("NodeStandaloneDriver: shutdown() has been called; new operations are refused.")
  }
}

function ensureEventId(envelope: { metadata?: { eventId?: string } }, now: () => number): string {
  if (envelope.metadata?.eventId) return envelope.metadata.eventId
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
