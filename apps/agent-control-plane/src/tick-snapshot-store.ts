import { type TickSnapshotRecord, tickSnapshotRecordSchema } from "./control-plane.js"

export interface TickSnapshotStore {
  getLatest(repository: string): Promise<TickSnapshotRecord | null>
  putLatest(record: TickSnapshotRecord): Promise<TickSnapshotStoreWrite>
}

export interface TickSnapshotStoreWrite {
  key: string
}

export interface TickSnapshotBucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>
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

    async putLatest(record) {
      const key = latestSnapshotKey({ keyPrefix, repository: record.snapshot.repository })
      await bucket.put(key, JSON.stringify(record), {
        httpMetadata: {
          contentType: "application/json",
        },
      })

      return { key }
    },
  }
}

function latestSnapshotKey({ keyPrefix, repository }: { keyPrefix: string; repository: string }) {
  const normalizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, "")
  const encodedRepository = encodeURIComponent(repository.trim().toLowerCase())
  const key = `tick-snapshots/latest/${encodedRepository}.json`
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}
