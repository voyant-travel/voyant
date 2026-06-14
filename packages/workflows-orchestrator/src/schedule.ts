import type { Duration, EnvironmentName, ScheduleDeclaration } from "@voyant-travel/workflows"
import type { ManifestSchedule, WorkflowManifest } from "@voyant-travel/workflows/protocol"

export type SchedulableDeclaration = ScheduleDeclaration | ManifestSchedule

export interface ScheduleSource {
  id?: string
  workflowId: string
  decl: SchedulableDeclaration
}

export interface SchedulerDeps {
  sources: readonly ScheduleSource[]
  onFire: (args: {
    workflowId: string
    input: unknown
    scheduleId: string
    scheduleName?: string
    fireAt: number
  }) => Promise<void>
  now?: () => number
  environment?: EnvironmentName
  tickMs?: number
  setInterval?: typeof setInterval
  clearInterval?: typeof clearInterval
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
}

export interface SchedulerHandle {
  start: () => void
  stop: () => void
  tick: () => Promise<void>
  nextFirings: () => {
    workflowId: string
    scheduleId: string
    name?: string
    nextAt: number
    done: boolean
  }[]
  sourceCount: () => number
}

function unrefTimer(timer: unknown): void {
  if (
    typeof timer === "object" &&
    timer !== null &&
    "unref" in timer &&
    typeof timer.unref === "function"
  ) {
    timer.unref()
  }
}

interface SourceState {
  source: ScheduleSource
  scheduleId: string
  nextAt: number
  done: boolean
  inFlight: boolean
  queued: QueuedFire[]
}

interface QueuedFire {
  fireAt: number
}

export function manifestScheduleSources(manifest: WorkflowManifest): ScheduleSource[] {
  const sources: ScheduleSource[] = []
  for (const workflow of manifest.workflows) {
    workflow.schedules.forEach((decl, index) => {
      sources.push({
        id: `${manifest.versionId}:${workflow.id}:${decl.name ?? index}`,
        workflowId: workflow.id,
        decl,
      })
    })
  }
  return sources
}

export function createScheduler(deps: SchedulerDeps): SchedulerHandle {
  const now = deps.now ?? (() => Date.now())
  const tickMs = deps.tickMs ?? 1_000
  const setInt = deps.setInterval ?? setInterval
  const clearInt = deps.clearInterval ?? clearInterval
  const env = deps.environment ?? "development"
  const log = deps.logger ?? (() => {})

  const states: SourceState[] = []
  for (const [index, source] of deps.sources.entries()) {
    if (source.decl.enabled === false) continue
    if (source.decl.environments && !source.decl.environments.includes(env)) continue
    let firstAt: number
    try {
      firstAt = computeNextFire(source.decl, now())
    } catch (err) {
      log("warn", `scheduler: skipping source for workflow "${source.workflowId}": ${String(err)}`)
      continue
    }
    states.push({
      source,
      scheduleId: source.id ?? `${source.workflowId}:${source.decl.name ?? index}`,
      nextAt: firstAt,
      done: false,
      inFlight: false,
      queued: [],
    })
  }

  let timer: ReturnType<typeof setInterval> | undefined

  const advanceAfterFire = (state: SourceState, firedAt: number): void => {
    if ("at" in state.source.decl) {
      state.done = true
      return
    }
    try {
      state.nextAt = computeNextFire(state.source.decl, firedAt)
    } catch (err) {
      log(
        "error",
        `scheduler: cannot compute next fire for "${state.source.workflowId}": ${String(err)}`,
      )
      state.done = true
    }
  }

  const fire = async (state: SourceState, fireAt: number): Promise<void> => {
    try {
      const input = await resolveInput(state.source.decl.input)
      await deps.onFire({
        workflowId: state.source.workflowId,
        input,
        scheduleId: state.scheduleId,
        scheduleName: state.source.decl.name,
        fireAt,
      })
    } catch (err) {
      log("error", `scheduler: onFire threw for "${state.source.workflowId}": ${String(err)}`)
    } finally {
      const next = state.queued.shift()
      if (next) {
        void fire(state, next.fireAt)
      } else {
        state.inFlight = false
      }
    }
  }

  const doTick = async (): Promise<void> => {
    const t = now()
    const ready = states.filter((state) => !state.done && state.nextAt <= t)
    for (const state of ready) {
      const overlap = state.source.decl.overlap ?? "skip"
      if (state.inFlight && overlap === "skip") continue
      const fireAt = state.nextAt
      if (state.inFlight && overlap === "queue") {
        state.queued.push({ fireAt })
        advanceAfterFire(state, t)
        continue
      }
      state.inFlight = true
      const firePromise = fire(state, fireAt)
      advanceAfterFire(state, t)
      if (overlap !== "allow") await firePromise
    }
  }

  return {
    start() {
      if (timer) return
      timer = setInt(() => {
        doTick().catch(() => {})
      }, tickMs)
      unrefTimer(timer)
    },
    stop() {
      if (!timer) return
      clearInt(timer)
      timer = undefined
    },
    tick: doTick,
    nextFirings() {
      return states.map((state) => ({
        workflowId: state.source.workflowId,
        scheduleId: state.scheduleId,
        name: state.source.decl.name,
        nextAt: state.nextAt,
        done: state.done,
      }))
    },
    sourceCount() {
      return states.length
    },
  }
}

export function computeNextFire(decl: SchedulableDeclaration, fromMs: number): number {
  if ("cron" in decl && decl.cron !== undefined) return nextCronFire(parseCron(decl.cron), fromMs)
  if ("every" in decl && decl.every !== undefined) return fromMs + toMs(decl.every)
  if ("at" in decl && decl.at !== undefined) {
    const at = typeof decl.at === "string" ? Date.parse(decl.at) : decl.at.getTime()
    if (!Number.isFinite(at)) throw new Error(`invalid "at" value: ${String(decl.at)}`)
    return at < fromMs ? Number.POSITIVE_INFINITY : at
  }
  throw new Error(`schedule declaration missing one of cron/every/at`)
}

export interface CronSpec {
  minute: number[]
  hour: number[]
  day: number[]
  month: number[]
  dow: number[]
}

export function parseCron(expr: string): CronSpec {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`invalid cron "${expr}" - expected 5 fields (minute hour day month dow)`)
  }
  return {
    minute: parseField(parts[0]!, 0, 59, "minute"),
    hour: parseField(parts[1]!, 0, 23, "hour"),
    day: parseField(parts[2]!, 1, 31, "day"),
    month: parseField(parts[3]!, 1, 12, "month"),
    dow: parseField(parts[4]!, 0, 6, "dow"),
  }
}

function parseField(f: string, min: number, max: number, label: string): number[] {
  const out = new Set<number>()
  for (const part of f.split(",")) {
    const stepMatch = /^(.+)\/(\d+)$/.exec(part)
    const body = stepMatch ? stepMatch[1]! : part
    const step = stepMatch ? Number(stepMatch[2]) : 1
    if (!(step >= 1)) throw new Error(`cron ${label} step must be >=1 in "${f}"`)
    let lo: number
    let hi: number
    if (body === "*") {
      lo = min
      hi = max
    } else if (body.includes("-")) {
      const [a, b] = body.split("-")
      lo = Number(a)
      hi = Number(b)
    } else {
      lo = Number(body)
      hi = lo
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < min || hi > max || lo > hi) {
      throw new Error(`cron ${label} out of range [${min}..${max}] in "${f}"`)
    }
    for (let i = lo; i <= hi; i += step) out.add(i)
  }
  return [...out].sort((a, b) => a - b)
}

export function nextCronFire(spec: CronSpec, fromMs: number): number {
  const date = new Date(fromMs)
  date.setUTCSeconds(0, 0)
  date.setUTCMinutes(date.getUTCMinutes() + 1)

  const maxIterations = 60 * 24 * 366 * 5
  for (let i = 0; i < maxIterations; i++) {
    if (
      spec.minute.includes(date.getUTCMinutes()) &&
      spec.hour.includes(date.getUTCHours()) &&
      spec.day.includes(date.getUTCDate()) &&
      spec.month.includes(date.getUTCMonth() + 1) &&
      spec.dow.includes(date.getUTCDay())
    ) {
      return date.getTime()
    }
    date.setUTCMinutes(date.getUTCMinutes() + 1)
  }
  throw new Error("cron search exceeded 5 years without finding a match")
}

export function toMs(duration: Duration | string | number): number {
  if (typeof duration === "number") return duration
  const m = /^(\d+)(ms|s|m|h|d|w)$/.exec(duration)
  if (!m) throw new Error(`invalid duration "${duration}"`)
  const n = Number(m[1])
  switch (m[2]) {
    case "ms":
      return n
    case "s":
      return n * 1_000
    case "m":
      return n * 60_000
    case "h":
      return n * 3_600_000
    case "d":
      return n * 86_400_000
    case "w":
      return n * 604_800_000
    default:
      throw new Error(`invalid duration "${duration}"`)
  }
}

async function resolveInput(
  input: unknown | (() => unknown | Promise<unknown>) | undefined,
): Promise<unknown> {
  if (typeof input === "function") {
    return await (input as () => unknown | Promise<unknown>)()
  }
  return input
}
