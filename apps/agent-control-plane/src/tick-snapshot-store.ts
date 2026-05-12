import { type TickSnapshotRecord, tickSnapshotRecordSchema } from "./control-plane.js"

export interface TickSnapshotStore {
  getLatest(repository: string): Promise<TickSnapshotRecord | null>
  listRecent(repository: string, options?: { limit?: number }): Promise<TickSnapshotRecord[]>
  putLatest(record: TickSnapshotRecord): Promise<TickSnapshotStoreWrite>
}

export interface TickSnapshotStoreWrite {
  historyKey?: string
  key: string
}

export interface TickSnapshotBucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>
  list?(options?: { cursor?: string; limit?: number; prefix?: string }): Promise<{
    cursor?: string
    objects: Array<{ key: string }>
    truncated?: boolean
  }>
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
}

export function createR2TickSnapshotStore({
  bucket,
  keyPrefix = "agent-control-plane",
}: {
  bucket: TickSnapshotBucket
  keyPrefix?: string
}): TickSnapshotStore {
  return {
    async getLatest(repository) {
      const object = await bucket.get(latestSnapshotKey({ keyPrefix, repository }))
      if (!object) return null

      const parsed = tickSnapshotRecordSchema.safeParse(JSON.parse(await object.text()))
      if (!parsed.success) {
        throw new Error(`stored tick snapshot is invalid for ${repository}`)
      }

      return parsed.data
    },

    async listRecent(repository, options = {}) {
      if (!bucket.list) {
        return []
      }

      const limit = boundedLimit(options.limit)
      const prefix = historySnapshotPrefix({ keyPrefix, repository })
      const listed = await bucket.list({
        limit,
        prefix,
      })

      const records: TickSnapshotRecord[] = []
      for (const object of listed.objects.slice(0, limit)) {
        const stored = await bucket.get(object.key)
        if (!stored) continue

        const parsed = tickSnapshotRecordSchema.safeParse(JSON.parse(await stored.text()))
        if (!parsed.success) {
          throw new Error(`stored tick snapshot is invalid for ${repository}`)
        }
        records.push(parsed.data)
      }

      return records
    },

    async putLatest(record) {
      const key = latestSnapshotKey({ keyPrefix, repository: record.snapshot.repository })
      const historyKey = historySnapshotKey({
        acceptedAt: record.acceptedAt,
        keyPrefix,
        repository: record.snapshot.repository,
      })
      const value = JSON.stringify(record)
      const options = {
        httpMetadata: {
          contentType: "application/json",
        },
      }
      await bucket.put(key, value, options)
      await bucket.put(historyKey, value, options)

      return { historyKey, key }
    },
  }
}

function latestSnapshotKey({ keyPrefix, repository }: { keyPrefix: string; repository: string }) {
  const normalizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, "")
  const encodedRepository = encodeURIComponent(repository.trim().toLowerCase())
  const key = `tick-snapshots/latest/${encodedRepository}.json`
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}

function historySnapshotPrefix({
  keyPrefix,
  repository,
}: {
  keyPrefix: string
  repository: string
}) {
  const normalizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, "")
  const encodedRepository = encodeURIComponent(repository.trim().toLowerCase())
  const key = `tick-snapshots/history/${encodedRepository}/`
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}

function historySnapshotKey({
  acceptedAt,
  keyPrefix,
  repository,
}: {
  acceptedAt: string
  keyPrefix: string
  repository: string
}) {
  const timestamp = Date.parse(acceptedAt)
  const sortable = Number.isFinite(timestamp)
    ? String(Number.MAX_SAFE_INTEGER - timestamp).padStart(16, "0")
    : encodeURIComponent(acceptedAt)
  return `${historySnapshotPrefix({ keyPrefix, repository })}${sortable}-${encodeURIComponent(acceptedAt)}.json`
}

function boundedLimit(limit = 20) {
  return Math.min(Math.max(Math.trunc(limit), 1), 50)
}
