// A RunRecordStore backed by `DurableObjectStorage`. In production
// this is the DO's transactional KV; in tests, any
// DurableObjectStorageLike (e.g. in-memory Map wrapper) works.
//
// Layout: one run record per DO. Stored under the fixed key
// `record`. The adapter assumes one DO per runId, so "list" scans a
// single key. If a caller wants multi-run listing they should go
// through the global run index (lives in voyant-cloud's Postgres,
// not here).

import type { RunRecord, RunRecordStore } from "@voyantjs/workflows-orchestrator"
import type { DurableObjectStorageLike } from "./types.js"

const RECORD_KEY = "record"

export function createDurableObjectRunStore(storage: DurableObjectStorageLike): RunRecordStore {
  return {
    async get(id) {
      const r = await storage.get<RunRecord>(RECORD_KEY)
      if (!r || r.id !== id) return undefined
      return r
    },

    async save(record) {
      await storage.put<RunRecord>(RECORD_KEY, record)
      return record
    },

    async tryInsert(record) {
      // DO storage is single-threaded per DO instance: concurrent fetches
      // to `idFromName(runId)` are serialized inside the DO's request
      // queue, so get-then-put is naturally atomic. This is just the
      // contract-shape implementation.
      const existing = await storage.get<RunRecord>(RECORD_KEY)
      if (existing && existing.id === record.id) {
        return { record: existing, created: false }
      }
      await storage.put<RunRecord>(RECORD_KEY, record)
      return { record, created: true }
    },

    async list(filter = {}) {
      const r = await storage.get<RunRecord>(RECORD_KEY)
      if (!r) return []
      if (filter.workflowId && r.workflowId !== filter.workflowId) return []
      if (filter.status && r.status !== filter.status) return []
      return [r]
    },
  }
}
