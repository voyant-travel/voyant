import type { Plugin, Subscriber } from "@voyant-travel/core"
import { ZodError } from "zod"

import type { SanityClientOptions } from "./client.js"
import { createSanitySyncRuntime } from "./runtime.js"
import type { SanityDocBody, VoyantEntityEvent } from "./types.js"
import { sanityCmsPluginOptionsSchema } from "./validation.js"

export interface SanitySyncEventNames {
  created?: string
  updated?: string
  deleted?: string
}

export type SanityMapFn = (event: VoyantEntityEvent) => SanityDocBody

export interface SanityLogger {
  error: (message: string, meta?: unknown) => void
  info?: (message: string, meta?: unknown) => void
}

export interface SanityCmsPluginOptions extends SanityClientOptions {
  documentType: string
  events?: SanitySyncEventNames
  mapEvent?: SanityMapFn
  logger?: SanityLogger
}

function coerceEvent(data: unknown): VoyantEntityEvent | null {
  if (data == null || typeof data !== "object") return null
  const maybe = data as Record<string, unknown>
  if (typeof maybe.id !== "string") return null
  return maybe as VoyantEntityEvent
}

export function sanityCmsPlugin(options: SanityCmsPluginOptions): Plugin {
  const validatedOptions = parseSanityCmsPluginOptions(options)
  const { client, mapEvent, logger, eventNames } = createSanitySyncRuntime(validatedOptions)

  const subscribers: Subscriber[] = [
    {
      event: eventNames.created,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          await client.upsertByVoyantId(validatedOptions.documentType, event.id, mapEvent(event))
        } catch (err) {
          logger.error(`[sanity-cms] upsert on "${eventNames.created}" failed for ${event.id}`, err)
        }
      },
    },
    {
      event: eventNames.updated,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          await client.upsertByVoyantId(validatedOptions.documentType, event.id, mapEvent(event))
        } catch (err) {
          logger.error(`[sanity-cms] upsert on "${eventNames.updated}" failed for ${event.id}`, err)
        }
      },
    },
    {
      event: eventNames.deleted,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          await client.deleteByVoyantId(validatedOptions.documentType, event.id)
        } catch (err) {
          logger.error(`[sanity-cms] delete on "${eventNames.deleted}" failed for ${event.id}`, err)
        }
      },
    },
  ]

  return {
    name: "sanity-cms",
    version: "0.1.0",
    subscribers,
  }
}

function parseSanityCmsPluginOptions(options: SanityCmsPluginOptions): SanityCmsPluginOptions {
  try {
    return sanityCmsPluginOptionsSchema.parse(options)
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues
        .map((issue) => {
          const path = issue.path.join(".") || "options"
          return `${path}: ${issue.message}`
        })
        .join("; ")
      throw new Error(`Invalid Sanity CMS plugin options: ${detail}`)
    }
    throw error
  }
}
