import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

export interface StoredRun {
  id: string
  workflowId: string
  status: string
  startedAt: number
  completedAt?: number
  durationMs?: number
  tags?: string[]
  result: Record<string, unknown>
  input: unknown
  entryFile?: string
  replayOf?: string
}

export interface ListFilter {
  workflowId?: string
  status?: string
  limit?: number
}

export interface SnapshotRunStore {
  save(args: {
    workflowId: string
    input: unknown
    result: Record<string, unknown>
    entryFile?: string
    replayOf?: string
  }): Promise<StoredRun>
  list(filter?: ListFilter): Promise<StoredRun[]>
  get(runId: string): Promise<StoredRun | undefined>
  update?(run: StoredRun): Promise<StoredRun>
  delete?(runId: string): Promise<boolean>
}

export interface FsSnapshotRunStoreOptions {
  rootDir?: string
  now?: () => number
  random?: () => number
}

export function createFsSnapshotRunStore(opts: FsSnapshotRunStoreOptions = {}): SnapshotRunStore {
  const rootDir = opts.rootDir ?? resolve(process.cwd(), ".voyant", "runs")
  const now = opts.now ?? (() => Date.now())
  const random = opts.random ?? Math.random

  return {
    async save({ workflowId, input, result, entryFile, replayOf }) {
      const startedAt = toNumber(result.startedAt) ?? now()
      const completedAt = toNumber(result.completedAt)
      const stored: StoredRun = {
        id: generateRunId(now, random),
        workflowId,
        status: typeof result.status === "string" ? result.status : "unknown",
        startedAt,
        completedAt,
        durationMs: completedAt !== undefined ? completedAt - startedAt : undefined,
        tags: Array.isArray(result.tags) ? (result.tags as string[]) : undefined,
        result,
        input,
        entryFile,
        replayOf,
      }

      await mkdir(join(rootDir, stored.id), { recursive: true })
      await writeFile(join(rootDir, stored.id, "run.json"), JSON.stringify(stored, null, 2))
      return stored
    },

    async list(filter = {}) {
      const entries = await safeReaddir(rootDir)
      const runs: StoredRun[] = []
      for (const entry of entries) {
        const run = await readRunFile(join(rootDir, entry, "run.json"))
        if (!run) continue
        if (filter.workflowId && run.workflowId !== filter.workflowId) continue
        if (filter.status && run.status !== filter.status) continue
        runs.push(run)
      }
      runs.sort((a, b) => b.startedAt - a.startedAt)
      if (filter.limit !== undefined) return runs.slice(0, filter.limit)
      return runs
    },

    async get(runId) {
      return (await readRunFile(join(rootDir, runId, "run.json"))) ?? undefined
    },

    async update(run) {
      await mkdir(join(rootDir, run.id), { recursive: true })
      await writeFile(join(rootDir, run.id, "run.json"), JSON.stringify(run, null, 2))
      return run
    },

    async delete(runId) {
      try {
        await rm(join(rootDir, runId), { recursive: true, force: false })
        return true
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === "ENOENT") return false
        throw err
      }
    },
  }
}

function toNumber(x: unknown): number | undefined {
  return typeof x === "number" ? x : undefined
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir)
    const result: string[] = []
    for (const entry of entries) {
      try {
        const entryStat = await stat(join(dir, entry))
        if (entryStat.isDirectory()) result.push(entry)
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

async function readRunFile(path: string): Promise<StoredRun | null> {
  try {
    const text = await readFile(path, "utf8")
    return JSON.parse(text) as StoredRun
  } catch {
    return null
  }
}

function generateRunId(now: () => number, random: () => number): string {
  const ts = now().toString(36)
  const rand = Math.floor(random() * 1_000_000)
    .toString(36)
    .padStart(4, "0")
  return `run_${ts}_${rand}`
}
