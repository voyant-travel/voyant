// KV-backed persisted state for workflow schedule dispatches.
//
// The manifest store answers "what schedules are registered?". This store
// answers "what has the scheduler actually attempted recently?", keyed by
// the stable schedule id emitted by manifestScheduleSources / schedule-handler.

import type { KvNamespaceLike } from "./manifest-kv-store.js"

export interface ScheduleStateRecord {
  scheduleId: string
  workflowId?: string
  environment?: string
  versionId?: string
  lastFireAt?: number | null
  lastRunId?: string | null
  lastError?: string | null
  lockedUntil?: number | null
  lastSuccessfulRunAt?: number | null
  updatedAt?: number | null
}

export interface CfScheduleStateStore {
  getStates(
    environment: string,
    scheduleIds: readonly string[],
  ): Promise<Map<string, ScheduleStateRecord>>
  putState(environment: string, state: ScheduleStateRecord): Promise<void>
}

interface RawScheduleStateRecord {
  scheduleId: string
  workflowId?: unknown
  environment?: unknown
  versionId?: unknown
  lastFireAt?: unknown
  lastRunId?: unknown
  lastError?: unknown
  lockedUntil?: unknown
  lastSuccessfulRunAt?: unknown
  updatedAt?: unknown
}

export interface CreateKvScheduleStateStoreOptions {
  kv: KvNamespaceLike
}

export function createKvScheduleStateStore(
  opts: CreateKvScheduleStateStoreOptions,
): CfScheduleStateStore {
  const kv = opts.kv

  return {
    async getStates(environment, scheduleIds) {
      const out = new Map<string, ScheduleStateRecord>()
      await Promise.all(
        scheduleIds.map(async (scheduleId) => {
          const raw = await kv.get(scheduleStateKey(environment, scheduleId))
          if (!raw) return
          const parsed = parseScheduleState(raw)
          if (!parsed || parsed.scheduleId !== scheduleId) return
          out.set(scheduleId, parsed)
        }),
      )
      return out
    },

    async putState(environment, state) {
      await kv.put(
        scheduleStateKey(environment, state.scheduleId),
        JSON.stringify(normalizeScheduleState(environment, state)),
      )
    },
  }
}

function scheduleStateKey(environment: string, scheduleId: string): string {
  return `schedule-state:${environment}:${encodeURIComponent(scheduleId)}`
}

function parseScheduleState(raw: string): ScheduleStateRecord | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || typeof parsed.scheduleId !== "string") return null
    const state: RawScheduleStateRecord = {
      scheduleId: parsed.scheduleId,
      workflowId: typeof parsed.workflowId === "string" ? parsed.workflowId : undefined,
      versionId: typeof parsed.versionId === "string" ? parsed.versionId : undefined,
      lastFireAt: parsed.lastFireAt,
      lastRunId: parsed.lastRunId,
      lastError: parsed.lastError,
      lockedUntil: parsed.lockedUntil,
      lastSuccessfulRunAt: parsed.lastSuccessfulRunAt,
      updatedAt: parsed.updatedAt,
    }
    return normalizeScheduleState(
      typeof parsed.environment === "string" ? parsed.environment : undefined,
      state,
    )
  } catch {
    return null
  }
}

function normalizeScheduleState(
  environment: string | undefined,
  state: RawScheduleStateRecord,
): ScheduleStateRecord {
  return {
    scheduleId: state.scheduleId,
    ...(typeof state.workflowId === "string" ? { workflowId: state.workflowId } : {}),
    ...(environment !== undefined ? { environment } : {}),
    ...(typeof state.versionId === "string" ? { versionId: state.versionId } : {}),
    lastFireAt: nullableFiniteNumber(state.lastFireAt),
    lastRunId: nullableString(state.lastRunId),
    lastError: nullableString(state.lastError),
    lockedUntil: nullableFiniteNumber(state.lockedUntil),
    lastSuccessfulRunAt: nullableFiniteNumber(state.lastSuccessfulRunAt),
    updatedAt: nullableFiniteNumber(state.updatedAt),
  }
}

function nullableFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
