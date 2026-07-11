// Postgres workflow driver.
// agent-quality: file-size exception -- Public driver factory currently owns manifest, trigger, event-ingest, schedule, and admin wiring; split only with a dedicated driver-surface refactor.
//
// Returns a `DriverFactory` (per architecture doc §6.3) that the framework
// invokes after `createApp()` has assembled its `ModuleContainer`. Composes:
//
//   * `createPostgresRunRecordStore` — primary state, against
//      `voyant_snapshot_runs.run_record` JSONB.
//   * `createPostgresManifestStore`   — manifest history, against
//      `voyant_workflow_manifests`.
//   * In-process step handler glued to `handleStepRequest` from
//      `@voyant-travel/workflows/handler` — the workflow body executes in the
//      same Node process as the driver.
//
// The Postgres time wheel (`createPersistentWakeupManager`) is started via
// the returned driver's `start()` lifecycle helper or — when used from
// `createApp()` — by the framework's bootstrap.
//
// See docs/architecture/workflows-runtime-architecture.md.

import type {
  ListRunsOptions,
  Run,
  RunDetail,
  RunSummary,
  TriggerOptions,
} from "@voyant-travel/workflows"
import { getWorkflow } from "@voyant-travel/workflows"
import type {
  DriverFactory,
  DriverFactoryDeps,
  IngestEventArgs,
  IngestEventResponse,
  IngestMatch,
  WorkflowAdmin,
  WorkflowDriver,
} from "@voyant-travel/workflows/driver"
import { deriveStableEventId } from "@voyant-travel/workflows/events"
import {
  handleStepRequest,
  type WorkflowResolver,
  type WorkflowStepRequest,
} from "@voyant-travel/workflows/handler"
import type { WorkflowManifest } from "@voyant-travel/workflows/protocol"
import type { drizzle } from "drizzle-orm/node-postgres"
import {
  createInProcessConcurrencyCoordinator,
  createScheduler,
  manifestScheduleSources,
  cancel as orchestratorCancel,
  trigger as orchestratorTrigger,
  type RunRecord,
  type RuntimeConcurrencyPolicy,
  routeEvent,
  type SchedulerHandle,
  type StepHandler,
  type TriggerArgs,
} from "./core.js"

import {
  createPersistentWakeupManager,
  type PersistentWakeupManager,
} from "./persistent-wakeup-manager.js"
import { createPostgresManifestStore } from "./postgres-manifest-store.js"
import { createPostgresRunRecordStore } from "./postgres-run-record-store.js"
import { createPostgresWakeupStore } from "./postgres-wakeup-store.js"
import { syncWakeupFromRecord, type WakeupStore } from "./wakeup-store.js"

type Db = ReturnType<typeof drizzle>

// ---- Public factory options ----

export interface StandaloneDriverOptions {
  /** Long-lived Postgres connection (drizzle-orm `node-postgres` adapter). */
  db: Db
  /** Default environment for `trigger()` calls that don't specify one. */
  defaultEnvironment?: "production" | "preview" | "development"
  /** Tenant metadata stamped onto every triggered run. */
  tenantMeta?: RunRecord["tenantMeta"]
  /** Injectable clock; defaults to `Date.now`. */
  now?: () => number
  /**
   * Executable workflow lookup for this driver instance.
   *
   * Omitting this dependency is deprecated and falls back to the process-global
   * authoring registry for backward compatibility with existing consumers.
   */
  workflowResolver?: WorkflowResolver
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
  /**
   * Time-wheel poll interval, ms. The wakeup manager (architecture doc
   * §7.2) polls `voyant_wakeups` for due alarms and resumes parked runs
   * via the orchestrator. Defaults to 1_000 ms. Lower values reduce
   * sleep-resume latency at the cost of DB load.
   */
  wakeupPollIntervalMs?: number
  /**
   * Wakeup lease TTL, ms. A poll instance leases a due wakeup for this
   * long; if the process dies mid-process, another instance picks the
   * wakeup back up after the lease expires. Defaults to 4× the poll
   * interval (or 5_000 ms, whichever is greater).
   */
  wakeupLeaseMs?: number
  /**
   * Lease owner identifier. Used to disambiguate poller instances
   * across processes. Defaults to a random per-driver token.
   */
  wakeupLeaseOwner?: string
  /**
   * When `true`, the wakeup poller does NOT auto-start on construction.
   * Callers must invoke the returned driver's lifecycle hooks
   * themselves — useful for tests that want to control the poll
   * cadence. Defaults to `false` (poller starts immediately).
   */
  disableTimeWheel?: boolean
  /** Schedule runner tick interval. Defaults to 1_000 ms. */
  schedulePollIntervalMs?: number
  /** Disable automatic firing for schedules registered through manifests. */
  disableScheduleRunner?: boolean
}

const DEFAULT_TENANT_META: RunRecord["tenantMeta"] = {
  tenantId: "default",
  projectId: "default",
  organizationId: "default",
}

const DEFAULT_MANIFEST_KEEP = 3

const legacyWorkflowResolver: WorkflowResolver = {
  resolve: getWorkflow,
}

function serializeWorkflowManifest(manifest: WorkflowManifest): Record<string, unknown> {
  return { ...manifest }
}

function deserializeWorkflowManifest(manifest: Record<string, unknown>): WorkflowManifest {
  const {
    schemaVersion,
    projectId,
    versionId,
    builtAt,
    builderVersion,
    capabilities,
    workflows,
    eventFilters,
    diagnostics,
    bindings,
    environments,
  } = manifest
  const normalizedCapabilities = normalizeManifestCapabilities(capabilities)

  if (
    schemaVersion !== 1 ||
    typeof projectId !== "string" ||
    typeof versionId !== "string" ||
    typeof builtAt !== "number" ||
    typeof builderVersion !== "string" ||
    !normalizedCapabilities ||
    !Array.isArray(workflows) ||
    !Array.isArray(eventFilters) ||
    !isRecord(bindings) ||
    !isRecord(environments)
  ) {
    throw new Error("stored workflow manifest has an invalid shape")
  }

  return {
    schemaVersion,
    projectId,
    versionId,
    builtAt,
    builderVersion,
    capabilities: normalizedCapabilities,
    workflows: workflows as WorkflowManifest["workflows"],
    eventFilters: eventFilters as WorkflowManifest["eventFilters"],
    diagnostics: Array.isArray(diagnostics) ? (diagnostics as WorkflowManifest["diagnostics"]) : [],
    bindings: bindings as WorkflowManifest["bindings"],
    environments: environments as WorkflowManifest["environments"],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeManifestCapabilities(
  value: unknown,
): WorkflowManifest["capabilities"] | undefined {
  if (isRecord(value)) {
    return {
      trigger: value.trigger === true,
      events: value.events === true,
      schedules: value.schedules === true,
      rerun: value.rerun === true,
      resume: value.resume === true,
      cancel: value.cancel === true,
      humanApproval: value.humanApproval === true,
      stepRerun: value.stepRerun === true,
    }
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    const legacy = new Set(value)
    return {
      trigger: legacy.has("trigger"),
      events: legacy.has("events") || legacy.has("events:v1"),
      schedules: legacy.has("schedules"),
      rerun: legacy.has("rerun"),
      resume: legacy.has("resume"),
      cancel: legacy.has("cancel"),
      humanApproval: legacy.has("human-approval"),
      stepRerun: legacy.has("step-rerun"),
    }
  }
  return undefined
}

/**
 * Build the Postgres driver factory. The factory closes over its options
 * and returns a fresh `WorkflowDriver` when `createApp()` (or a test)
 * calls it with `DriverFactoryDeps`.
 *
 * Usage:
 *
 *     createApp({
 *       workflows: {
 *         driver: createStandaloneDriver({ db, defaultEnvironment: "production" }),
 *       },
 *     })
 *
 * Or in compliance tests:
 *
 *     const driver = createStandaloneDriver({ db: testDb })(testFactoryDeps())
 */
export function createStandaloneDriver(opts: StandaloneDriverOptions): DriverFactory {
  return (deps: DriverFactoryDeps): WorkflowDriver => {
    const runStore = createPostgresRunRecordStore({ db: opts.db })
    const manifestStore = createPostgresManifestStore({ db: opts.db })
    const wakeupStore: WakeupStore = createPostgresWakeupStore({ db: opts.db })
    const now = opts.now ?? deps.now ?? (() => Date.now())
    const tenantMeta = opts.tenantMeta ?? DEFAULT_TENANT_META
    const defaultEnv = opts.defaultEnvironment ?? "development"
    const keep = opts.manifestVersionsToKeep ?? DEFAULT_MANIFEST_KEEP
    const leaseOwner = opts.wakeupLeaseOwner ?? `selfhost-standalone-${randomToken()}`
    const workflowResolver = opts.workflowResolver ?? legacyWorkflowResolver

    // Wire the framework-supplied service container through to step bodies.
    // The handler closes over `deps.services` so every step invocation
    // surfaces it as `ctx.services` inside the workflow body.
    const handler: StepHandler =
      opts.handler ??
      (async (req: WorkflowStepRequest, stepOpts) =>
        handleStepRequest(req, { workflowResolver, services: deps.services }, stepOpts))

    // Persistent wakeup manager — polls `voyant_wakeups` for runs
    // parked on DATETIME waitpoints and resumes them via the orchestrator's
    // `resumeDueAlarms`. This is what makes `ctx.sleep(...)` actually
    // wake up in the Postgres runtime.
    const wakeupManager: PersistentWakeupManager<RunRecord> = createPersistentWakeupManager({
      wakeupStore,
      handler,
      leaseOwner,
      leaseMs: opts.wakeupLeaseMs,
      intervalMs: opts.wakeupPollIntervalMs,
      now,
      logger: (level, message, data) => deps.logger(level, message, data),
      // For the Postgres driver, the "stored" representation is the RunRecord.
      // postgres-run-record-store carries the full state on `run_record`
      // JSONB. So toRecord/fromRecord are identity.
      async getRun(runId) {
        return runStore.get(runId)
      },
      async saveRun(record) {
        await runStore.save(record)
        return record
      },
      toRecord: (record) => record,
      fromRecord: (record) => record,
      async listRuns() {
        // Bootstrap-time list of currently-parked runs to seed the wakeup
        // store. The Node driver uses status="waiting" on the run-record store.
        return runStore.list({ status: "waiting" })
      },
    })

    if (!opts.disableTimeWheel) {
      // Auto-start the poller. Callers can opt out via `disableTimeWheel`
      // for tests that want to control the cadence manually (poll explicitly
      // via `manager.poll()`).
      wakeupManager.start()
    }

    const scheduleRunners = new Map<string, SchedulerHandle>()
    let shuttingDown = false
    const concurrency = createInProcessConcurrencyCoordinator({
      async cancelRun(runId, reason) {
        const out = await orchestratorCancel({ runId, reason }, { store: runStore, handler, now })
        if (out.ok && isTerminal(out.record.status)) {
          concurrency.releaseRun(out.record)
        }
      },
    })

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
        manifest: serializeWorkflowManifest(args.manifest),
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
      startScheduleRunner(
        args.environment as "production" | "preview" | "development",
        args.manifest,
      )
      return result
    }

    async function getManifest(args: { environment: string }): Promise<WorkflowManifest | null> {
      const envelope = await manifestStore.getCurrent(args.environment)
      if (!envelope) return null
      return deserializeWorkflowManifest(envelope.manifest)
    }

    async function trigger<TIn, TOut>(
      workflow: { id: string } | string,
      input: TIn,
      triggerOpts?: TriggerOptions,
    ): Promise<Run<TOut>> {
      assertNotShutdown(shuttingDown)
      const workflowId = typeof workflow === "string" ? workflow : workflow.id
      const env = triggerOpts?.environment ?? defaultEnv
      const policy = await resolveConcurrencyPolicy(workflow, workflowId, env, getManifest)

      const record = await triggerRecord(
        {
          workflowId,
          workflowVersion: triggerOpts?.lockToVersion ?? "v1",
          input: input as unknown,
          tenantMeta,
          environment: env,
          tags: triggerOpts?.tags,
          idempotencyKey: triggerOpts?.idempotencyKey,
          delay: triggerOpts?.delay,
          priority: triggerOpts?.priority,
        },
        policy,
      )
      // Sync wakeup row so the time-wheel can resume DATETIME-parked runs.
      // No-op if the run completed inline (status !== "waiting").
      await syncWakeupFromRecord(wakeupStore, record)
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
      const eventId = await ensureEventId(args.envelope)
      const manifest = deserializeWorkflowManifest(stored.manifest)
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
          const record = await triggerRecord(
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
            await resolveConcurrencyPolicy(
              entry.targetWorkflowId,
              entry.targetWorkflowId,
              args.environment,
              getManifest,
            ),
          )
          await syncWakeupFromRecord(wakeupStore, record)
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
      // Stop the time-wheel poller so the process can exit cleanly.
      // Idempotent — calling stop() on an already-stopped manager is a
      // no-op.
      wakeupManager.stop()
      for (const runner of scheduleRunners.values()) {
        runner.stop()
      }
      scheduleRunners.clear()
    }

    function startScheduleRunner(
      environment: "production" | "preview" | "development",
      manifest: WorkflowManifest,
    ): void {
      const existing = scheduleRunners.get(environment)
      existing?.stop()
      scheduleRunners.delete(environment)
      if (opts.disableScheduleRunner) return

      const sources = manifestScheduleSources(manifest)
      if (sources.length === 0) return

      const runner = createScheduler({
        sources,
        environment,
        now,
        tickMs: opts.schedulePollIntervalMs,
        onFire: async ({ workflowId, input, scheduleId, fireAt }) => {
          assertNotShutdown(shuttingDown)
          const record = await triggerRecord(
            {
              workflowId,
              workflowVersion: "v1",
              input,
              tenantMeta,
              environment,
              idempotencyKey: `${scheduleId}:${fireAt}`,
              triggeredBy: { kind: "schedule", scheduleId },
            },
            await resolveConcurrencyPolicy(workflowId, workflowId, environment, getManifest),
          )
          await syncWakeupFromRecord(wakeupStore, record)
        },
        logger: (level, msg, data) => deps.logger(level, msg, data),
      })
      if (runner.sourceCount() === 0) return
      runner.start()
      scheduleRunners.set(environment, runner)
    }

    async function triggerRecord(
      args: TriggerArgs,
      policy: RuntimeConcurrencyPolicy | undefined,
    ): Promise<RunRecord> {
      return concurrency.run(
        {
          workflowId: args.workflowId,
          input: args.input,
          policy,
          holderId: concurrencyHolderId(args),
        },
        (hooks) =>
          orchestratorTrigger(
            {
              ...args,
              onRunRecordCreated: hooks.onRunRecordCreated,
            },
            { store: runStore, handler, now },
          ),
      )
    }

    // ---- WorkflowAdmin (full; Postgres has native query support) ----

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
        const out = await orchestratorCancel(
          { runId, reason: cancelOpts?.reason },
          { store: runStore, handler, now },
        )
        if (out.ok && isTerminal(out.record.status)) {
          concurrency.releaseRun(out.record)
        }
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
    throw new Error("StandaloneDriver: shutdown() has been called; new operations are refused.")
  }
}

async function resolveConcurrencyPolicy(
  workflow: { id: string; config?: { concurrency?: RuntimeConcurrencyPolicy } } | string,
  workflowId: string,
  environment: "production" | "preview" | "development",
  getManifest: (args: { environment: string }) => Promise<WorkflowManifest | null>,
): Promise<RuntimeConcurrencyPolicy | undefined> {
  if (typeof workflow !== "string" && workflow.config?.concurrency) {
    return workflow.config.concurrency
  }
  const manifest = await getManifest({ environment })
  return manifest?.workflows.find((entry) => entry.id === workflowId)?.concurrency
}

function isTerminal(status: RunRecord["status"]): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "compensated" ||
    status === "compensation_failed"
  )
}

function concurrencyHolderId(args: TriggerArgs): string | undefined {
  if (args.runId !== undefined) return args.runId
  if (args.idempotencyKey !== undefined) return `idem-${args.workflowId}-${args.idempotencyKey}`
  return undefined
}

function randomToken(): string {
  return Math.floor(Math.random() * 1_000_000_000)
    .toString(36)
    .padStart(6, "0")
}

async function ensureEventId(envelope: {
  name: string
  data: unknown
  metadata?: { eventId?: string }
  emittedAt: string
}): Promise<string> {
  if (envelope.metadata?.eventId) return envelope.metadata.eventId
  // Content-derived fallback per architecture doc §15.2 — closes the
  // dedup hole reviewer P2.2 flagged.
  return deriveStableEventId(envelope)
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
