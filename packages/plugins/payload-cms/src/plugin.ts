import type { Plugin, Subscriber } from "@voyant-travel/core"
import { ZodError } from "zod"

import type { PayloadClientOptions } from "./client.js"
import { createPayloadSyncRuntime } from "./runtime.js"
import type { PayloadDocBody, VoyantEntityEvent } from "./types.js"
import { payloadCmsPluginOptionsSchema } from "./validation.js"

export interface PayloadSyncEventNames {
  created?: string
  updated?: string
  deleted?: string
}

export type PayloadMapFn = (event: VoyantEntityEvent) => PayloadDocBody

export interface PayloadLogger {
  error: (message: string, meta?: unknown) => void
  info?: (message: string, meta?: unknown) => void
}

export interface PayloadCmsPluginOptions extends PayloadClientOptions {
  collection: string
  events?: PayloadSyncEventNames
  mapEvent?: PayloadMapFn
  logger?: PayloadLogger
}

function coerceEvent(data: unknown): VoyantEntityEvent | null {
  if (data == null || typeof data !== "object") return null
  const maybe = data as Record<string, unknown>
  if (typeof maybe.id !== "string") return null
  return maybe as VoyantEntityEvent
}

export function payloadCmsPlugin(options: PayloadCmsPluginOptions): Plugin {
  const validatedOptions = parsePayloadCmsPluginOptions(options)
  const { client, mapEvent, logger, eventNames } = createPayloadSyncRuntime(validatedOptions)

  const subscribers: Subscriber[] = [
    {
      event: eventNames.created,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          await client.upsertByVoyantId(validatedOptions.collection, event.id, mapEvent(event))
        } catch (err) {
          logger.error(
            `[payload-cms] upsert on "${eventNames.created}" failed for ${event.id}`,
            err,
          )
        }
      },
    },
    {
      event: eventNames.updated,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          await client.upsertByVoyantId(validatedOptions.collection, event.id, mapEvent(event))
        } catch (err) {
          logger.error(
            `[payload-cms] upsert on "${eventNames.updated}" failed for ${event.id}`,
            err,
          )
        }
      },
    },
    {
      event: eventNames.deleted,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          await client.deleteByVoyantId(validatedOptions.collection, event.id)
        } catch (err) {
          logger.error(
            `[payload-cms] delete on "${eventNames.deleted}" failed for ${event.id}`,
            err,
          )
        }
      },
    },
  ]

  return {
    name: "payload-cms",
    version: "0.1.0",
    subscribers,
  }
}

function parsePayloadCmsPluginOptions(options: PayloadCmsPluginOptions): PayloadCmsPluginOptions {
  try {
    return payloadCmsPluginOptionsSchema.parse(options)
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues
        .map((issue) => {
          const path = issue.path.join(".") || "options"
          return `${path}: ${issue.message}`
        })
        .join("; ")
      throw new Error(`Invalid Payload CMS plugin options: ${detail}`)
    }
    throw error
  }
}
