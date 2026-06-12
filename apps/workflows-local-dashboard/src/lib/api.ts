// API client + shared types for the local dashboard.
//
// The server lives in `apps/cli/src/commands/workflows/serve.ts`; its
// JSON shapes are what these types describe. The dashboard is always
// served same-origin, so all URLs are relative.

export const API_BASE = ""

/**
 * Shape of `StoredRun.result` on the wire. Mirrors
 * `TestResult<TOut>` from `@voyantjs/workflows/testing` but loosened to
 * the fields the dashboard actually renders.
 */
export interface RunResult {
  status: "completed" | "failed" | "cancelled" | "compensated" | "compensation_failed" | "waiting"
  output?: unknown
  error?: { message: string; code: string; category?: string }
  steps: ReadonlyArray<{
    id: string
    status: "ok" | "err" | "skipped"
    duration: number
    output?: unknown
  }>
  events: ReadonlyArray<{ type: string; at: number; data: unknown }>
  metadata?: Record<string, unknown>
  compensations?: ReadonlyArray<{
    stepId: string
    status: "ok" | "err"
    durationMs: number
    error?: { message: string; code?: string }
  }>
  streams?: Record<string, StreamChunk[]>
  invocations?: number
}

export interface StoredRun {
  id: string
  workflowId: string
  status: string
  startedAt: number
  completedAt?: number
  durationMs?: number
  tags?: string[]
  input: unknown
  result: RunResult
  replayOf?: string
}

export interface WorkflowSummary {
  id: string
  description?: string
}

export interface ScheduleSummary {
  workflowId: string
  name?: string
  nextAt: number
  done: boolean
}

export interface PendingWaitpoint {
  clientWaitpointId: string
  kind: "EVENT" | "SIGNAL" | "MANUAL" | "DATETIME" | "RUN"
  meta: Record<string, unknown>
}

export interface StreamChunk {
  streamId: string
  seq: number
  encoding: "text" | "json" | "base64"
  chunk: unknown
  final: boolean
  at: number
}

export async function fetchRuns(): Promise<StoredRun[]> {
  const r = await fetch(`${API_BASE}/api/runs`)
  if (!r.ok) throw new Error(`fetch /api/runs → HTTP ${r.status}`)
  const body = (await r.json()) as { runs: StoredRun[] }
  return body.runs
}

export async function fetchWorkflows(): Promise<WorkflowSummary[]> {
  const r = await fetch(`${API_BASE}/api/workflows`)
  if (!r.ok) return []
  const body = (await r.json()) as { workflows?: WorkflowSummary[] }
  return body.workflows ?? []
}

export async function fetchSchedules(): Promise<ScheduleSummary[]> {
  const r = await fetch(`${API_BASE}/api/schedules`)
  if (!r.ok) return []
  const body = (await r.json()) as { schedules?: ScheduleSummary[] }
  return body.schedules ?? []
}

export async function triggerRun(
  workflowId: string,
  input: unknown,
): Promise<{ ok: true; runId: string } | { ok: false; message: string }> {
  const r = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workflowId, input }),
  })
  const body = (await r.json()) as { saved: { id: string } } | { error: string; message: string }
  if (!r.ok || !("saved" in body)) {
    return { ok: false, message: "message" in body ? body.message : `HTTP ${r.status}` }
  }
  return { ok: true, runId: body.saved.id }
}

export async function replayRun(
  runId: string,
): Promise<{ ok: true; newRunId: string } | { ok: false; message: string }> {
  const r = await fetch(`${API_BASE}/api/runs/${encodeURIComponent(runId)}/replay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  })
  const body = (await r.json()) as { saved: { id: string } } | { error: string; message: string }
  if (!r.ok || !("saved" in body)) {
    return { ok: false, message: "message" in body ? body.message : `HTTP ${r.status}` }
  }
  return { ok: true, newRunId: body.saved.id }
}

export async function cancelRun(
  runId: string,
): Promise<{ ok: true; saved: StoredRun } | { ok: false; message: string }> {
  const r = await fetch(`${API_BASE}/api/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
  })
  const body = (await r.json()) as { saved: StoredRun } | { error: string; message: string }
  if (!r.ok || !("saved" in body)) {
    return { ok: false, message: "message" in body ? body.message : `HTTP ${r.status}` }
  }
  return { ok: true, saved: body.saved }
}

export async function resolveWaitpoint(
  runId: string,
  wp: PendingWaitpoint,
  payload: unknown,
): Promise<{ ok: true; saved: StoredRun } | { ok: false; message: string }> {
  const endpoint = waitpointEndpoint(runId, wp)
  if (!endpoint) return { ok: false, message: `no endpoint for waitpoint kind ${wp.kind}` }
  const r = await fetch(`${API_BASE}${endpoint.url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...endpoint.body, payload }),
  })
  const body = (await r.json()) as { saved: StoredRun } | { error: string; message: string }
  if (!r.ok || !("saved" in body)) {
    return { ok: false, message: "message" in body ? body.message : `HTTP ${r.status}` }
  }
  return { ok: true, saved: body.saved }
}

function waitpointEndpoint(
  runId: string,
  wp: PendingWaitpoint,
): { url: string; body: Record<string, unknown> } | undefined {
  const id = encodeURIComponent(runId)
  if (wp.kind === "EVENT") {
    return { url: `/api/runs/${id}/events`, body: { eventType: wp.meta.eventType } }
  }
  if (wp.kind === "SIGNAL") {
    return { url: `/api/runs/${id}/signals`, body: { name: wp.meta.signalName } }
  }
  if (wp.kind === "MANUAL") {
    return {
      url: `/api/runs/${id}/tokens/${encodeURIComponent(String(wp.meta.tokenId))}`,
      body: {},
    }
  }
  return undefined
}

/** Extract pendingWaitpoints off the embedded runRecord, if any. */
export function pendingWaitpoints(run: StoredRun): PendingWaitpoint[] {
  const rec = (run as StoredRun & { runRecord?: { pendingWaitpoints?: PendingWaitpoint[] } })
    .runRecord
  return rec?.pendingWaitpoints ?? []
}
