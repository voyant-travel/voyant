// Pure conversion: wire events → Span list for the Gantt timeline.
//
// The input is `StoredRun.result.events`, which mirrors the executor's
// event stream over the session's lifetime. We pair `.started` with
// `.ok`/`.err` by stepId, and `.waitpoint.registered` with
// `.waitpoint.resolved` by waitpointId. Still-pending pairs leave
// `endAt` undefined so the renderer can draw "in-flight" tails.

import type { StoredRun } from "@/lib/api"
import type { Span } from "./timeline-types"

interface EventRecord {
  type: string
  at: number
  data: unknown
}

export function buildSpans(run: StoredRun): Span[] {
  const events = (run.result.events ?? []) as EventRecord[]
  const spans: Span[] = []

  // Step spans: key by stepId; attempts chain via `:attempt`.
  const openSteps = new Map<string, { at: number; attempt: number; index: number }>()
  // Waitpoint spans: key by waitpointId.
  const openWaitpoints = new Map<string, { at: number; index: number }>()

  for (const ev of events) {
    const d = (ev.data ?? {}) as Record<string, unknown>
    switch (ev.type) {
      case "step.started": {
        const stepId = String(d.stepId ?? "?")
        const attempt = typeof d.attempt === "number" ? d.attempt : 1
        const id = `step:${stepId}#${attempt}`
        const runtime = d.runtime === "node" ? d.runtime : undefined
        const sublabelParts: string[] = []
        if (attempt > 1) sublabelParts.push(`attempt ${attempt}`)
        // Show runtime only when older run records include it explicitly.
        if (runtime) sublabelParts.push(runtime)
        const span: Span = {
          id,
          kind: "step",
          label: stepId,
          sublabel: sublabelParts.length > 0 ? sublabelParts.join(" · ") : undefined,
          at: ev.at,
          status: "pending",
          detail: { kind: "step", stepId, attempt },
        }
        openSteps.set(id, { at: ev.at, attempt, index: spans.length })
        spans.push(span)
        break
      }
      case "step.ok": {
        const stepId = String(d.stepId ?? "?")
        const attempt = typeof d.attempt === "number" ? d.attempt : 1
        const key = `step:${stepId}#${attempt}`
        const open = openSteps.get(key)
        if (open) {
          const span = spans[open.index]!
          span.endAt = ev.at
          span.status = "ok"
          ;(span.detail as { output?: unknown }).output = d.output
          openSteps.delete(key)
        }
        break
      }
      case "step.err": {
        const stepId = String(d.stepId ?? "?")
        const attempt = typeof d.attempt === "number" ? d.attempt : 1
        const key = `step:${stepId}#${attempt}`
        const open = openSteps.get(key)
        if (open) {
          const span = spans[open.index]!
          span.endAt = ev.at
          span.status = "err"
          ;(span.detail as { error?: unknown }).error = d.error
          openSteps.delete(key)
        }
        break
      }
      case "waitpoint.registered": {
        const waitpointId = String(d.waitpointId ?? "?")
        const kind = String(d.waitpointKind ?? "EVENT") as
          | "DATETIME"
          | "EVENT"
          | "SIGNAL"
          | "RUN"
          | "MANUAL"
        const meta = (d.meta as Record<string, unknown> | undefined) ?? {}
        const label = waitpointLabel(kind, waitpointId, meta)
        const span: Span = {
          id: `wp:${waitpointId}`,
          kind: "waitpoint",
          label,
          sublabel: kind.toLowerCase(),
          at: ev.at,
          status: "pending",
          detail: { kind: "waitpoint", waitpointId, waitpointKind: kind, meta },
        }
        openWaitpoints.set(waitpointId, { at: ev.at, index: spans.length })
        spans.push(span)
        break
      }
      case "waitpoint.resolved": {
        const waitpointId = String(d.waitpointId ?? "?")
        const open = openWaitpoints.get(waitpointId)
        if (open) {
          const span = spans[open.index]!
          span.endAt = ev.at
          const wpError = d.error as { message: string; code: string } | undefined
          span.status = wpError ? "err" : "resolved"
          const detail = span.detail as {
            payload?: unknown
            error?: { message: string; code: string }
          }
          detail.payload = d.payload
          if (wpError) detail.error = wpError
          openWaitpoints.delete(waitpointId)
        }
        break
      }
      case "log": {
        const level = (d.level as "info" | "warn" | "error") ?? "info"
        const message = String(d.message ?? "")
        spans.push({
          id: `log:${ev.at}:${spans.length}`,
          kind: "log",
          label: message,
          sublabel: level,
          at: ev.at,
          endAt: ev.at,
          status: level === "error" ? "err" : "ok",
          detail: {
            kind: "log",
            level,
            message,
            stepId: d.stepId as string | undefined,
          },
        })
        break
      }
      case "step.compensated": {
        const stepId = String(d.stepId ?? "?")
        const status = (d.status as "ok" | "err") ?? "ok"
        const durationMs = typeof d.durationMs === "number" ? d.durationMs : undefined
        const endAt = durationMs !== undefined ? ev.at + durationMs : ev.at
        spans.push({
          id: `comp:${stepId}:${ev.at}`,
          kind: "compensation",
          label: `↩ compensate ${stepId}`,
          sublabel: status === "ok" ? undefined : "failed",
          at: ev.at,
          endAt,
          status: status === "ok" ? "ok" : "err",
          detail: {
            kind: "compensation",
            stepId,
            status,
            error: d.error as { message: string } | undefined,
          },
        })
        break
      }
      case "metadata.changed":
      case "run.finished":
        // Not rendered as rows — the run-root span covers the lifecycle
        // and the metadata panel renders the final state.
        break
    }
  }

  // Stream chunks: each chunk is an instant point; no pairing needed.
  const streams = run.result.streams ?? {}
  for (const [streamId, chunks] of Object.entries(streams)) {
    for (const chunk of chunks) {
      spans.push({
        id: `stream:${streamId}:${chunk.seq}`,
        kind: "stream",
        label: `${streamId} #${chunk.seq}`,
        sublabel: chunk.encoding,
        at: chunk.at,
        endAt: chunk.at,
        status: chunk.final ? "resolved" : "pending",
        detail: {
          kind: "stream",
          streamId,
          seq: chunk.seq,
          encoding: chunk.encoding,
          chunk: chunk.chunk,
          final: chunk.final,
        },
      })
    }
  }

  // Sort by start time so rows read top-to-bottom in chronological order.
  spans.sort((a, b) => a.at - b.at)
  return spans
}

export function buildRootSpan(run: StoredRun, endAt: number): Span {
  const terminal = [
    "completed",
    "failed",
    "cancelled",
    "compensated",
    "compensation_failed",
    "timed_out",
  ]
  return {
    id: "run",
    kind: "run",
    label: run.workflowId,
    sublabel: run.id,
    at: run.startedAt,
    endAt: terminal.includes(run.status) ? (run.completedAt ?? endAt) : undefined,
    status:
      run.status === "completed" || run.status === "compensated"
        ? "ok"
        : run.status === "failed" ||
            run.status === "compensation_failed" ||
            run.status === "timed_out"
          ? "err"
          : run.status === "cancelled"
            ? "cancelled"
            : "pending",
    detail: {
      kind: "run",
      output: run.result.output,
      error: run.result.error,
    },
  }
}

function waitpointLabel(kind: string, waitpointId: string, meta: Record<string, unknown>): string {
  if (kind === "DATETIME") return `sleep · ${waitpointId}`
  if (kind === "EVENT") return `event · ${String(meta.eventType ?? waitpointId)}`
  if (kind === "SIGNAL") return `signal · ${String(meta.signalName ?? waitpointId)}`
  if (kind === "RUN") return `child · ${String(meta.childWorkflowId ?? waitpointId)}`
  if (kind === "MANUAL") return `token · ${String(meta.tokenId ?? waitpointId)}`
  return waitpointId
}
