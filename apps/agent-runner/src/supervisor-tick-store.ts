import { z } from "zod"

export const supervisorTickRecordSchema = z.object({
  recordedAt: z.string().datetime(),
  repository: z.string().trim().min(1),
  result: z.unknown(),
})

export type SupervisorTickRecord = z.infer<typeof supervisorTickRecordSchema>

export interface SupervisorTickStore {
  getLatest(repository: string): Promise<SupervisorTickRecord | null>
  putLatest(record: SupervisorTickRecord): Promise<SupervisorTickStoreWrite>
}

export interface SupervisorTickStoreWrite {
  key: string
}

export interface SupervisorTickBucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>
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

    async putLatest(record) {
      const key = latestTickKey({ keyPrefix, repository: record.repository })
      await bucket.put(key, JSON.stringify(record), {
        httpMetadata: {
          contentType: "application/json",
        },
      })

      return { key }
    },
  }
}

function latestTickKey({ keyPrefix, repository }: { keyPrefix: string; repository: string }) {
  const normalizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, "")
  const encodedRepository = encodeURIComponent(repository.trim().toLowerCase())
  const key = `supervisor-ticks/latest/${encodedRepository}.json`
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}
