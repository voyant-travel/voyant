// A pure in-memory RunRecordStore. Useful for tests and local-only
// orchestrator harnesses. The production store is Postgres-backed
// and lives in voyant-cloud.

import type { OrchestratorRunStatus, RunRecord, RunRecordStore } from "./types.js"

export function createInMemoryRunStore(): RunRecordStore {
  const records = new Map<string, RunRecord>()
  return {
    async get(id) {
      const r = records.get(id)
      return r ? clone(r) : undefined
    },
    async save(record) {
      records.set(record.id, clone(record))
      return clone(record)
    },
    async tryInsert(record) {
      // Atomic-by-construction: Map.has + Map.set inside a single
      // microtask. Concurrent `tryInsert(idA)` calls all schedule on the
      // same JS event loop and only the first one observes the slot
      // empty — subsequent callers see the inserted record.
      const existing = records.get(record.id)
      if (existing) return { record: clone(existing), created: false }
      records.set(record.id, clone(record))
      return { record: clone(record), created: true }
    },
    async list(filter = {}) {
      let out = [...records.values()].map(clone)
      if (filter.workflowId) out = out.filter((r) => r.workflowId === filter.workflowId)
      if (filter.status) out = out.filter((r) => r.status === filter.status)
      out.sort((a, b) => b.startedAt - a.startedAt)
      if (filter.limit !== undefined) out = out.slice(0, filter.limit)
      return out
    },
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

/** Keep the unused import happy — guards against accidental type-only drift. */
export type { OrchestratorRunStatus }
