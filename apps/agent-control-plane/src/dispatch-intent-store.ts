import {
  type DispatchIntentFinishRequest,
  type DispatchIntentRecord,
  dispatchIntentRecordSchema,
  finishDispatchIntent,
  isDispatchIntentActive,
} from "./control-plane.js"

export interface DispatchIntentStore {
  acquireIntent(
    record: DispatchIntentRecord,
    options: { now: Date },
  ): Promise<DispatchIntentAcquireResult>
  finishIntent(options: {
    id: string
    now: Date
    request: DispatchIntentFinishRequest
  }): Promise<DispatchIntentFinishResult>
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

export type DispatchIntentFinishResult =
  | {
      finished: true
      intent: DispatchIntentRecord
      write: DispatchIntentStoreWrite & { activeUpdated: boolean }
    }
  | {
      finished: false
      intent?: DispatchIntentRecord
      reason: "finish_contention" | "holder_mismatch" | "intent_not_active" | "not_found"
    }

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
          context: reference.repository,
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

    async finishIntent({ id, now, request }) {
      const key = intentKey({ id, keyPrefix })
      const object = await bucket.get(key)
      if (!object) {
        return { finished: false, reason: "not_found" }
      }

      const intent = parseStoredIntent({
        context: id,
        text: await object.text(),
      })
      if (intent.status !== "leased") {
        return { finished: false, intent, reason: "intent_not_active" }
      }
      if (intent.lease.holder !== request.holder) {
        return { finished: false, intent, reason: "holder_mismatch" }
      }

      const finishedIntent = finishDispatchIntent({ intent, now, request })
      const value = JSON.stringify(finishedIntent)
      const writeOptions = {
        httpMetadata: {
          contentType: "application/json",
        },
        ...(object.etag ? { onlyIf: { etagMatches: object.etag } } : {}),
      }
      const byIdWrite = await bucket.put(key, value, writeOptions)
      if (!byIdWrite) {
        const currentObject = await bucket.get(key)
        if (!currentObject) {
          return { finished: false, reason: "not_found" }
        }

        const currentIntent = parseStoredIntent({
          context: id,
          text: await currentObject.text(),
        })
        return { finished: false, intent: currentIntent, reason: "finish_contention" }
      }

      const reference = recordReference(intent)
      const activeKey = activeIntentKey({ keyPrefix, reference })
      const activeObject = await bucket.get(activeKey)
      let activeUpdated = false
      if (activeObject) {
        const activeIntent = parseStoredIntent({
          context: `${reference.repository}#${reference.issueNumber}`,
          text: await activeObject.text(),
        })
        if (activeIntent.id === intent.id) {
          const activeWrite = await bucket.put(activeKey, value, {
            httpMetadata: {
              contentType: "application/json",
            },
            ...(activeObject.etag ? { onlyIf: { etagMatches: activeObject.etag } } : {}),
          })
          activeUpdated = Boolean(activeWrite)
          if (!activeUpdated) {
            const refreshedActiveObject = await bucket.get(activeKey)
            if (refreshedActiveObject) {
              const refreshedActiveIntent = parseStoredIntent({
                context: `${reference.repository}#${reference.issueNumber}`,
                text: await refreshedActiveObject.text(),
              })
              if (refreshedActiveIntent.id === intent.id) {
                const retryWrite = await bucket.put(activeKey, value, {
                  httpMetadata: {
                    contentType: "application/json",
                  },
                  ...(refreshedActiveObject.etag
                    ? { onlyIf: { etagMatches: refreshedActiveObject.etag } }
                    : {}),
                })
                activeUpdated = Boolean(retryWrite)
              }
            }
          }
        }
      }

      return {
        finished: true,
        intent: finishedIntent,
        write: { activeKey, activeUpdated, key },
      }
    },

    async getActive(reference) {
      const object = await bucket.get(activeIntentKey({ keyPrefix, reference }))
      if (!object) return null

      return parseStoredIntent({
        context: reference.repository,
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

function parseStoredIntent({ context, text }: { context: string; text: string }) {
  const parsed = dispatchIntentRecordSchema.safeParse(JSON.parse(text))
  if (!parsed.success) {
    throw new Error(`stored dispatch intent is invalid for ${context}`)
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
