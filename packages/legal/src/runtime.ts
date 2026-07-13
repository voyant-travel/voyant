import { buildBookingRouteRuntime, createBookingPiiService } from "@voyant-travel/bookings"
import { getVoyantCloudClient, type VoyantCloudClient } from "@voyant-travel/cloud-sdk"
import type { EventBus, VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { readPolicySourceFromInternalNotes } from "@voyant-travel/inventory/booking-payment-policy-runtime"
import {
  getOperatorPaymentInstructions,
  getOperatorProfile,
} from "@voyant-travel/operator-settings"
import type { StorageProvider } from "@voyant-travel/storage"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ContractDocumentRoutesOptions } from "./contract-document-routes.js"
import type {
  LegalBookingContractSubscriberHost,
  LegalBookingContractSubscriberRuntime,
} from "./contracts/booking-contract-subscriber-runtime.js"
import { createContractDocumentService } from "./contracts/contract-document-service.js"
import { buildContractVariableBindings } from "./contracts/contract-variables.js"
import type { CreateLegalHonoModuleOptions } from "./index.js"
import {
  type AutoGenerateContractOptions,
  type ContractDocumentGenerator,
  createBrowserRenderedPdfContractDocumentSerializer,
  createPdfContractDocumentGenerator,
  createStorageBackedContractDocumentGenerator,
} from "./index.js"

const DEFAULT_CONTRACT_SERIES = {
  name: "customer-contracts",
  prefix: `CTR-${new Date().getFullYear()}-`,
  scope: "customer",
} as const
const LOCAL_PLACEHOLDER_KEYS = new Set(["local-dev"])
const CLIENT_CACHE = new WeakMap<object, Map<string, VoyantCloudClient>>()

export interface LegalRuntime {
  legal: CreateLegalHonoModuleOptions
  contractDocument: ContractDocumentRoutesOptions
  bookingContractSubscriber: LegalBookingContractSubscriberHost
}

export const DEFAULT_AUTO_GENERATE_CONTRACT_OPTIONS: AutoGenerateContractOptions = {
  enabled: true,
  templateSlug: "customer-sales-agreement",
  scope: "customer",
  language: "en",
  seriesPrefixScope: {
    prefix: DEFAULT_CONTRACT_SERIES.prefix,
    scope: DEFAULT_CONTRACT_SERIES.scope,
  },
  resolveVariables: buildContractVariableBindings({
    resolveOperatorProfile: (db) => getOperatorProfile(db),
    resolveOperatorPaymentInstructions: (db) => getOperatorPaymentInstructions(db),
    resolvePaymentPolicySource: (internalNotes) => readPolicySourceFromInternalNotes(internalNotes),
  }),
}

/** Build all Legal providers for the standard Node product. */
export function createLegalRuntime(primitives: VoyantRuntimeHostPrimitives): LegalRuntime {
  return {
    legal: {
      resolveDocumentDownloadUrl: primitives.storage.downloadUrl,
      resolveDocumentStorage: (bindings) => resolveStorage(primitives, bindings),
      resolveDocumentGenerator: (bindings) =>
        resolveContractDocumentGenerator(primitives, bindings),
      resolveBookingPiiService: (bindings) => resolveBookingPiiService(primitives, bindings),
    },
    contractDocument: createContractDocumentRoutesOptions(primitives),
    bookingContractSubscriber: createBookingContractSubscriberHost(primitives),
  }
}

/** Shared package-side entry point used by checkout finalization and Legal routes. */
export function generateContractPdfForBooking(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
  db: PostgresJsDatabase,
  eventBus: EventBus | undefined,
  bookingId: string,
  options: { force?: boolean } = {},
): Promise<{ contractId: string; attachmentId: string } | null> {
  return createContractDocumentServiceForBindings(primitives, bindings).generate(
    db,
    eventBus,
    bookingId,
    options,
  )
}

export function resolveContractDocumentGenerator(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
): ContractDocumentGenerator | undefined {
  const storage = resolveStorage(primitives, bindings)
  if (!storage) return undefined

  return async (context) => {
    const cloudClient = resolveCloudPdfClient(primitives.env(bindings))
    if (cloudClient) {
      return createStorageBackedContractDocumentGenerator({
        storage,
        serializer: createBrowserRenderedPdfContractDocumentSerializer({ cloudClient }),
      })(context)
    }

    console.warn(
      "[operator] VOYANT_CLOUD_PDF_API_KEY not set - using basic pdf-lib serializer. " +
        "Contract PDFs will be unstyled. Set the key to enable browser-rendered output.",
    )
    return createPdfContractDocumentGenerator({ storage })(context)
  }
}

export async function resolveBookingPiiService(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
) {
  const runtime = buildBookingRouteRuntime(primitives.env(bindings))
  try {
    return createBookingPiiService({ kms: await runtime.getKmsProvider() })
  } catch {
    return null
  }
}

function createContractDocumentRoutesOptions(
  primitives: VoyantRuntimeHostPrimitives,
): ContractDocumentRoutesOptions {
  return {
    generateContract: (bindings, db, eventBus, bookingId, options) =>
      generateContractPdfForBooking(
        primitives,
        bindings,
        db as PostgresJsDatabase,
        eventBus as EventBus | undefined,
        bookingId,
        options,
      ),
    previewContract: (bindings, db, bookingId) =>
      createContractDocumentServiceForBindings(primitives, bindings).preview(
        db as PostgresJsDatabase,
        bookingId,
      ),
    resolveStorage: (bindings) => resolveStorage(primitives, bindings),
    guessMimeType,
  }
}

function createBookingContractSubscriberHost(
  primitives: VoyantRuntimeHostPrimitives,
): LegalBookingContractSubscriberHost {
  return {
    createRuntime(bindings): LegalBookingContractSubscriberRuntime | null {
      const documentGenerator = resolveContractDocumentGenerator(primitives, bindings)
      if (!documentGenerator) {
        console.error(
          "[legal] autoGenerateContractOnConfirmed.enabled=true but no documentGenerator resolved; skipping subscriber.",
        )
        return null
      }
      return {
        options: DEFAULT_AUTO_GENERATE_CONTRACT_OPTIONS,
        withDb: (runtimeBindings, operation) =>
          primitives.database.transaction(runtimeBindings, (db) =>
            operation(db as PostgresJsDatabase),
          ),
        documentGenerator,
        documentStorage: resolveStorage(primitives, bindings),
        resolveBookingPiiService: () => resolveBookingPiiService(primitives, bindings),
        resolveVariables: DEFAULT_AUTO_GENERATE_CONTRACT_OPTIONS.resolveVariables,
        resolveActionLedgerContext: (event) => ({
          userId: event.actorId,
          actor: event.actorId ? "staff" : "system",
          callerType: "internal",
          isInternalRequest: true,
        }),
      }
    },
  }
}

function createContractDocumentServiceForBindings(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
) {
  return createContractDocumentService({
    resolveGenerator: () => resolveContractDocumentGenerator(primitives, bindings) ?? null,
    autoGenerateOptions: DEFAULT_AUTO_GENERATE_CONTRACT_OPTIONS,
    defaultSeries: DEFAULT_CONTRACT_SERIES,
    resolveBindings: () => primitives.env(bindings),
    resolveBookingPiiService: () => resolveBookingPiiService(primitives, bindings),
  })
}

function resolveStorage(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
): StorageProvider | null {
  return (primitives.storage.resolve(bindings) as StorageProvider | null | undefined) ?? null
}

function resolveCloudPdfClient(env: Readonly<Record<string, unknown>>): VoyantCloudClient | null {
  const apiKey =
    nonEmpty(env.VOYANT_CLOUD_PDF_API_KEY) ??
    (nonEmpty(env.VOYANT_ADMIN_AUTH_MODE) === "voyant-cloud"
      ? (nonEmpty(env.VOYANT_API_KEY) ?? nonEmpty(env.VOYANT_CLOUD_API_KEY))
      : undefined)
  if (!apiKey) return null

  const cacheOwner = env as object
  const cached = CLIENT_CACHE.get(cacheOwner)?.get(apiKey)
  if (cached) return cached
  const baseUrl = nonEmpty(env.VOYANT_CLOUD_API_URL)
  const userAgent = nonEmpty(env.VOYANT_CLOUD_USER_AGENT)
  const client = getVoyantCloudClient(
    {
      VOYANT_CLOUD_API_KEY: apiKey,
      ...(baseUrl ? { VOYANT_CLOUD_API_URL: baseUrl } : {}),
      ...(userAgent ? { VOYANT_CLOUD_USER_AGENT: userAgent } : {}),
    },
    { apiKey },
  )
  const clients = CLIENT_CACHE.get(cacheOwner) ?? new Map<string, VoyantCloudClient>()
  clients.set(apiKey, client)
  CLIENT_CACHE.set(cacheOwner, clients)
  return client
}

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed && !LOCAL_PLACEHOLDER_KEYS.has(trimmed) ? trimmed : undefined
}

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

function guessMimeType(key: string): string {
  const extension = key.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXT[extension] ?? "application/octet-stream"
}
