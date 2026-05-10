import {
  type RunRecord,
  type RuntimeConcurrencyPolicy,
  WorkflowConcurrencyRejectedError,
} from "@voyantjs/workflows-orchestrator"

import type { DurableObjectStorageLike, TriggerPayload } from "./types.js"
import type { DurableObjectNamespaceLike } from "./worker.js"

export interface ConcurrencyCoordinatorDeps<Id = unknown> {
  storage: DurableObjectStorageLike
  runDO: DurableObjectNamespaceLike<Id>
}

export interface ConcurrencyCoordinator {
  fetch(req: Request): Promise<Response>
}

interface CoordinatorState {
  active: string[]
}

interface ConcurrencyTriggerPayload {
  concurrency: {
    key: string
    limit?: number
    strategy?: RuntimeConcurrencyPolicy["strategy"]
  }
  trigger: TriggerPayload & { runId: string }
}

interface ReleasePayload {
  runId: string
}

interface Waiter {
  runId: string
  resolve(): void
}

const STATE_KEY = "state"

export function createConcurrencyCoordinator<Id>(
  deps: ConcurrencyCoordinatorDeps<Id>,
): ConcurrencyCoordinator {
  const waiters: Waiter[] = []
  let stateLock: Promise<void> = Promise.resolve()

  async function withStateLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = stateLock
    let release!: () => void
    stateLock = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await fn()
    } finally {
      release()
    }
  }

  async function loadState(): Promise<CoordinatorState> {
    return (await deps.storage.get<CoordinatorState>(STATE_KEY)) ?? { active: [] }
  }

  async function saveState(state: CoordinatorState): Promise<void> {
    await deps.storage.put(STATE_KEY, { active: [...state.active] })
  }

  async function acquire(payload: ConcurrencyTriggerPayload): Promise<void> {
    const runId = payload.trigger.runId
    let holdersToCancel: string[] | undefined
    let waitForSlot: Promise<void> | undefined

    await withStateLock(async () => {
      const state = await loadState()
      if (state.active.includes(runId)) return

      const limit = normalizeLimit(payload.concurrency.limit)
      if (state.active.length < limit) {
        state.active.push(runId)
        await saveState(state)
        return
      }

      const strategy = payload.concurrency.strategy ?? "queue"
      if (strategy === "cancel-newest") {
        throw new WorkflowConcurrencyRejectedError(payload.concurrency.key)
      }

      if (strategy === "cancel-in-progress") {
        holdersToCancel = [...state.active]
        state.active = [runId]
        await saveState(state)
        return
      }

      waitForSlot = new Promise<void>((resolve) => {
        waiters.push({ runId, resolve })
      })
    })

    if (holdersToCancel) {
      await Promise.all(
        holdersToCancel.map((holder) =>
          forwardToRunDO(deps.runDO, holder, "/cancel", {
            reason: "cancelled by workflow concurrency policy",
          }).catch(() => undefined),
        ),
      )
    }

    await waitForSlot
  }

  async function release(runId: string): Promise<void> {
    let next: Waiter | undefined
    await withStateLock(async () => {
      const state = await loadState()
      state.active = state.active.filter((holder) => holder !== runId)
      next = waiters.shift()
      if (next) {
        state.active.push(next.runId)
      }
      await saveState(state)
    })
    next?.resolve()
  }

  return {
    async fetch(req) {
      const url = new URL(req.url)

      if (req.method === "POST" && url.pathname === "/trigger") {
        const payload = (await req.json()) as ConcurrencyTriggerPayload
        try {
          await acquire(payload)
        } catch (err) {
          if (err instanceof WorkflowConcurrencyRejectedError) {
            return json(409, {
              error: err.code,
              message: err.message,
              concurrencyKey: err.concurrencyKey,
            })
          }
          throw err
        }

        let resp: Response | undefined
        try {
          resp = await forwardToRunDO(
            deps.runDO,
            payload.trigger.runId,
            "/trigger",
            payload.trigger,
          )
          if (resp.ok) {
            const record = (await resp.clone().json()) as RunRecord
            if (isTerminal(record.status)) {
              await release(record.id)
            }
          } else {
            await release(payload.trigger.runId)
          }
          return resp
        } catch (err) {
          await release(payload.trigger.runId)
          throw err
        }
      }

      if (req.method === "POST" && url.pathname === "/release") {
        const payload = (await req.json()) as ReleasePayload
        await release(payload.runId)
        return json(200, { ok: true })
      }

      if (req.method === "GET" && url.pathname === "/state") {
        return json(200, await loadState())
      }

      return json(404, { error: "route_not_found", path: url.pathname })
    },
  }
}

export async function handleConcurrencyCoordinatorRequest<Id>(
  req: Request,
  deps: ConcurrencyCoordinatorDeps<Id> & { coordinator?: ConcurrencyCoordinator },
): Promise<Response> {
  const coordinator = deps.coordinator ?? createConcurrencyCoordinator(deps)
  return coordinator.fetch(req)
}

async function forwardToRunDO<Id>(
  runDO: DurableObjectNamespaceLike<Id>,
  runId: string,
  path: "/trigger" | "/cancel",
  body: unknown,
): Promise<Response> {
  const id = runDO.idFromName(runId)
  const stub = runDO.get(id)
  return stub.fetch(
    new Request(`https://do-internal${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 1
  if (!Number.isFinite(limit)) return 1
  return Math.max(1, Math.floor(limit))
}

function isTerminal(status: RunRecord["status"]): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "compensated" ||
    status === "compensation_failed"
  )
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}
