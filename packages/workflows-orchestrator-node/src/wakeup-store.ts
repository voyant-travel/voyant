import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { RunRecord } from "@voyantjs/workflows-orchestrator"
import { findEarliestWakeAt } from "./sleep-alarm-manager.js"

export interface WakeupRecord {
  runId: string
  wakeAt: number
  priority?: number
  leaseOwner?: string
  leaseExpiresAt?: number
  updatedAt: number
}

export interface WakeupStore {
  get: (runId: string) => Promise<WakeupRecord | undefined>
  upsert: (
    record: Omit<WakeupRecord, "updatedAt"> & { updatedAt?: number },
  ) => Promise<WakeupRecord>
  delete: (runId: string) => Promise<boolean>
  list: () => Promise<WakeupRecord[]>
  leaseDue: (args: {
    owner: string
    now?: number
    leaseMs: number
    limit?: number
  }) => Promise<WakeupRecord[]>
  release: (runId: string, owner?: string) => Promise<void>
}

export interface FsWakeupStoreOptions {
  rootDir?: string
  now?: () => number
}

export function createFsWakeupStore(opts: FsWakeupStoreOptions = {}): WakeupStore {
  const rootDir = opts.rootDir ?? resolve(process.cwd(), ".voyant", "orchestrator", "wakeups")
  const now = opts.now ?? (() => Date.now())

  return {
    async get(runId) {
      return (await readWakeupFile(join(rootDir, `${runId}.json`))) ?? undefined
    },

    async upsert(record) {
      const saved: WakeupRecord = {
        ...record,
        updatedAt: record.updatedAt ?? now(),
      }
      await mkdir(rootDir, { recursive: true })
      await writeFile(join(rootDir, `${saved.runId}.json`), JSON.stringify(saved, null, 2))
      return saved
    },

    async delete(runId) {
      try {
        await rm(join(rootDir, `${runId}.json`), { force: false })
        return true
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === "ENOENT") return false
        throw err
      }
    },

    async list() {
      const entries = await safeReaddir(rootDir)
      const wakeups: WakeupRecord[] = []
      for (const entry of entries) {
        const wakeup = await readWakeupFile(join(rootDir, entry))
        if (wakeup) wakeups.push(wakeup)
      }
      wakeups.sort((a, b) => a.wakeAt - b.wakeAt)
      return wakeups
    },

    async leaseDue({ owner, now: at = now(), leaseMs, limit = 25 }) {
      const wakeups = (await this.list()).sort(compareWakeupClaimOrder)
      const leased: WakeupRecord[] = []
      for (const wakeup of wakeups) {
        if (leased.length >= limit) break
        if (wakeup.wakeAt > at) continue
        if (
          wakeup.leaseExpiresAt !== undefined &&
          wakeup.leaseExpiresAt > at &&
          wakeup.leaseOwner !== owner
        ) {
          continue
        }
        const next = await this.upsert({
          ...wakeup,
          leaseOwner: owner,
          leaseExpiresAt: at + leaseMs,
        })
        leased.push(next)
      }
      return leased
    },

    async release(runId, owner) {
      const existing = await this.get(runId)
      if (!existing) return
      if (owner && existing.leaseOwner && existing.leaseOwner !== owner) return
      await this.upsert({
        runId: existing.runId,
        wakeAt: existing.wakeAt,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
      })
    },
  }
}

export async function syncWakeupFromRecord(store: WakeupStore, record: RunRecord): Promise<void> {
  const wakeAt = record.status === "waiting" ? findEarliestWakeAt(record) : undefined
  if (wakeAt === undefined) {
    await store.delete(record.id)
    return
  }
  await store.upsert({
    runId: record.id,
    wakeAt,
    priority: record.priority,
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
  })
}

function compareWakeupClaimOrder(a: WakeupRecord, b: WakeupRecord): number {
  const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0)
  if (priorityDelta !== 0) return priorityDelta
  return a.wakeAt - b.wakeAt
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir)
    const result: string[] = []
    for (const entry of entries) {
      try {
        const entryStat = await stat(join(dir, entry))
        if (entryStat.isFile() && entry.endsWith(".json")) result.push(entry)
      } catch {
        // Ignore per-entry read errors and continue scanning.
      }
    }
    return result
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ENOENT") return []
    throw err
  }
}

async function readWakeupFile(path: string): Promise<WakeupRecord | null> {
  try {
    const text = await readFile(path, "utf8")
    return JSON.parse(text) as WakeupRecord
  } catch {
    return null
  }
}
