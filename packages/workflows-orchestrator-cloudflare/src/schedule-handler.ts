// HTTP handler for `/api/schedules/:env`. Reads the registered manifest
// for the requested environment, projects each workflow's schedule blocks
// into a flat list, and computes `nextRun` per entry via the same cron /
// every / at logic the live scheduler uses.
//
// Aggregate "lastRun" is intentionally out of scope here — runs in the
// Cloudflare orchestrator live in per-run Durable Objects, indexed by
// runId, with no list-by-workflow path. The UI is expected to fetch
// last-run state separately from the template-side `workflow-runs`
// admin API (`/v1/admin/workflow-runs?workflowName=…&limit=1`).

import type { ManifestSchedule, WorkflowManifest } from "@voyantjs/workflows/protocol"
import { computeNextFire } from "@voyantjs/workflows-orchestrator"

import type { CfManifestStore } from "./manifest-kv-store.js"

const ALLOWED_ENVS = new Set(["production", "preview", "development"])

export interface ScheduleHandlerDeps {
  manifestStore: CfManifestStore
  /**
   * Process-wide schedules toggle. The Voyant Cloud orchestrator gates
   * scheduler ticks behind `VOYANT_WORKFLOWS_ENABLE_SCHEDULES`; the UI
   * surfaces that flag so operators can tell at a glance whether any
   * schedule will fire even if `enabled: true` on the registration.
   *
   * When omitted, the response omits `schedulesEnabledByEnv` so older
   * UIs can ignore the field.
   */
  schedulesEnabledByEnv?: boolean
  now?: () => number
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
}

export interface ScheduleSummary {
  workflowId: string
  scheduleId: string
  schedule: ManifestSchedule
  /** Epoch millis of the next computed fire, or null when undecidable. */
  nextRunAt: number | null
  /**
   * False when the registration explicitly sets `enabled: false`, or
   * when the registration's `environments` list excludes the requested
   * environment.
   */
  enabled: boolean
  disabledReason?: "registration_disabled" | "env_filtered"
}

export interface ScheduleListResponse {
  environment: string
  versionId: string
  schedulesEnabledByEnv?: boolean
  data: ScheduleSummary[]
}

/**
 * Handle `GET /api/schedules/:env`. Returns the projected schedule list
 * for the current manifest, or 404 when no manifest is registered.
 */
export async function handleGetSchedules(
  environment: string,
  deps: ScheduleHandlerDeps,
): Promise<Response> {
  if (!ALLOWED_ENVS.has(environment)) {
    return json(400, {
      error: "invalid_environment",
      message: `environment must be one of ${[...ALLOWED_ENVS].join(", ")}`,
    })
  }

  const envelope = await deps.manifestStore.getCurrent(environment)
  if (!envelope) {
    return json(404, { error: "not_found", environment })
  }

  const now = deps.now ? deps.now() : Date.now()
  const manifest = envelope.manifest as unknown as WorkflowManifest
  const data: ScheduleSummary[] = []

  for (const workflow of manifest.workflows ?? []) {
    const schedules = Array.isArray(workflow.schedules) ? workflow.schedules : []
    schedules.forEach((schedule, index) => {
      const scheduleId = `${envelope.versionId}:${workflow.id}:${schedule.name ?? index}`
      const registrationDisabled = schedule.enabled === false
      const envFiltered = Array.isArray(schedule.environments)
        ? !schedule.environments.includes(environment as never)
        : false

      let nextRunAt: number | null = null
      if (!registrationDisabled && !envFiltered) {
        try {
          const fire = computeNextFire(schedule, now)
          nextRunAt = Number.isFinite(fire) ? fire : null
        } catch (err) {
          deps.logger?.("warn", "schedules: cannot compute next fire", {
            workflowId: workflow.id,
            scheduleId,
            error: err instanceof Error ? err.message : String(err),
          })
          nextRunAt = null
        }
      }

      const enabled = !registrationDisabled && !envFiltered
      const disabledReason = registrationDisabled
        ? "registration_disabled"
        : envFiltered
          ? "env_filtered"
          : undefined

      data.push({
        workflowId: workflow.id,
        scheduleId,
        schedule,
        nextRunAt,
        enabled,
        ...(disabledReason ? { disabledReason } : {}),
      })
    })
  }

  const response: ScheduleListResponse = {
    environment,
    versionId: envelope.versionId,
    data,
    ...(deps.schedulesEnabledByEnv !== undefined
      ? { schedulesEnabledByEnv: deps.schedulesEnabledByEnv }
      : {}),
  }
  return json(200, response)
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, x-voyant-protocol",
    },
  })
}
