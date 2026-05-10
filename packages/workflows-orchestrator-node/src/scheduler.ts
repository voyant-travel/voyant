import type { EnvironmentName, ScheduleDeclaration } from "@voyantjs/workflows"
import { computeNextFire } from "@voyantjs/workflows-orchestrator"

export { computeNextFire, nextCronFire, parseCron, toMs } from "@voyantjs/workflows-orchestrator"

export interface ScheduleSource {
  workflowId: string
  decl: ScheduleDeclaration
}

export interface SchedulerDeps {
  sources: readonly ScheduleSource[]
  onFire: (args: { workflowId: string; input: unknown; scheduleName?: string }) => Promise<void>
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
  nextFirings: () => { workflowId: string; name?: string; nextAt: number; done: boolean }[]
  sourceCount: () => number
}

interface SourceState {
  source: ScheduleSource
  nextAt: number
  done: boolean
  inFlight: boolean
}

export function createScheduler(deps: SchedulerDeps): SchedulerHandle {
  const now = deps.now ?? (() => Date.now())
  const tickMs = deps.tickMs ?? 1_000
  const setInt = deps.setInterval ?? setInterval
  const clearInt = deps.clearInterval ?? clearInterval
  const env = deps.environment ?? "development"
  const log = deps.logger ?? (() => {})

  const states: SourceState[] = []
  for (const source of deps.sources) {
    if (source.decl.enabled === false) continue
    if (source.decl.environments && !source.decl.environments.includes(env)) continue
    let firstAt: number
    try {
      firstAt = computeNextFire(source.decl, now())
    } catch (err) {
      log("warn", `scheduler: skipping source for workflow "${source.workflowId}": ${String(err)}`)
      continue
    }
    states.push({ source, nextAt: firstAt, done: false, inFlight: false })
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

  const doTick = async (): Promise<void> => {
    const t = now()
    const ready = states.filter((state) => !state.done && state.nextAt <= t)
    for (const state of ready) {
      const overlap = state.source.decl.overlap ?? "skip"
      if (state.inFlight && overlap === "skip") continue
      let input: unknown
      try {
        input = await resolveInput(state.source.decl.input)
      } catch (err) {
        log(
          "error",
          `scheduler: failed to resolve input for "${state.source.workflowId}": ${String(err)}`,
        )
        advanceAfterFire(state, t)
        continue
      }
      state.inFlight = true
      const firePromise = (async () => {
        try {
          await deps.onFire({
            workflowId: state.source.workflowId,
            input,
            scheduleName: state.source.decl.name,
          })
        } catch (err) {
          log("error", `scheduler: onFire threw for "${state.source.workflowId}": ${String(err)}`)
        } finally {
          state.inFlight = false
        }
      })()
      advanceAfterFire(state, t)
      if (overlap === "skip") await firePromise
    }
  }

  return {
    start() {
      if (timer) return
      timer = setInt(() => {
        doTick().catch(() => {})
      }, tickMs)
      ;(timer as unknown as { unref?: () => void }).unref?.()
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

async function resolveInput(
  input: unknown | (() => unknown | Promise<unknown>) | undefined,
): Promise<unknown> {
  if (typeof input === "function") {
    return await (input as () => unknown | Promise<unknown>)()
  }
  return input
}
