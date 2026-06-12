import { z } from "zod"
import type {
  PayloadCmsPluginOptions,
  PayloadLogger,
  PayloadMapFn,
  PayloadSyncEventNames,
} from "./plugin.js"
import type { PayloadFetch } from "./types.js"

const optionalString = z.string().trim().min(1).optional()

const optionalFetch = z.custom<PayloadFetch | undefined>(
  (value) => value === undefined || typeof value === "function",
  "Expected a fetch implementation function",
)

const optionalLogger = z.custom<PayloadLogger | undefined>(
  (value) =>
    value === undefined ||
    (typeof value === "object" &&
      value !== null &&
      typeof (value as PayloadLogger).error === "function" &&
      (((value as PayloadLogger).info ?? undefined) === undefined ||
        typeof (value as PayloadLogger).info === "function")),
  "Expected a logger with an error function",
)

const optionalMapEvent = z.custom<PayloadMapFn | undefined>(
  (value) => value === undefined || typeof value === "function",
  "Expected a mapEvent function",
)

const optionalResilience = z.custom<PayloadCmsPluginOptions["resilience"]>(
  (value) => value === undefined || (typeof value === "object" && value !== null),
  "Expected valid resilience options",
)

const optionalEvents = z.custom<PayloadSyncEventNames | undefined>((value) => {
  if (value === undefined) return true
  if (typeof value !== "object" || value === null) return false
  const events = value as PayloadSyncEventNames
  return [events.created, events.updated, events.deleted].every(
    (entry) => entry === undefined || (typeof entry === "string" && entry.trim().length > 0),
  )
}, "Expected event names to be non-empty strings")

export const payloadCmsPluginOptionsSchema = z.object({
  apiUrl: z.string().trim().url(),
  apiKey: z.string().trim().min(1),
  collection: z.string().trim().min(1),
  voyantIdField: optionalString,
  apiKeyAuthScheme: optionalString,
  fetch: optionalFetch.optional(),
  resilience: optionalResilience.optional(),
  events: optionalEvents.optional(),
  mapEvent: optionalMapEvent.optional(),
  logger: optionalLogger.optional(),
}) satisfies z.ZodType<PayloadCmsPluginOptions>
