// Internal runtime signal errors. Distinct from user-facing `@voyantjs/workflows/errors`:
// these are thrown inside the executor to unwind the workflow body on
// waitpoint yield or run cancellation. They must not be caught by user
// code (the executor re-throws if it observes one being swallowed).

const WAITPOINT_PENDING = Symbol.for("voyant.workflows.waitpointPending")
const RUN_CANCELLED = Symbol.for("voyant.workflows.runCancelled")
const COMPENSATE_REQUESTED = Symbol.for("voyant.workflows.compensateRequested")

export class WaitpointPendingSignal extends Error {
  readonly [WAITPOINT_PENDING] = true as const
  readonly waitpointId: string
  constructor(waitpointId: string) {
    super(`waitpoint pending: ${waitpointId}`)
    this.name = "WaitpointPendingSignal"
    this.waitpointId = waitpointId
  }
}

export class RunCancelledSignal extends Error {
  readonly [RUN_CANCELLED] = true as const
  constructor(reason?: string) {
    super(reason ?? "run cancelled")
    this.name = "RunCancelledSignal"
  }
}

export function isWaitpointPending(err: unknown): err is WaitpointPendingSignal {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { [WAITPOINT_PENDING]?: true })[WAITPOINT_PENDING] === true
  )
}

export function isRunCancelled(err: unknown): err is RunCancelledSignal {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { [RUN_CANCELLED]?: true })[RUN_CANCELLED] === true
  )
}

export class CompensateRequestedSignal extends Error {
  readonly [COMPENSATE_REQUESTED] = true as const
  constructor() {
    super("compensate requested")
    this.name = "CompensateRequestedSignal"
  }
}

export function isCompensateRequested(err: unknown): err is CompensateRequestedSignal {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { [COMPENSATE_REQUESTED]?: true })[COMPENSATE_REQUESTED] === true
  )
}
