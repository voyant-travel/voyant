// agent-quality: file-size exception -- owner: workflows-orchestrator; existing module stays co-located until a dedicated split preserves behavior and tests.
// In-memory WorkflowDriver — primarily for tests, also for short-lived
// scripts and the parameterized compliance suite.
//
// Wraps the existing pure orchestrator functions (trigger / resume / cancel)
// with `createInMemoryRunStore` for state and an in-process `StepHandler`
// glue (`handleStepRequest` from `@voyant-travel/workflows/handler`). Manifests
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
} from "@voyant-travel/workflows"
import { getWorkflow } from "@voyant-travel/workflows"
import {
  type DriverFactory,
  type DriverFactoryDeps,
  type IngestEventArgs,
  type IngestEventResponse,
  type IngestMatch,
  ManifestNotRegisteredError,
  type WorkflowAdmin,
  type WorkflowDriver,
} from "@voyant-travel/workflows/driver"
import { deriveStableEventId } from "@voyant-travel/workflows/events"
import {
  handleStepRequest,
  type WorkflowResolver,
  type WorkflowStepRequest,
} from "@voyant-travel/workflows/handler"
import type { WorkflowManifest } from "@voyant-travel/workflows/protocol"

import {
  createInProcessConcurrencyCoordinator,
  type RuntimeConcurrencyPolicy,
} from "./concurrency.js"
import { routeEvent } from "./event-router.js"
import { createInMemoryRunStore } from "./in-memory-store.js"
import {
  cancel as orchestratorCancel,
  trigger as orchestratorTrigger,
  resumeDueAlarms,
  type TriggerArgs,
} from "./orchestrator.js"
import { createScheduler, manifestScheduleSources, type SchedulerHandle } from "./schedule.js"
import type { RunRecord, StepHandler } from "./types.js"

// ---- Public factory options ----

export interface InMemoryDriverOptions {
  /** Default environment for `trigger()` calls that don't specify one. */
  defaultEnvironment?: EnvironmentName
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
  /** Step handler override — defaults to in-process `handleStepRequest`. */
  handler?: StepHandler
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

const legacyWorkflowResolver: WorkflowResolver = {
  resolve: getWorkflow,
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
    const scheduleRunners = new Map<EnvironmentName, SchedulerHandle>()
    const now = opts.now ?? deps.now ?? (() => Date.now())
    const tenantMeta = opts.tenantMeta ?? DEFAULT_TENANT_META
    const defaultEnv: EnvironmentName = opts.defaultEnvironment ?? "development"
    const workflowResolver = opts.workflowResolver ?? legacyWorkflowResolver
    // Wire the framework-supplied service container through to step bodies.
    // The handler closes over `deps.services` so every step invocation
    // surfaces it as `ctx.services` inside the workflow body.
    const handler: StepHandler =
      opts.handler ??
      (async (req: WorkflowStepRequest, stepOpts) =>
        handleStepRequest(req, { workflowResolver, services: deps.services }, stepOpts))

    let shuttingDown = false
    const concurrency = createInProcessConcurrencyCoordinator({
      async cancelRun(runId, reason) {
        const out = await orchestratorCancel({ runId, reason }, { store, handler, now })
        if (out.ok && isTerminal(out.record.status)) {
          concurrency.releaseRun(out.record)
        }
      },
    })

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
      startScheduleRunner(args.environment, args.manifest)
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
      const policy = resolveConcurrencyPolicy(workflow, workflowId, env, manifests)

      // The orchestrator core handles idempotencyKey natively (deterministic
      // runId derivation from `(workflowId, idempotencyKey)`); the driver just
      // forwards the field. Persistent stores like `voyant_snapshot_runs`
      // additionally read `RunRecord.idempotencyKey` to populate their own
      // dedup column.
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
      scheduleDelayedRun(record)
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
      const eventId = await ensureEventId(args.envelope)
      const routed = routeEvent({
        manifest: stored.manifest,
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
            resolveConcurrencyPolicy(
              entry.targetWorkflowId,
              entry.targetWorkflowId,
              args.environment,
              manifests,
            ),
          )
          scheduleDelayedRun(record)
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

      // Drivers return ok:true if at least one match queued; ok:false only if
      // every match errored (per architecture doc §15.5).
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
      for (const runner of scheduleRunners.values()) {
        runner.stop()
      }
      scheduleRunners.clear()
    }

    function startScheduleRunner(environment: EnvironmentName, manifest: WorkflowManifest): void {
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
            resolveConcurrencyPolicy(workflowId, workflowId, environment, manifests),
          )
          scheduleDelayedRun(record)
        },
        logger: (level, msg, data) => deps.logger(level, msg, data),
      })
      if (runner.sourceCount() === 0) return
      runner.start()
      scheduleRunners.set(environment, runner)
    }

    function scheduleDelayedRun(record: RunRecord): void {
      if (record.status !== "waiting") return
      const wakeAt = earliestWakeAt(record)
      if (wakeAt === undefined) return
      const delayMs = Math.max(0, wakeAt - now())
      const timer = setTimeout(() => {
        void resumeDueAlarms({ runId: record.id }, { store, handler, now }).then(
          async (resumed) => {
            if (!resumed) {
              const latest = await store.get(record.id)
              if (latest) scheduleDelayedRun(latest)
              return
            }
            if (isTerminal(resumed.status)) {
              concurrency.releaseRun(resumed)
            }
            scheduleDelayedRun(resumed)
          },
        )
      }, delayMs)
      ;(timer as { unref?: () => void }).unref?.()
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
            { store, handler, now },
          ),
      )
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
        const out = await orchestratorCancel(
          { runId, reason: cancelOpts?.reason },
          { store, handler, now },
        )
        if (out.ok && isTerminal(out.record.status)) {
          concurrency.releaseRun(out.record)
        }
      },

      // streamRun is not implemented for InMemory. Dashboards that
      // probe `driver.admin.streamRun` get `undefined` and fall back to
      // their non-streaming view. Node/Postgres and legacy Cloudflare
      // drivers can provide their own journal streams.
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

function concurrencyHolderId(args: TriggerArgs): string | undefined {
  if (args.runId !== undefined) return args.runId
  if (args.idempotencyKey !== undefined) return `idem-${args.workflowId}-${args.idempotencyKey}`
  return undefined
}

function earliestWakeAt(record: RunRecord): number | undefined {
  let earliest: number | undefined
  for (const waitpoint of record.pendingWaitpoints) {
    if (waitpoint.kind !== "DATETIME") continue
    const wakeAt = typeof waitpoint.meta.wakeAt === "number" ? waitpoint.meta.wakeAt : undefined
    if (wakeAt === undefined) continue
    earliest = earliest === undefined ? wakeAt : Math.min(earliest, wakeAt)
  }
  return earliest
}

// ---- Helpers ----

function assertNotShutdown(shuttingDown: boolean): void {
  if (shuttingDown) {
    throw new Error("InMemoryDriver: shutdown() has been called; new operations are refused.")
  }
}

function resolveConcurrencyPolicy(
  workflow: { id: string; config?: { concurrency?: RuntimeConcurrencyPolicy } } | string,
  workflowId: string,
  environment: EnvironmentName,
  manifests: Map<EnvironmentName, { manifest: WorkflowManifest; versionId: string }>,
): RuntimeConcurrencyPolicy | undefined {
  if (typeof workflow !== "string" && workflow.config?.concurrency) {
    return workflow.config.concurrency
  }
  const manifest = manifests.get(environment)?.manifest
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

async function ensureEventId(envelope: {
  name: string
  data: unknown
  metadata?: { eventId?: string }
  emittedAt: string
}): Promise<string> {
  if (envelope.metadata?.eventId) return envelope.metadata.eventId
  // Content-derived fallback per architecture doc §15.2. Two ingests
  // with byte-equal envelopes produce the same id, so retries dedupe
  // through the driver's `${filterId}:${eventId}` idempotency key.
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
