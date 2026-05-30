// HTTP handler for `/api/schedules/:env`. Reads the registered manifest
// for the requested environment, projects each workflow's schedule blocks
// into a flat list, computes `nextRun` per entry via the same cron / every /
// at logic the live scheduler uses, and optionally merges persisted scheduler
// dispatch state when a control plane provides it.

import type { ManifestSchedule } from "@voyantjs/workflows/protocol"
import { computeNextFire } from "@voyantjs/workflows-orchestrator"

import type { CfManifestStore } from "./manifest-kv-store.js"
import type { CfScheduleStateStore, ScheduleStateRecord } from "./schedule-state-store.js"

const ALLOWED_ENVS = ["production", "preview", "development"] as const

type AllowedEnvironment = (typeof ALLOWED_ENVS)[number]

interface ManifestWorkflowScheduleEntry {
  id: string
  schedules: ManifestSchedule[]
}

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
  /**
   * Optional state store populated by the runtime scheduler/control plane.
   * When present, each schedule row includes last-fire/run/error fields.
   */
  scheduleStateStore?: CfScheduleStateStore
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
  /** Epoch millis of the last scheduler dispatch attempt, when known. */
  lastFireAt?: number | null
  /** Run id produced by the last scheduler dispatch attempt, when known. */
  lastRunId?: string | null
  /** Last scheduler dispatch/lock error, when known. */
  lastError?: string | null
  /** Epoch millis until which this schedule is locked, when known. */
  lockedUntil?: number | null
  /** Epoch millis of the last successful scheduled run, when known. */
  lastSuccessfulRunAt?: number | null
  /** Epoch millis when the persisted scheduler state was last updated. */
  stateUpdatedAt?: number | null
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
  if (!isAllowedEnvironment(environment)) {
    return json(400, {
      error: "invalid_environment",
      message: `environment must be one of ${ALLOWED_ENVS.join(", ")}`,
    })
  }

  const envelope = await deps.manifestStore.getCurrent(environment)
  if (!envelope) {
    return json(404, { error: "not_found", environment })
  }

  const now = deps.now ? deps.now() : Date.now()
  const data: ScheduleSummary[] = []

  for (const workflow of readManifestWorkflows(envelope.manifest)) {
    workflow.schedules.forEach((schedule, index) => {
      const scheduleId = `${envelope.versionId}:${workflow.id}:${schedule.name ?? index}`
      const registrationDisabled = schedule.enabled === false
      const envFiltered = Array.isArray(schedule.environments)
        ? !schedule.environments.includes(environment)
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

  if (deps.scheduleStateStore) {
    const scheduleIds = data.map((row) => row.scheduleId)
    let states = new Map<string, ScheduleStateRecord>()
    try {
      states = await deps.scheduleStateStore.getStates(environment, scheduleIds)
    } catch (err) {
      deps.logger?.("warn", "schedules: cannot load scheduler state", {
        environment,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    for (const row of data) {
      attachState(row, states.get(row.scheduleId))
    }
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

function isAllowedEnvironment(value: string): value is AllowedEnvironment {
  return ALLOWED_ENVS.includes(value as AllowedEnvironment)
}

function readManifestWorkflows(manifest: Record<string, unknown>): ManifestWorkflowScheduleEntry[] {
  const workflows = manifest.workflows
  if (!Array.isArray(workflows)) return []
  return workflows.flatMap((workflow): ManifestWorkflowScheduleEntry[] => {
    if (!isRecord(workflow) || typeof workflow.id !== "string") return []
    const schedules = Array.isArray(workflow.schedules)
      ? workflow.schedules.filter(isManifestSchedule)
      : []
    return [{ id: workflow.id, schedules }]
  })
}

function isManifestSchedule(value: unknown): value is ManifestSchedule {
  return isRecord(value)
}

function attachState(row: ScheduleSummary, state: ScheduleStateRecord | undefined): void {
  row.lastFireAt = state?.lastFireAt ?? null
  row.lastRunId = state?.lastRunId ?? null
  row.lastError = state?.lastError ?? null
  row.lockedUntil = state?.lockedUntil ?? null
  row.lastSuccessfulRunAt = state?.lastSuccessfulRunAt ?? null
  row.stateUpdatedAt = state?.updatedAt ?? null
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
