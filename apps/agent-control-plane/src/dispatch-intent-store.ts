import {
  type DispatchIntentRecord,
  dispatchIntentRecordSchema,
  isDispatchIntentActive,
} from "./control-plane.js"

export interface DispatchIntentStore {
  acquireIntent(
    record: DispatchIntentRecord,
    options: { now: Date },
  ): Promise<DispatchIntentAcquireResult>
  getActive(reference: DispatchIntentReference): Promise<DispatchIntentRecord | null>
  putIntent(record: DispatchIntentRecord): Promise<DispatchIntentStoreWrite>
}

export interface DispatchIntentReference {
  action: string
  issueNumber: number
  repository: string
}

export interface DispatchIntentStoreWrite {
  activeKey: string
  key: string
}

export type DispatchIntentAcquireResult =
  | { acquired: true; write: DispatchIntentStoreWrite }
  | { acquired: false; activeIntent: DispatchIntentRecord }

export interface DispatchIntentBucket {
  get(key: string): Promise<{ etag?: string; text(): Promise<string> } | null>
  put(
    key: string,
    value: string,
    options?: {
      httpMetadata?: { contentType?: string }
      onlyIf?: { etagDoesNotMatch?: string; etagMatches?: string }
    },
  ): Promise<unknown | null>
}

export function createR2DispatchIntentStore({
  bucket,
  keyPrefix = "agent-control-plane",
}: {
  bucket: DispatchIntentBucket
  keyPrefix?: string
}): DispatchIntentStore {
  return {
    async acquireIntent(record, { now }) {
      const reference = recordReference(record)
      const activeKey = activeIntentKey({ keyPrefix, reference })
      const existingObject = await bucket.get(activeKey)
      if (existingObject) {
        const activeIntent = parseStoredIntent({
          repository: reference.repository,
          text: await existingObject.text(),
        })
        if (isDispatchIntentActive(activeIntent, now)) {
          return { acquired: false, activeIntent }
        }
      }

      const value = JSON.stringify(record)
      const options = {
        httpMetadata: {
          contentType: "application/json",
        },
        onlyIf: existingObject?.etag
          ? { etagMatches: existingObject.etag }
          : { etagDoesNotMatch: "*" },
      }
      const activeWrite = await bucket.put(activeKey, value, options)
      if (!activeWrite) {
        const activeIntent = await this.getActive(reference)
        if (activeIntent) {
          return { acquired: false, activeIntent }
        }
        throw new Error(`dispatch intent lease contention for ${reference.repository}`)
      }

      const key = intentKey({ id: record.id, keyPrefix })
      await bucket.put(key, value, {
        httpMetadata: {
          contentType: "application/json",
        },
      })

      return {
        acquired: true,
        write: { activeKey, key },
      }
    },

    async getActive(reference) {
      const object = await bucket.get(activeIntentKey({ keyPrefix, reference }))
      if (!object) return null

      return parseStoredIntent({
        repository: reference.repository,
        text: await object.text(),
      })
    },

    async putIntent(record) {
      const reference = recordReference(record)
      const key = intentKey({ id: record.id, keyPrefix })
      const activeKey = activeIntentKey({ keyPrefix, reference })
      const value = JSON.stringify(record)
      const options = {
        httpMetadata: {
          contentType: "application/json",
        },
      }

      await bucket.put(key, value, options)
      await bucket.put(activeKey, value, options)

      return { activeKey, key }
    },
  }
}

function intentKey({ id, keyPrefix }: { id: string; keyPrefix: string }) {
  const normalizedPrefix = normalizePrefix(keyPrefix)
  const key = `dispatch-intents/by-id/${encodeURIComponent(id)}.json`
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}

function parseStoredIntent({ repository, text }: { repository: string; text: string }) {
  const parsed = dispatchIntentRecordSchema.safeParse(JSON.parse(text))
  if (!parsed.success) {
    throw new Error(`stored dispatch intent is invalid for ${repository}`)
  }

  return parsed.data
}

function recordReference(record: DispatchIntentRecord) {
  return {
    action: record.plan.action,
    issueNumber: record.plan.issue.number,
    repository: record.plan.repository,
  }
}

function activeIntentKey({
  keyPrefix,
  reference,
}: {
  keyPrefix: string
  reference: DispatchIntentReference
}) {
  const normalizedPrefix = normalizePrefix(keyPrefix)
  const encodedRepository = encodeURIComponent(reference.repository.trim().toLowerCase())
  const encodedAction = encodeURIComponent(reference.action.trim().toLowerCase())
  const key = `dispatch-intents/active/${encodedRepository}/${reference.issueNumber}/${encodedAction}.json`
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}

function normalizePrefix(keyPrefix: string) {
  return keyPrefix.replace(/^\/+|\/+$/g, "")
}
