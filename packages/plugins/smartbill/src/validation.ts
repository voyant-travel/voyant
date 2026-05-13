import { z } from "zod"
import type {
  SmartbillArtifactPersistenceOptions,
  SmartbillDbResolver,
  SmartbillDocumentStorageResolver,
  SmartbillStorageKeyPrefixResolver,
} from "./artifacts.js"
import type { SmartbillMappingOptions } from "./mapping.js"
import type {
  SmartbillErrorHandler,
  SmartbillIdempotencyOptions,
  SmartbillLogger,
  SmartbillMapFn,
  SmartbillPluginOptions,
  SmartbillSyncEventNames,
} from "./plugin.js"
import type { SmartbillFetch } from "./types.js"

const optionalString = z.string().trim().min(1).optional()
const optionalUrl = z.string().trim().url().optional()
const requiredEventString = z.custom<SmartbillMappingOptions["seriesName"]>(
  (value) => (typeof value === "string" && value.trim().length > 0) || typeof value === "function",
  "Expected a non-empty string or event resolver function",
)
const optionalEventText = z.custom<SmartbillMappingOptions["mentions"]>(
  (value) =>
    value === undefined ||
    (typeof value === "string" && value.trim().length > 0) ||
    typeof value === "function",
  "Expected a non-empty string or event resolver function",
)

const optionalFetch = z.custom<SmartbillFetch | undefined>(
  (value) => value === undefined || typeof value === "function",
  "Expected a fetch implementation function",
)

const optionalLogger = z.custom<SmartbillLogger | undefined>(
  (value) =>
    value === undefined ||
    (typeof value === "object" &&
      value !== null &&
      typeof (value as SmartbillLogger).error === "function" &&
      (((value as SmartbillLogger).info ?? undefined) === undefined ||
        typeof (value as SmartbillLogger).info === "function")),
  "Expected a logger with an error function",
)

const optionalMapEvent = z.custom<SmartbillMapFn | undefined>(
  (value) => value === undefined || typeof value === "function",
  "Expected a mapEvent function",
)

const optionalOnError = z.custom<SmartbillErrorHandler | undefined>(
  (value) => value === undefined || typeof value === "function",
  "Expected an onError function",
)

const optionalDb = z.custom<SmartbillDbResolver | undefined>(
  (value) =>
    value === undefined ||
    typeof value === "function" ||
    (typeof value === "object" && value !== null),
  "Expected a database handle or resolver function",
)

function isStorageProvider(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { upload?: unknown }).upload === "function" &&
    typeof (value as { delete?: unknown }).delete === "function" &&
    typeof (value as { signedUrl?: unknown }).signedUrl === "function" &&
    typeof (value as { get?: unknown }).get === "function"
  )
}

const optionalDocumentStorage = z.custom<SmartbillDocumentStorageResolver | undefined>(
  (value) =>
    value === undefined ||
    value === null ||
    typeof value === "function" ||
    isStorageProvider(value),
  "Expected a storage provider or resolver function",
)

const optionalDocumentStorageKeyPrefix = z.custom<SmartbillStorageKeyPrefixResolver | undefined>(
  (value) => value === undefined || typeof value === "string" || typeof value === "function",
  "Expected a storage key prefix string or resolver function",
)

const optionalArtifacts = z.custom<SmartbillArtifactPersistenceOptions | undefined>((value) => {
  if (value === undefined) return true
  if (typeof value !== "object" || value === null) return false
  const artifacts = value as SmartbillArtifactPersistenceOptions
  return (
    optionalDb.safeParse(artifacts.db).success &&
    optionalDocumentStorage.safeParse(artifacts.documentStorage).success &&
    optionalDocumentStorageKeyPrefix.safeParse(artifacts.documentStorageKeyPrefix).success
  )
}, "Expected valid SmartBill artifact persistence options")

const optionalEvents = z.custom<SmartbillSyncEventNames | undefined>((value) => {
  if (value === undefined) return true
  if (typeof value !== "object" || value === null) return false
  const events = value as SmartbillSyncEventNames
  return [events.issued, events.proformaIssued, events.voided, events.syncRequested].every(
    (entry) => entry === undefined || (typeof entry === "string" && entry.trim().length > 0),
  )
}, "Expected event names to be non-empty strings")

const optionalIdempotency = z.custom<SmartbillIdempotencyOptions | undefined>((value) => {
  if (value === undefined) return true
  if (typeof value !== "object" || value === null) return false
  const options = value as SmartbillIdempotencyOptions
  return (
    options.skipExistingExternalRef === undefined ||
    typeof options.skipExistingExternalRef === "boolean"
  )
}, "Expected valid SmartBill idempotency options")

export const smartbillPluginOptionsSchema = z.object({
  username: z.string().trim().min(1),
  apiToken: z.string().trim().min(1),
  companyVatCode: z.string().trim().min(1),
  seriesName: requiredEventString,
  apiUrl: optionalUrl,
  fetch: optionalFetch.optional(),
  language: optionalString,
  isTaxIncluded: z.boolean().optional(),
  art311SpecialRegime: z.boolean().optional(),
  art311SpecialRegimeText: optionalString,
  mentions: optionalEventText.optional(),
  observations: optionalEventText.optional(),
  events: optionalEvents.optional(),
  mapEvent: optionalMapEvent.optional(),
  logger: optionalLogger.optional(),
  idempotency: optionalIdempotency.optional(),
  onError: optionalOnError.optional(),
  artifacts: optionalArtifacts.optional(),
  db: optionalDb.optional(),
  documentStorage: optionalDocumentStorage.optional(),
  documentStorageKeyPrefix: optionalDocumentStorageKeyPrefix.optional(),
}) satisfies z.ZodType<SmartbillPluginOptions>
