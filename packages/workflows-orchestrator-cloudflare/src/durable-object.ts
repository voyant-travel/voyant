// The WorkflowRunDO — one Durable Object per run. Holds the
// RunRecord in storage, drives the run through the tenant via a
// dispatch-namespace StepHandler, exposes a tiny HTTP surface to
// the outer Worker, and schedules DO alarms for DATETIME waitpoints
// so `ctx.sleep(...)` wakes back up.
//
// Routes:
//   POST /trigger      { ...TriggerPayload }        → RunRecord
//   POST /resume       { injection }                → RunRecord | error
//   POST /cancel       { reason? }                  → RunRecord | error
//   GET  /get                                       → RunRecord | 404
//
// Alarm entry point: handleDurableObjectAlarm(deps). Fired by the CF
// runtime at the wake time scheduled by setAlarm; resolves due
// DATETIME waitpoints, re-drives, and reschedules if needed.
//
// Callers should treat the HTTP surface as an implementation detail;
// the public surface is the outer Worker's /api/* routes.

import {
  applyWaitpointInjection,
  driveUntilPaused,
  cancel as orchestratorCancel,
  resume as orchestratorResume,
  trigger as orchestratorTrigger,
  type PendingWaitpoint,
  type RunRecord,
  type StepHandler,
} from "@voyantjs/workflows-orchestrator"

import type { StepDispatcher } from "./dispatchers.js"
import { createDurableObjectRunStore } from "./do-store.js"
import type {
  CancelPayload,
  DurableObjectStorageLike,
  ResumePayload,
  TriggerPayload,
} from "./types.js"

export interface DurableObjectDeps {
  storage: DurableObjectStorageLike
  /**
   * Pluggable dispatcher producing a StepHandler for a given run's
   * context. The DO calls `dispatcher({ tenantScript, workflowId })`
   * once per drive; the returned handler delivers step requests to
   * whatever Worker (or isolate) hosts the workflow code.
   *
   * Pick a factory from `./dispatchers.ts`:
   *  - `createWfpDispatcher`           — multi-tenant via dispatch namespace
   *  - `createServiceBindingDispatcher` — sibling Worker via service binding
   *  - `createInlineDispatcher`         — same Worker / direct call
   *  - `createHttpDispatcher`           — arbitrary HTTP endpoint
   */
  dispatcher: StepDispatcher
  now?: () => number
}

function resolve(
  deps: DurableObjectDeps,
  record: { tenantMeta: { tenantScript?: string }; workflowId: string },
): StepHandler {
  return deps.dispatcher({
    tenantScript: record.tenantMeta.tenantScript,
    workflowId: record.workflowId,
  })
}

export async function handleDurableObjectRequest(
  req: Request,
  deps: DurableObjectDeps,
): Promise<Response> {
  const url = new URL(req.url)
  const store = createDurableObjectRunStore(deps.storage)

  if (req.method === "POST" && url.pathname === "/trigger") {
    const payload = (await req.json()) as TriggerPayload
    const handler = resolve(deps, {
      tenantMeta: payload.tenantMeta,
      workflowId: payload.workflowId,
    })
    const record = await orchestratorTrigger(
      {
        workflowId: payload.workflowId,
        workflowVersion: payload.workflowVersion,
        input: payload.input,
        tenantMeta: payload.tenantMeta,
        environment: payload.environment,
        tags: payload.tags,
        runId: payload.runId,
        idempotencyKey: payload.idempotencyKey,
        delay:
          typeof payload.delay === "object" && payload.delay !== null && "wakeAt" in payload.delay
            ? new Date(payload.delay.wakeAt)
            : payload.delay,
        priority: payload.priority,
      },
      { store, handler, now: deps.now },
    )
    await reconcileAlarm(record, store, deps)
    return json(200, record)
  }

  if (req.method === "POST" && url.pathname === "/resume") {
    const payload = (await req.json()) as ResumePayload
    const existing = await store.get((await getStoredRunId(store)) ?? "")
    if (!existing) return json(404, { error: "not_found", message: "no run stored in this DO" })
    const handler = resolve(deps, existing)
    const out = await orchestratorResume(
      { runId: existing.id, injection: payload.injection },
      { store, handler, now: deps.now },
    )
    if (!out.ok) {
      const status = out.status === "not_found" ? 404 : out.status === "no_match" ? 400 : 409
      return json(status, { error: out.status, message: out.message })
    }
    await reconcileAlarm(out.record, store, deps)
    return json(200, out.record)
  }

  if (req.method === "POST" && url.pathname === "/cancel") {
    const payload = (await req.json()) as CancelPayload
    const existing = await store.get((await getStoredRunId(store)) ?? "")
    if (!existing) return json(404, { error: "not_found", message: "no run stored in this DO" })
    const handler = resolve(deps, existing)
    const out = await orchestratorCancel(
      { runId: existing.id, reason: payload.reason },
      { store, handler, now: deps.now },
    )
    if (!out.ok) {
      const status = out.status === "not_found" ? 404 : 409
      return json(status, { error: out.status, message: out.message })
    }
    await reconcileAlarm(out.record, store, deps)
    return json(200, out.record)
  }

  if (req.method === "GET" && url.pathname === "/get") {
    const existing = await store.get((await getStoredRunId(store)) ?? "")
    if (!existing) return json(404, { error: "not_found" })
    return json(200, existing)
  }

  return json(404, { error: "route_not_found", path: url.pathname })
}

/**
 * Fire this from your DO's `alarm()` method. Walks pending
 * waitpoints, resolves every DATETIME whose `wakeAt` is <= now,
 * re-drives the run, and reschedules the next alarm if the run
 * parked on another DATETIME.
 */
export async function handleDurableObjectAlarm(deps: DurableObjectDeps): Promise<void> {
  const store = createDurableObjectRunStore(deps.storage)
  const existingId = await getStoredRunId(store)
  if (!existingId) return
  const record = await store.get(existingId)
  if (!record) return
  if (record.status !== "waiting") {
    await deps.storage.deleteAlarm?.()
    return
  }

  const now = (deps.now ?? (() => Date.now()))()
  const stillPending: PendingWaitpoint[] = []
  let resolvedAny = false
  for (const wp of record.pendingWaitpoints) {
    const wakeAt = typeof wp.meta.wakeAt === "number" ? wp.meta.wakeAt : undefined
    if (wp.kind === "DATETIME" && wakeAt !== undefined && wakeAt <= now) {
      record.journal.waitpointsResolved[wp.clientWaitpointId] = {
        kind: "DATETIME",
        resolvedAt: now,
        source: "replay",
      }
      resolvedAny = true
    } else {
      stillPending.push(wp)
    }
  }
  record.pendingWaitpoints = stillPending
  if (!resolvedAny) {
    // Spurious alarm — nothing due. Persist and reconcile.
    await store.save(record)
    await reconcileAlarm(record, store, deps)
    return
  }

  record.status = "running"
  const handler = resolve(deps, record)
  await driveUntilPaused(record, { handler, now: deps.now })
  await store.save(record)
  await reconcileAlarm(record, store, deps)
}

/**
 * Look at the record's pending waitpoints; if any are DATETIME,
 * stamp a `wakeAt` into meta (if not already set) and schedule the
 * earliest via `setAlarm`. Clears any prior alarm when the run is
 * terminal or has no DATETIME waitpoints left.
 */
async function reconcileAlarm(
  record: RunRecord,
  store: ReturnType<typeof createDurableObjectRunStore>,
  deps: DurableObjectDeps,
): Promise<void> {
  const now = (deps.now ?? (() => Date.now()))()
  if (record.status !== "waiting") {
    await deps.storage.deleteAlarm?.()
    return
  }
  let earliest: number | undefined
  let dirty = false
  for (const wp of record.pendingWaitpoints) {
    if (wp.kind !== "DATETIME") continue
    let wakeAt = typeof wp.meta.wakeAt === "number" ? wp.meta.wakeAt : undefined
    if (wakeAt === undefined) {
      const ms = wp.timeoutMs ?? (typeof wp.meta.durationMs === "number" ? wp.meta.durationMs : 0)
      wakeAt = now + ms
      wp.meta.wakeAt = wakeAt
      dirty = true
    }
    earliest = earliest === undefined ? wakeAt : Math.min(earliest, wakeAt)
  }
  if (dirty) await store.save(record)
  if (earliest !== undefined) {
    await deps.storage.setAlarm?.(earliest)
  } else {
    await deps.storage.deleteAlarm?.()
  }
}

/**
 * One DO holds one run, keyed by `record`. Returns the id of that
 * stored run, if any.
 */
async function getStoredRunId(
  store: ReturnType<typeof createDurableObjectRunStore>,
): Promise<string | undefined> {
  const all = await store.list()
  return all[0]?.id
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

export type { RunRecord }
// Re-exported for callers building their own DO class via composition.
export { applyWaitpointInjection, driveUntilPaused }
