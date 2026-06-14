import type { ConcurrencyPolicy } from "@voyant-travel/workflows"

import type { RunRecord } from "./types.js"

export type RuntimeConcurrencyPolicy =
  | ConcurrencyPolicy<unknown>
  | {
      key?: string
      limit?: number
      strategy?: "queue" | "cancel-in-progress" | "cancel-newest" | "round-robin"
    }

export interface ConcurrencyRunHooks {
  onRunRecordCreated(record: RunRecord): void
}

export class WorkflowConcurrencyRejectedError extends Error {
  readonly code = "WORKFLOW_CONCURRENCY_REJECTED"

  constructor(readonly concurrencyKey: string) {
    super(`workflow concurrency limit reached for key "${concurrencyKey}"`)
    this.name = "WorkflowConcurrencyRejectedError"
  }
}

export interface InProcessConcurrencyCoordinator {
  run(
    args: {
      workflowId: string
      input: unknown
      policy?: RuntimeConcurrencyPolicy
      holderId?: string
    },
    operation: (hooks: ConcurrencyRunHooks) => Promise<RunRecord>,
  ): Promise<RunRecord>
  releaseRun(recordOrRunId: RunRecord | string): void
}

interface Group {
  active: Set<string>
  waiters: Waiter[]
}

interface Slot {
  key: string
  holderId: string
}

interface Waiter {
  holderId: string
  resolve(slot: Slot): void
}

interface CreateInProcessConcurrencyCoordinatorOptions {
  cancelRun?: (runId: string, reason: string) => Promise<unknown>
}

const TOKEN_PREFIX = "concurrency-slot:"

export function createInProcessConcurrencyCoordinator(
  opts: CreateInProcessConcurrencyCoordinatorOptions = {},
): InProcessConcurrencyCoordinator {
  const groups = new Map<string, Group>()
  const runKeys = new Map<string, string>()
  let nextToken = 0

  function getGroup(key: string): Group {
    let group = groups.get(key)
    if (!group) {
      group = { active: new Set(), waiters: [] }
      groups.set(key, group)
    }
    return group
  }

  function createToken(): string {
    nextToken += 1
    return `${TOKEN_PREFIX}${nextToken}`
  }

  async function acquire(
    key: string,
    limit: number,
    strategy: NonNullable<RuntimeConcurrencyPolicy["strategy"]>,
    preferredHolderId?: string,
  ): Promise<Slot> {
    const group = getGroup(key)
    if (preferredHolderId && group.active.has(preferredHolderId)) {
      return { key, holderId: preferredHolderId }
    }

    const holderId = preferredHolderId ?? createToken()
    if (group.active.size < limit) {
      group.active.add(holderId)
      return { key, holderId }
    }

    if (strategy === "cancel-newest") {
      throw new WorkflowConcurrencyRejectedError(key)
    }

    if (strategy === "cancel-in-progress") {
      const holders = [...group.active]
      for (const holder of holders) {
        group.active.delete(holder)
        runKeys.delete(holder)
        if (!holder.startsWith(TOKEN_PREFIX)) {
          await opts.cancelRun?.(holder, "cancelled by workflow concurrency policy")
        }
      }
      group.active.add(holderId)
      return { key, holderId }
    }

    return new Promise((resolve) => {
      group.waiters.push({
        holderId,
        resolve(slot) {
          resolve(slot)
        },
      })
    })
  }

  function assignRunId(slot: Slot, record: RunRecord): Slot {
    const group = getGroup(slot.key)
    if (group.active.delete(slot.holderId)) {
      group.active.add(record.id)
    }
    runKeys.set(record.id, slot.key)
    return { key: slot.key, holderId: record.id }
  }

  function releaseSlot(slot: Slot): void {
    const group = groups.get(slot.key)
    if (!group) return
    group.active.delete(slot.holderId)
    runKeys.delete(slot.holderId)
    drain(slot.key, group)
    if (group.active.size === 0 && group.waiters.length === 0) {
      groups.delete(slot.key)
    }
  }

  function drain(key: string, group: Group): void {
    while (group.waiters.length > 0) {
      const waiter = group.waiters.shift()
      if (!waiter) return
      group.active.add(waiter.holderId)
      waiter.resolve({ key, holderId: waiter.holderId })
      if (group.active.size > 0) return
    }
  }

  return {
    async run(args, operation) {
      const policy = args.policy
      if (!policy) {
        return operation({ onRunRecordCreated() {} })
      }

      const key = resolveConcurrencyKey(args.workflowId, args.input, policy)
      const limit = normalizeLimit(policy.limit)
      const strategy = policy.strategy ?? "queue"
      let slot = await acquire(key, limit, strategy, args.holderId)
      let record: RunRecord | undefined

      try {
        record = await operation({
          onRunRecordCreated(created) {
            slot = assignRunId(slot, created)
          },
        })
        if (!runKeys.has(record.id)) {
          slot = assignRunId(slot, record)
        }
        return record
      } finally {
        if (!record || isTerminal(record.status)) {
          releaseSlot(record ? { key: slot.key, holderId: record.id } : slot)
        }
      }
    },

    releaseRun(recordOrRunId) {
      const runId = typeof recordOrRunId === "string" ? recordOrRunId : recordOrRunId.id
      const key = runKeys.get(runId)
      if (!key) return
      releaseSlot({ key, holderId: runId })
    },
  }
}

export function resolveConcurrencyKey(
  workflowId: string,
  input: unknown,
  policy: RuntimeConcurrencyPolicy,
): string {
  const rawKey = typeof policy.key === "function" ? policy.key(input) : policy.key
  return `${workflowId}:${rawKey ?? "default"}`
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
