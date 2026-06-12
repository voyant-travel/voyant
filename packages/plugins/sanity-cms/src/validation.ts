import { z } from "zod"
import type {
  SanityCmsPluginOptions,
  SanityLogger,
  SanityMapFn,
  SanitySyncEventNames,
} from "./plugin.js"
import type { SanityFetch } from "./types.js"

const optionalString = z.string().trim().min(1).optional()

const optionalFetch = z.custom<SanityFetch | undefined>(
  (value) => value === undefined || typeof value === "function",
  "Expected a fetch implementation function",
)

const optionalLogger = z.custom<SanityLogger | undefined>(
  (value) =>
    value === undefined ||
    (typeof value === "object" &&
      value !== null &&
      typeof (value as SanityLogger).error === "function" &&
      (((value as SanityLogger).info ?? undefined) === undefined ||
        typeof (value as SanityLogger).info === "function")),
  "Expected a logger with an error function",
)

const optionalMapEvent = z.custom<SanityMapFn | undefined>(
  (value) => value === undefined || typeof value === "function",
  "Expected a mapEvent function",
)

const optionalResilience = z.custom<SanityCmsPluginOptions["resilience"]>(
  (value) => value === undefined || (typeof value === "object" && value !== null),
  "Expected valid resilience options",
)

const optionalEvents = z.custom<SanitySyncEventNames | undefined>((value) => {
  if (value === undefined) return true
  if (typeof value !== "object" || value === null) return false
  const events = value as SanitySyncEventNames
  return [events.created, events.updated, events.deleted].every(
    (entry) => entry === undefined || (typeof entry === "string" && entry.trim().length > 0),
  )
}, "Expected event names to be non-empty strings")

export const sanityCmsPluginOptionsSchema = z.object({
  projectId: z.string().trim().min(1),
  dataset: z.string().trim().min(1),
  token: z.string().trim().min(1),
  documentType: z.string().trim().min(1),
  apiVersion: optionalString,
  voyantIdField: optionalString,
  apiHost: optionalString,
  fetch: optionalFetch.optional(),
  resilience: optionalResilience.optional(),
  events: optionalEvents.optional(),
  mapEvent: optionalMapEvent.optional(),
  logger: optionalLogger.optional(),
}) satisfies z.ZodType<SanityCmsPluginOptions>
