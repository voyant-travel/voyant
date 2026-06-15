import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { OrchestratorRunStatus, RunRecord, RunRecordStore } from "./core.js"

export interface FsRunRecordStoreOptions {
  /** Root directory (`.voyant/workflows-orchestrator/runs/` under cwd by default). */
  rootDir?: string
}

export function createFsRunRecordStore(opts: FsRunRecordStoreOptions = {}): RunRecordStore {
  const rootDir = opts.rootDir ?? resolve(process.cwd(), ".voyant", "orchestrator", "runs")

  return {
    async get(id) {
      return (await readRunFile(join(rootDir, id, "run-record.json"))) ?? undefined
    },

    async save(record) {
      await mkdir(join(rootDir, record.id), { recursive: true })
      await writeFile(join(rootDir, record.id, "run-record.json"), JSON.stringify(record, null, 2))
      return record
    },

    async tryInsert(record) {
      // Single-process FS store: atomicity comes from `mkdir` without
      // `recursive: true` — succeeds exactly once per path, EEXIST
      // otherwise. The orchestrator only enters this branch for
      // idempotency-derived runIds, so the directory's prior existence
      // means another caller already created the run.
      try {
        await mkdir(rootDir, { recursive: true })
        await mkdir(join(rootDir, record.id))
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code !== "EEXIST") throw err
        const existing = await readRunFile(join(rootDir, record.id, "run-record.json"))
        if (existing) return { record: existing, created: false }
        // Dir exists but no record file — partial-write race window;
        // fall through and write our record.
      }
      await writeFile(join(rootDir, record.id, "run-record.json"), JSON.stringify(record, null, 2))
      return { record, created: true }
    },

    async list(filter = {}) {
      const entries = await safeReaddir(rootDir)
      const runs: RunRecord[] = []
      for (const entry of entries) {
        const run = await readRunFile(join(rootDir, entry, "run-record.json"))
        if (!run) continue
        if (filter.workflowId && run.workflowId !== filter.workflowId) continue
        if (filter.status && run.status !== filter.status) continue
        runs.push(run)
      }
      runs.sort((a, b) => b.startedAt - a.startedAt)
      if (filter.limit !== undefined) return runs.slice(0, filter.limit)
      return runs
    },
  }
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
        // Ignore per-entry read errors and continue scanning the store.
      }
    }
    return result
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ENOENT") return []
    throw err
  }
}

async function readRunFile(path: string): Promise<RunRecord | null> {
  try {
    const text = await readFile(path, "utf8")
    return JSON.parse(text) as RunRecord
  } catch {
    return null
  }
}

export function filterRunRecords(
  runs: readonly RunRecord[],
  filter: {
    workflowId?: string
    status?: OrchestratorRunStatus
    limit?: number
  } = {},
): RunRecord[] {
  const filtered = runs.filter((run) => {
    if (filter.workflowId && run.workflowId !== filter.workflowId) return false
    if (filter.status && run.status !== filter.status) return false
    return true
  })
  filtered.sort((a, b) => b.startedAt - a.startedAt)
  if (filter.limit !== undefined) return filtered.slice(0, filter.limit)
  return filtered
}
