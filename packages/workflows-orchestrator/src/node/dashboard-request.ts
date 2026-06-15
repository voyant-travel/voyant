import { URL } from "node:url"
import type { WaitpointInjection } from "./core.js"
import { renderMetrics } from "./dashboard-metrics.js"
import { mimeFor } from "./dashboard-static.js"
import type { HandlerResponse, HealthReport, RequestHandlerDeps } from "./dashboard-types.js"
import type { ListFilter } from "./snapshot-run-store.js"

export async function handleRequest(
  req: { method: string; url: string; body?: string },
  deps: RequestHandlerDeps,
): Promise<HandlerResponse> {
  const method = (req.method ?? "GET").toUpperCase()
  const url = new URL(req.url, "http://local")

  if (method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS, POST",
        "access-control-allow-headers": "content-type",
      },
      body: "",
    }
  }

  if (method === "POST") {
    const cancelMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/cancel$/)
    if (cancelMatch) {
      if (!deps.cancelRun) {
        return json(501, {
          error: "cancel_not_supported",
          message:
            "This self-host server was started without a workflow entry. " +
            "Restart with `--file <path>` to enable cancellation.",
        })
      }
      const runId = decodeURIComponent(cancelMatch[1]!)
      const result = await deps.cancelRun({ runId })
      if (!result.ok) {
        return json(result.exitCode === 2 ? 400 : 404, {
          error: "cancel_failed",
          message: result.message,
        })
      }
      return json(200, { saved: result.saved })
    }

    const resumeMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/resume$/)
    if (resumeMatch) {
      if (!deps.resumeRun) {
        return json(501, {
          error: "resume_not_supported",
          message:
            "This self-host server was started without a workflow entry. " +
            "Restart with `--file <path>` to enable failed-step resume.",
        })
      }
      const parsed = parseResumeRequestBody(req.body)
      if (!parsed.ok) {
        return json(parsed.status, { error: parsed.error, message: parsed.message })
      }
      const parentRunId = decodeURIComponent(resumeMatch[1]!)
      const result = await deps.resumeRun({ parentRunId, ...parsed.body })
      if (!result.ok) {
        return json(result.exitCode === 2 ? 400 : 404, {
          error: "resume_failed",
          message: result.message,
        })
      }
      return json(200, {
        saved: result.saved,
        parentRunId: result.parentRunId,
        resumeFromStep: result.resumeFromStep,
      })
    }

    const eventsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/)
    const signalsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/signals$/)
    const tokenMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/tokens\/([^/]+)$/)
    if (eventsMatch || signalsMatch || tokenMatch) {
      if (!deps.injectWaitpoint) {
        return json(501, {
          error: "inject_not_supported",
          message:
            "This self-host server was started without a workflow entry. " +
            "Restart with `--file <path>` to enable event / signal / token injection.",
        })
      }
      let parsed: Record<string, unknown>
      try {
        parsed = req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {}
      } catch (err) {
        return json(400, {
          error: "invalid_json",
          message: err instanceof Error ? err.message : String(err),
        })
      }
      let injection: WaitpointInjection
      if (eventsMatch) {
        if (typeof parsed.eventType !== "string" || parsed.eventType.length === 0) {
          return json(400, { error: "invalid_body", message: "`eventType` (string) is required" })
        }
        injection = { kind: "EVENT", eventType: parsed.eventType, payload: parsed.payload }
      } else if (signalsMatch) {
        if (typeof parsed.name !== "string" || parsed.name.length === 0) {
          return json(400, { error: "invalid_body", message: "`name` (string) is required" })
        }
        injection = { kind: "SIGNAL", name: parsed.name, payload: parsed.payload }
      } else {
        injection = {
          kind: "MANUAL",
          tokenId: decodeURIComponent(tokenMatch![2]!),
          payload: parsed.payload,
        }
      }
      const runId = decodeURIComponent((eventsMatch?.[1] ?? signalsMatch?.[1] ?? tokenMatch?.[1])!)
      const result = await deps.injectWaitpoint({ runId, injection })
      if (!result.ok) {
        return json(result.exitCode === 2 ? 400 : 404, {
          error: "inject_failed",
          message: result.message,
        })
      }
      return json(200, { saved: result.saved })
    }

    if (url.pathname === "/api/runs") {
      if (!deps.triggerRun) {
        return json(501, {
          error: "trigger_not_supported",
          message:
            "This self-host server was started without a workflow entry. " +
            "Restart with `--file <path>` to enable triggering.",
        })
      }
      let parsed: {
        workflowId?: unknown
        input?: unknown
        runId?: unknown
        tags?: unknown
        triggeredByUserId?: unknown
      }
      try {
        parsed = req.body ? JSON.parse(req.body) : {}
      } catch (err) {
        return json(400, {
          error: "invalid_json",
          message: err instanceof Error ? err.message : String(err),
        })
      }
      if (typeof parsed.workflowId !== "string" || parsed.workflowId.length === 0) {
        return json(400, {
          error: "invalid_body",
          message: "`workflowId` (string) is required",
        })
      }
      if (parsed.runId !== undefined && typeof parsed.runId !== "string") {
        return json(400, {
          error: "invalid_body",
          message: "`runId` must be a string when provided",
        })
      }
      if (parsed.tags !== undefined && !isStringArray(parsed.tags)) {
        return json(400, {
          error: "invalid_body",
          message: "`tags` must be an array of strings when provided",
        })
      }
      if (
        parsed.triggeredByUserId !== undefined &&
        parsed.triggeredByUserId !== null &&
        typeof parsed.triggeredByUserId !== "string"
      ) {
        return json(400, {
          error: "invalid_body",
          message: "`triggeredByUserId` must be a string or null when provided",
        })
      }
      const result = await deps.triggerRun({
        workflowId: parsed.workflowId,
        input: parsed.input,
        runId: parsed.runId,
        tags: parsed.tags,
        triggeredByUserId: parsed.triggeredByUserId,
      })
      if (!result.ok) {
        return json(result.exitCode === 2 ? 400 : 404, {
          error: "trigger_failed",
          message: result.message,
        })
      }
      return json(200, { saved: result.saved })
    }

    return json(404, { error: "route_not_found", path: url.pathname })
  }

  if (method !== "GET" && method !== "HEAD") {
    return json(405, { error: "method_not_allowed", allowed: ["GET", "HEAD", "OPTIONS", "POST"] })
  }

  if (url.pathname === "/healthz") {
    const report = await resolveHealthReport(deps.healthCheck, {
      ok: true,
      service: "voyant-workflows-selfhost",
    })
    return json(report.ok ? 200 : 503, report)
  }

  if (url.pathname === "/readyz") {
    const report = await resolveHealthReport(deps.readinessCheck, {
      ok: Boolean(deps.triggerRun),
      service: "voyant-workflows-selfhost",
      checks: {
        workflowEntry: deps.triggerRun ? "ok" : "error",
      },
      details: deps.triggerRun
        ? undefined
        : {
            workflowEntry: "This self-host server was started without a workflow entry.",
          },
    })
    return json(report.ok ? 200 : 503, report)
  }

  if (url.pathname === "/metrics") {
    const body = await resolveMetricsBody(deps.collectMetrics)
    return {
      status: 200,
      headers: {
        "content-type": "text/plain; version=0.0.4; charset=utf-8",
        "cache-control": "no-store",
      },
      body,
    }
  }

  if (url.pathname === "/" || url.pathname === "") {
    if (deps.hasStaticDashboard && deps.readStatic) {
      const bytes = await deps.readStatic("index.html")
      if (bytes) {
        return {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
          body: bytes,
        }
      }
    }
    return json(200, {
      service: "voyant workflows selfhost",
      endpoints: ["/api/runs", "/api/runs/:id"],
    })
  }

  if (deps.hasStaticDashboard && deps.readStatic && !url.pathname.startsWith("/api/")) {
    const clean = url.pathname.replace(/^\/+/, "")
    if (clean && !clean.includes("..")) {
      const bytes = await deps.readStatic(clean)
      if (bytes) {
        return {
          status: 200,
          headers: {
            "content-type": mimeFor(clean),
            "cache-control": "no-store",
          },
          body: bytes,
        }
      }
    }
  }

  if (url.pathname === "/api/workflows") {
    const workflows = deps.listWorkflows ? deps.listWorkflows() : []
    return json(200, { workflows })
  }

  if (url.pathname === "/api/schedules") {
    const schedules = deps.listSchedules ? deps.listSchedules() : []
    return json(200, { schedules })
  }

  if (url.pathname === "/api/runs") {
    const filter: ListFilter = {}
    const workflowId = url.searchParams.get("workflow") ?? url.searchParams.get("workflowId")
    if (workflowId) filter.workflowId = workflowId
    const status = url.searchParams.get("status")
    if (status) filter.status = status
    const limitRaw = url.searchParams.get("limit")
    if (limitRaw !== null) {
      const limit = Number.parseInt(limitRaw, 10)
      if (Number.isNaN(limit) || limit < 0) {
        return json(400, {
          error: "invalid_limit",
          message: `limit must be a non-negative integer (got "${limitRaw}")`,
        })
      }
      filter.limit = limit
    }
    const runs = await deps.store.list(filter)
    return json(200, { runs })
  }

  const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/)
  if (runMatch) {
    const runId = decodeURIComponent(runMatch[1]!)
    const run = await deps.store.get(runId)
    if (!run) return json(404, { error: "not_found", runId })
    return json(200, { run })
  }

  return json(404, { error: "route_not_found", path: url.pathname })
}

function parseResumeRequestBody(body: string | undefined):
  | {
      ok: true
      body: {
        input?: unknown
        workflowId?: string
        resumeFromStep?: string
        seedResults?: Record<string, unknown>
        runId?: string
        tags?: string[]
        triggeredByUserId?: string | null
      }
    }
  | { ok: false; status: number; error: string; message: string } {
  let parsed: Record<string, unknown>
  try {
    parsed = body ? (JSON.parse(body) as Record<string, unknown>) : {}
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: "invalid_json",
      message: err instanceof Error ? err.message : String(err),
    }
  }
  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "request body must be an object",
    }
  }
  if (parsed.resumeFromStep !== undefined && typeof parsed.resumeFromStep !== "string") {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`resumeFromStep` must be a string when provided",
    }
  }
  if (parsed.workflowId !== undefined && typeof parsed.workflowId !== "string") {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`workflowId` must be a string when provided",
    }
  }
  if (parsed.runId !== undefined && typeof parsed.runId !== "string") {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`runId` must be a string when provided",
    }
  }
  if (
    parsed.triggeredByUserId !== undefined &&
    parsed.triggeredByUserId !== null &&
    typeof parsed.triggeredByUserId !== "string"
  ) {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`triggeredByUserId` must be a string or null when provided",
    }
  }
  if (parsed.tags !== undefined && !isStringArray(parsed.tags)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`tags` must be an array of strings when provided",
    }
  }
  if (parsed.seedResults !== undefined && !isPlainObject(parsed.seedResults)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`seedResults` must be an object when provided",
    }
  }
  return {
    ok: true,
    body: {
      input: parsed.input,
      workflowId: parsed.workflowId as string | undefined,
      resumeFromStep: parsed.resumeFromStep,
      seedResults: parsed.seedResults as Record<string, unknown> | undefined,
      runId: parsed.runId,
      tags: parsed.tags as string[] | undefined,
      triggeredByUserId: parsed.triggeredByUserId as string | null | undefined,
    },
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function json(status: number, body: unknown): HandlerResponse {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body, null, 2),
  }
}

async function resolveHealthReport(
  check: (() => Promise<HealthReport> | HealthReport) | undefined,
  fallback: HealthReport,
): Promise<HealthReport> {
  if (!check) return fallback
  try {
    return await check()
  } catch (err) {
    return {
      ok: false,
      service: fallback.service,
      checks: {
        ...(fallback.checks ?? {}),
        self: "error",
      },
      details: {
        ...(fallback.details ?? {}),
        error: err instanceof Error ? err.message : String(err),
      },
    }
  }
}

async function resolveMetricsBody(
  collectMetrics: (() => Promise<string> | string) | undefined,
): Promise<string> {
  if (!collectMetrics) {
    return renderMetrics({
      workflowsRegistered: 0,
      schedulesRegistered: 0,
      runsTotal: 0,
      wakeupsTotal: 0,
      runsByStatus: {},
      generatedAtMs: Date.now(),
    })
  }
  try {
    return await collectMetrics()
  } catch (err) {
    return [
      "# HELP voyant_selfhost_metrics_error Metrics collection failure state.",
      "# TYPE voyant_selfhost_metrics_error gauge",
      "voyant_selfhost_metrics_error 1",
      `# metrics_error ${escapeMetricLabelValue(err instanceof Error ? err.message : String(err))}`,
      "",
    ].join("\n")
  }
}

function escapeMetricLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")
}
