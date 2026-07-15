import { createServer } from "node:http"
import { resolve as resolvePath } from "node:path"
import { handleStepRequest, type WorkflowResolver } from "@voyant-travel/workflows/handler"
import { createInMemoryRateLimiter } from "@voyant-travel/workflows/rate-limit"
import {
  createInMemoryRunStore,
  type RunRecord,
  resume,
  resumeDueAlarms,
  type StepHandler,
  trigger,
} from "./core.js"
import { createChunkBus } from "./dashboard-chunks.js"
import { startServer } from "./dashboard-http-server.js"
import { renderMetrics } from "./dashboard-metrics.js"
import {
  assertReadableDirectory,
  assertReadableFile,
  findDashboardDir,
} from "./dashboard-static.js"
import type {
  HealthReport,
  SelfHostServerOptions,
  ServeDeps,
  ServeHandle,
} from "./dashboard-types.js"
import { loadEntryFile } from "./entry-loader.js"
import { durationToMs, generateLocalRunId } from "./local-runtime.js"
import { createDefaultWakeupLeaseOwner, localTenantMeta } from "./node-selfhost-defaults.js"
import {
  mergeTags,
  requireExternalResumeFromStep,
  requireExternalSeedResults,
} from "./node-selfhost-resume-input.js"
import { createPersistentWakeupManager } from "./persistent-wakeup-manager.js"
import { createPostgresConnection } from "./postgres.js"
import { createPostgresSnapshotRunStore } from "./postgres-snapshot-run-store.js"
import { createPostgresWakeupStore } from "./postgres-wakeup-store.js"
import { buildResumeJournal, buildSeededResumeJournal } from "./resume-run.js"
import { recordToSnapshot, snapshotToRecord } from "./run-record-snapshot.js"
import { createScheduler, type SchedulerHandle, type ScheduleSource } from "./scheduler.js"
import { createFsSnapshotRunStore, type StoredRun } from "./snapshot-run-store.js"
import { createFsWakeupStore } from "./wakeup-store.js"

type WorkflowRegistryModule = Pick<
  typeof import("@voyant-travel/workflows"),
  "__resetRegistry" | "__listRegisteredWorkflows"
>

export async function startSelfHostServer(opts: SelfHostServerOptions): Promise<ServeHandle> {
  const deps = await createSelfHostDeps(opts)
  return startServer(
    {
      port: opts.port ?? 3232,
      host: opts.host ?? "127.0.0.1",
    },
    deps,
  )
}

export async function createSelfHostDeps(
  opts: Pick<
    SelfHostServerOptions,
    | "entryFile"
    | "staticDir"
    | "cacheBustEntry"
    | "services"
    | "store"
    | "databaseUrl"
    | "wakeupPollIntervalMs"
    | "wakeupLeaseMs"
    | "wakeupLeaseOwner"
  >,
): Promise<ServeDeps> {
  let staticDir = opts.staticDir
  if (!staticDir) staticDir = await findDashboardDir(process.cwd())
  if (!staticDir && typeof import.meta.url === "string") {
    const here = resolvePath(new URL(".", import.meta.url).pathname)
    staticDir = await findDashboardDir(here)
  }
  if (staticDir) {
    await assertReadableDirectory(staticDir, "dashboard static dir")
  }

  const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_URL
  const pg = databaseUrl ? createPostgresConnection({ databaseUrl }) : undefined
  const store =
    opts.store ?? (pg ? createPostgresSnapshotRunStore({ db: pg.db }) : createFsSnapshotRunStore())
  const wfMod: WorkflowRegistryModule = await import("@voyant-travel/workflows")
  wfMod.__resetRegistry()

  const entryAbs = resolvePath(process.cwd(), opts.entryFile)
  await assertReadableFile(entryAbs, "workflow entry")
  await loadEntryFile(entryAbs, { cacheBust: opts.cacheBustEntry })

  await import("@voyant-travel/workflows/handler")
  const workflowDefinitions = wfMod.__listRegisteredWorkflows()
  const workflowsById = new Map(workflowDefinitions.map((workflow) => [workflow.id, workflow]))
  const workflowResolver: WorkflowResolver = {
    resolve: (workflowId) => workflowsById.get(workflowId),
  }
  const rateLimiter = createInMemoryRateLimiter()
  const chunkBus = createChunkBus()

  const stepHandler: StepHandler = async (req, stepOpts) =>
    handleStepRequest(req, { workflowResolver, rateLimiter, services: opts.services }, stepOpts)

  const wakeupStore = pg ? createPostgresWakeupStore({ db: pg.db }) : createFsWakeupStore()
  const leaseOwner = opts.wakeupLeaseOwner ?? createDefaultWakeupLeaseOwner()

  const listWorkflows = () =>
    workflowDefinitions.map((workflow) => ({
      id: workflow.id,
      description: workflow.config.description,
    }))
  const registeredWorkflows = listWorkflows()
  if (registeredWorkflows.length === 0) {
    throw new Error(
      "voyant workflows selfhost: workflow entry registered no workflows. " +
        `Check "${entryAbs}" and ensure it calls workflow(...).`,
    )
  }

  const healthCheck = (): HealthReport => ({
    ok: true,
    service: "voyant-workflows-selfhost",
  })

  const readinessCheck = async (): Promise<HealthReport> => {
    const checks: Record<string, "ok" | "error"> = {
      workflowEntry: "ok",
    }
    const details: Record<string, unknown> = {}

    if (pg) {
      try {
        await pg.pool.query("select 1")
        checks.database = "ok"
      } catch (err) {
        checks.database = "error"
        details.database = err instanceof Error ? err.message : String(err)
      }
    }

    return {
      ok: Object.values(checks).every((status) => status === "ok"),
      service: "voyant-workflows-selfhost",
      checks,
      details: Object.keys(details).length > 0 ? details : undefined,
    }
  }

  const collectMetrics = async (): Promise<string> => {
    const runs = await store.list()
    const wakeups = await wakeupStore.list()
    const runsByStatus = runs.reduce<Record<string, number>>((acc, run) => {
      acc[run.status] = (acc[run.status] ?? 0) + 1
      return acc
    }, {})
    return renderMetrics({
      workflowsRegistered: listWorkflows().length,
      schedulesRegistered: listSchedules ? listSchedules().length : 0,
      runsTotal: runs.length,
      wakeupsTotal: wakeups.length,
      runsByStatus,
      generatedAtMs: Date.now(),
    })
  }

  const wakeupManager = createPersistentWakeupManager({
    wakeupStore,
    listRuns: () => store.list(),
    getRun: (runId) => store.get(runId),
    saveRun: async (stored) => {
      if (!store.update) {
        throw new Error("snapshot run store does not support update")
      }
      return store.update(stored)
    },
    toRecord: (stored) => snapshotToRecord(stored),
    fromRecord: (record, base) => recordToSnapshot(record, base),
    handler: stepHandler,
    onStreamChunk: ({ runId, chunk }) => chunkBus.publish({ runId, chunk }),
    logger: (level, message, data) => {
      const error =
        typeof data === "object" && data !== null && "error" in data ? data.error : undefined
      const details = error ? `: ${String(error)}` : ""
      if (level === "error") console.error(`[voyant] ${message}${details}`)
      else console.warn(`[voyant] ${message}${details}`)
    },
    createRunStore: createInMemoryRunStore,
    resumeDueAlarmsImpl: resumeDueAlarms,
    leaseOwner,
    intervalMs: opts.wakeupPollIntervalMs,
    leaseMs: opts.wakeupLeaseMs,
  })

  const cancelRun: ServeDeps["cancelRun"] = async ({ runId }) => {
    const existing = await store.get(runId)
    if (!existing) return { ok: false, message: `run "${runId}" not found`, exitCode: 1 }
    if (existing.status !== "waiting") {
      return {
        ok: false,
        message: `run "${runId}" is not parked (status: ${existing.status})`,
        exitCode: 2,
      }
    }
    if (!store.update) {
      return { ok: false, message: "snapshot run store does not support update", exitCode: 1 }
    }
    const now = Date.now()
    const updated: StoredRun = {
      ...existing,
      status: "cancelled",
      completedAt: now,
      durationMs: now - existing.startedAt,
      result: {
        ...existing.result,
        status: "cancelled",
        cancelledAt: now,
      },
    }
    const saved = await store.update(updated)
    await wakeupManager.clear(runId)
    return { ok: true, saved }
  }

  const triggerRun: ServeDeps["triggerRun"] = async ({
    workflowId,
    input,
    runId,
    tags,
    triggeredByUserId,
  }) => {
    const workflow = workflowResolver.resolve(workflowId)
    if (!workflow) {
      return {
        ok: false,
        message: `workflow "${workflowId}" is not registered in ${entryAbs}.`,
        exitCode: 2,
      }
    }
    const nextRunId = runId ?? generateLocalRunId()
    const memStore = createInMemoryRunStore()
    let record: RunRecord
    try {
      record = await trigger(
        {
          runId: nextRunId,
          workflowId,
          workflowVersion: "local",
          input,
          tenantMeta: localTenantMeta,
          tags,
          triggeredBy:
            triggeredByUserId === undefined || triggeredByUserId === null
              ? { kind: "api" }
              : { kind: "api", actor: triggeredByUserId },
          timeoutMs: durationToMs(workflow.config.timeout),
        },
        {
          store: memStore,
          handler: stepHandler,
          onStreamChunk: (chunk) => chunkBus.publish({ runId: nextRunId, chunk }),
        },
      )
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        exitCode: 1,
      }
    }
    if (!store.update) {
      return { ok: false, message: "snapshot run store does not support update", exitCode: 1 }
    }
    const stored = recordToSnapshot(record)
    stored.entryFile = entryAbs
    const saved = await store.update(stored)
    await wakeupManager.syncStoredRun(saved)
    return { ok: true, saved }
  }

  const resumeRun: ServeDeps["resumeRun"] = async ({
    parentRunId,
    workflowId: requestedWorkflowId,
    input,
    resumeFromStep,
    seedResults,
    runId,
    tags,
    triggeredByUserId,
  }) => {
    const existing = await store.get(parentRunId)
    let parent: RunRecord | undefined
    if (existing) {
      try {
        parent = snapshotToRecord(existing)
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
          exitCode: 1,
        }
      }
    } else if (!requestedWorkflowId) {
      return {
        ok: false,
        message:
          `parent run "${parentRunId}" not found; pass workflowId, resumeFromStep, ` +
          "and seedResults to resume from an external workflow-runs parent",
        exitCode: 1,
      }
    }

    const workflowId = parent?.workflowId ?? requestedWorkflowId!
    const workflow = workflowResolver.resolve(workflowId)
    if (!workflow) {
      return {
        ok: false,
        message: `workflow "${workflowId}" is not registered in ${entryAbs}.`,
        exitCode: 2,
      }
    }

    let resumeSeed: ReturnType<typeof buildResumeJournal>
    try {
      resumeSeed = parent
        ? buildResumeJournal({
            parent,
            resumeFromStep,
            seedResults,
          })
        : buildSeededResumeJournal({
            parentRunId,
            resumeFromStep: requireExternalResumeFromStep(resumeFromStep),
            seedResults: requireExternalSeedResults(seedResults),
          })
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        exitCode: 2,
      }
    }

    const memStore = createInMemoryRunStore()
    const nextRunId = runId ?? generateLocalRunId()
    let record: RunRecord
    try {
      record = await trigger(
        {
          runId: nextRunId,
          workflowId,
          workflowVersion: parent?.workflowVersion ?? "local",
          input: input === undefined ? parent?.input : input,
          tenantMeta: parent?.tenantMeta ?? localTenantMeta,
          environment: parent?.environment,
          triggeredBy:
            triggeredByUserId === undefined || triggeredByUserId === null
              ? { kind: "api" }
              : { kind: "api", actor: triggeredByUserId },
          tags: mergeTags(parent?.tags, [
            "resume:true",
            `parentRunId:${parent?.id ?? parentRunId}`,
            ...(tags ?? []),
          ]),
          timeoutMs: durationToMs(workflow.config.timeout),
          initialJournal: resumeSeed.journal,
          initialMetadataAppliedCount: resumeSeed.metadataAppliedCount,
        },
        {
          store: memStore,
          handler: stepHandler,
          onStreamChunk: (chunk) => chunkBus.publish({ runId: nextRunId, chunk }),
        },
      )
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        exitCode: 1,
      }
    }

    if (!store.update) {
      return { ok: false, message: "snapshot run store does not support update", exitCode: 1 }
    }
    const stored = recordToSnapshot(record, {
      entryFile: entryAbs,
      replayOf: parent?.id ?? parentRunId,
    })
    const saved = await store.update(stored)
    await wakeupManager.syncStoredRun(saved)
    return {
      ok: true,
      saved,
      parentRunId: parent?.id ?? parentRunId,
      resumeFromStep: resumeSeed.resumeFromStep,
    }
  }

  const injectWaitpoint: ServeDeps["injectWaitpoint"] = async ({ runId, injection }) => {
    const existing = await store.get(runId)
    if (!existing) {
      return { ok: false, message: `run "${runId}" not found`, exitCode: 1 }
    }
    if (existing.status !== "waiting") {
      return {
        ok: false,
        message: `run "${runId}" is not parked (status: ${existing.status})`,
        exitCode: 2,
      }
    }
    const record = snapshotToRecord(existing)
    if (!record) {
      return { ok: false, message: `run "${runId}" has no resumable snapshot`, exitCode: 1 }
    }
    const memStore = createInMemoryRunStore()
    await memStore.save(record)
    const out = await resume(
      { runId, injection },
      {
        store: memStore,
        handler: stepHandler,
        onStreamChunk: (chunk) => chunkBus.publish({ runId, chunk }),
      },
    )
    if (!out.ok) {
      const exitCode = out.status === "no_match" || out.status === "not_parked" ? 2 : 1
      return { ok: false, message: out.message, exitCode }
    }
    if (!store.update) {
      return { ok: false, message: "snapshot run store does not support update", exitCode: 1 }
    }
    const saved = await store.update(recordToSnapshot(out.record, existing))
    await wakeupManager.syncStoredRun(saved)
    return { ok: true, saved }
  }

  try {
    await wakeupManager.bootstrap()
  } catch (err) {
    console.warn(
      `[voyant] failed to bootstrap wakeup leases from run store: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
  wakeupManager.start()

  let scheduler: SchedulerHandle | undefined
  let listSchedules: ServeDeps["listSchedules"]
  const sources: ScheduleSource[] = []
  for (const workflow of wfMod.__listRegisteredWorkflows()) {
    const decl = workflow.config.schedule
    if (!decl) continue
    const decls = Array.isArray(decl) ? decl : [decl]
    for (const source of decls) {
      sources.push({ workflowId: workflow.id, decl: source })
    }
  }
  if (sources.length > 0) {
    scheduler = createScheduler({
      sources,
      onFire: async ({ workflowId, input }) => {
        await triggerRun({ workflowId, input })
      },
      logger: (level, message) => {
        if (level === "error") console.error(`[scheduler] ${message}`)
        else if (level === "warn") console.warn(`[scheduler] ${message}`)
      },
    })
    listSchedules = () => scheduler!.nextFirings()
  }

  return {
    store,
    createServer,
    healthCheck,
    readinessCheck,
    collectMetrics,
    shutdown: async () => {
      wakeupManager.stop()
      await pg?.close()
    },
    staticDir,
    triggerRun,
    resumeRun,
    listWorkflows,
    injectWaitpoint,
    scheduler,
    listSchedules,
    cancelRun,
    chunkBus,
  }
}
