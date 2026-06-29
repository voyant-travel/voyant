// Process-local map of runId → AbortController. The orchestrator
// registers a controller when it starts driving a run and aborts it
// when `cancel(runId)` lands mid-flight. Step bodies that honor
// `ctx.signal` (fetches, delays, custom logic) observe the abort and
// can clean up deterministically.
//
// Single-process scope by design: each Durable Object / Node serve
// has its own registry. Cross-process cancellation rides through
// the run store (see `beforeInvocation` in orchestrator.ts) and
// catches up at the next invocation boundary.

const controllers = new Map<string, AbortController>()

export function registerRunAbort(runId: string): AbortController {
  // If a controller already exists, reuse it (e.g., resume after
  // park — the same run id).
  let ctrl = controllers.get(runId)
  if (!ctrl) {
    ctrl = new AbortController()
    controllers.set(runId, ctrl)
  }
  return ctrl
}

export function signalRunAbort(runId: string, reason?: string): boolean {
  const ctrl = controllers.get(runId)
  if (!ctrl) return false
  // `AbortController.abort(reason)` is standard across modern runtimes;
  // the reason surfaces to observers via `signal.reason`.
  ctrl.abort(reason ?? "cancelled")
  return true
}

export function unregisterRunAbort(runId: string): void {
  controllers.delete(runId)
}
