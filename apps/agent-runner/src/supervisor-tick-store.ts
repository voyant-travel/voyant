import { z } from "zod"

export const supervisorTickRecordSchema = z.object({
  recordedAt: z.string().datetime(),
  repository: z.string().trim().min(1),
  result: z.unknown(),
})

export type SupervisorTickRecord = z.infer<typeof supervisorTickRecordSchema>

export const supervisorLeaseRecordSchema = z.object({
  id: z.string().trim().min(1),
  leasedAt: z.string().datetime(),
  repository: z.string().trim().min(1),
  result: z.unknown().optional(),
})

export type SupervisorLeaseRecord = z.infer<typeof supervisorLeaseRecordSchema>

export interface SupervisorTickStore {
  getLatest(repository: string): Promise<SupervisorTickRecord | null>
  listLeases?(repository: string, options: { since: string }): Promise<SupervisorLeaseRecord[]>
  listRecent(repository: string, options?: { limit?: number }): Promise<SupervisorTickRecord[]>
  putLease?(record: SupervisorLeaseRecord): Promise<SupervisorTickStoreWrite>
  putLatest(record: SupervisorTickRecord): Promise<SupervisorTickStoreWrite>
}

export interface SupervisorTickStoreWrite {
  historyKey?: string
  key: string
}

export interface SupervisorTickBucket {
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

export function createSupervisorTickRecord({
  recordedAt = new Date(),
  repository,
  result,
}: {
  recordedAt?: Date
  repository: string
  result: unknown
}): SupervisorTickRecord {
  return {
    recordedAt: recordedAt.toISOString(),
    repository,
    result,
  }
}

export function createR2SupervisorTickStore({
  bucket,
  keyPrefix = "agent-runner",
}: {
  bucket: SupervisorTickBucket
  keyPrefix?: string
}): SupervisorTickStore {
  return {
    async getLatest(repository) {
      const object = await bucket.get(latestTickKey({ keyPrefix, repository }))
      if (!object) return null

      const parsed = supervisorTickRecordSchema.safeParse(JSON.parse(await object.text()))
      if (!parsed.success) {
        throw new Error(`stored supervisor tick is invalid for ${repository}`)
      }

      return parsed.data
    },

    async listRecent(repository, options = {}) {
      if (!bucket.list) {
        return []
      }

      const limit = boundedLimit(options.limit)
      const prefix = historyTickPrefix({ keyPrefix, repository })
      const listed = await bucket.list({
        limit,
        prefix,
      })

      const records: SupervisorTickRecord[] = []
      for (const object of listed.objects.slice(0, limit)) {
        const stored = await bucket.get(object.key)
        if (!stored) continue

        const parsed = supervisorTickRecordSchema.safeParse(JSON.parse(await stored.text()))
        if (!parsed.success) {
          throw new Error(`stored supervisor tick is invalid for ${repository}`)
        }
        records.push(parsed.data)
      }

      return records
    },

    async listLeases(repository, { since }) {
      if (!bucket.list) {
        return []
      }

      const records: SupervisorLeaseRecord[] = []
      const prefix = leaseHistoryPrefix({ keyPrefix, repository })
      let cursor: string | undefined
      let done = false

      do {
        const listed = await bucket.list({
          cursor,
          limit: 100,
          prefix,
        })
        cursor = listed.cursor

        for (const object of listed.objects) {
          const stored = await bucket.get(object.key)
          if (!stored) continue

          const parsed = supervisorLeaseRecordSchema.safeParse(JSON.parse(await stored.text()))
          if (!parsed.success) {
            throw new Error(`stored supervisor lease is invalid for ${repository}`)
          }
          if (parsed.data.leasedAt < since) {
            done = true
            break
          }
          records.push(parsed.data)
        }
      } while (!done && cursor)

      return records
    },

    async putLease(record) {
      const key = leaseHistoryKey({
        id: record.id,
        keyPrefix,
        leasedAt: record.leasedAt,
        repository: record.repository,
      })
      const value = JSON.stringify(record)
      await bucket.put(key, value, {
        httpMetadata: {
          contentType: "application/json",
        },
      })

      return { key }
    },

    async putLatest(record) {
      const key = latestTickKey({ keyPrefix, repository: record.repository })
      const historyKey = historyTickKey({
        keyPrefix,
        recordedAt: record.recordedAt,
        repository: record.repository,
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

function latestTickKey({ keyPrefix, repository }: { keyPrefix: string; repository: string }) {
  const normalizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, "")
  const encodedRepository = encodeURIComponent(repository.trim().toLowerCase())
  const key = `supervisor-ticks/latest/${encodedRepository}.json`
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}

function historyTickPrefix({ keyPrefix, repository }: { keyPrefix: string; repository: string }) {
  const normalizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, "")
  const encodedRepository = encodeURIComponent(repository.trim().toLowerCase())
  const key = `supervisor-ticks/history/${encodedRepository}/`
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}

function leaseHistoryPrefix({ keyPrefix, repository }: { keyPrefix: string; repository: string }) {
  const normalizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, "")
  const encodedRepository = encodeURIComponent(repository.trim().toLowerCase())
  const key = `supervisor-leases/history/${encodedRepository}/`
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}

function historyTickKey({
  keyPrefix,
  recordedAt,
  repository,
}: {
  keyPrefix: string
  recordedAt: string
  repository: string
}) {
  const timestamp = Date.parse(recordedAt)
  const sortable = Number.isFinite(timestamp)
    ? String(Number.MAX_SAFE_INTEGER - timestamp).padStart(16, "0")
    : encodeURIComponent(recordedAt)
  return `${historyTickPrefix({ keyPrefix, repository })}${sortable}-${encodeURIComponent(recordedAt)}.json`
}

function leaseHistoryKey({
  id,
  keyPrefix,
  leasedAt,
  repository,
}: {
  id: string
  keyPrefix: string
  leasedAt: string
  repository: string
}) {
  const timestamp = Date.parse(leasedAt)
  const sortable = Number.isFinite(timestamp)
    ? String(Number.MAX_SAFE_INTEGER - timestamp).padStart(16, "0")
    : encodeURIComponent(leasedAt)
  return `${leaseHistoryPrefix({ keyPrefix, repository })}${sortable}-${encodeURIComponent(leasedAt)}-${encodeURIComponent(id)}.json`
}

function boundedLimit(limit = 20) {
  return Math.min(Math.max(Math.trunc(limit), 1), 50)
}
