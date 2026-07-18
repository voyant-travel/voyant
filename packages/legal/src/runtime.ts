import { buildBookingRouteRuntime, createBookingPiiService } from "@voyant-travel/bookings"
import type { EventBus, VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  createHttpDocumentRendererFromEnv,
  type DocumentRenderer,
} from "@voyant-travel/core/document-rendering"
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
import { contractsService } from "./contracts/service.js"
import type { CreateLegalApiModuleOptions } from "./index.js"
import {
  type AutoGenerateContractOptions,
  type ContractDocumentGenerator,
  createPdfContractDocumentGenerator,
  createRenderedPdfContractDocumentSerializer,
  createStorageBackedContractDocumentGenerator,
} from "./index.js"

export interface LegalRuntime {
  legal: CreateLegalApiModuleOptions
  contractDocument: ContractDocumentRoutesOptions
  bookingContractSubscriber: LegalBookingContractSubscriberHost
}

export const DEFAULT_AUTO_GENERATE_CONTRACT_OPTIONS: AutoGenerateContractOptions = {
  enabled: true,
  scope: "customer",
  requireExplicitDefaultTemplate: true,
  requireNumberSeries: true,
  resolveVariables: buildContractVariableBindings({
    resolveOperatorProfile: (db) => getOperatorProfile(db),
    resolveOperatorPaymentInstructions: (db) => getOperatorPaymentInstructions(db),
    resolvePaymentPolicySource: (internalNotes) => readPolicySourceFromInternalNotes(internalNotes),
  }),
}

function createDefaultAutoGenerateContractOptions(
  primitives: VoyantRuntimeHostPrimitives,
): AutoGenerateContractOptions {
  return {
    ...DEFAULT_AUTO_GENERATE_CONTRACT_OPTIONS,
    resolveVariables: buildContractVariableBindings({
      resolveOperatorProfile: (db) => getOperatorProfile(db),
      resolveOperatorPaymentInstructions: (db) => getOperatorPaymentInstructions(db),
      resolvePaymentPolicySource: (internalNotes) =>
        readPolicySourceFromInternalNotes(internalNotes),
      resolveOperatorBrandAssetUrl: async (asset, bindings) => {
        const storage = primitives.storage.resolve(bindings, "media") as
          | StorageProvider
          | null
          | undefined
        const body = await storage?.get(asset.assetKey)
        if (!body) return null
        return arrayBufferDataUrl(body, asset.mimeType ?? "image/png")
      },
    }),
  }
}

/** Build all Legal providers for the standard Node product. */
export function createLegalRuntime(
  primitives: VoyantRuntimeHostPrimitives,
  documentRenderer?: DocumentRenderer | Promise<DocumentRenderer> | null,
): LegalRuntime {
  return {
    legal: {
      resolveDocumentDownloadUrl: primitives.storage.downloadUrl,
      resolveDocumentStorage: (bindings) => resolveStorage(primitives, bindings),
      resolveDocumentGenerator: (bindings) =>
        resolveContractDocumentGenerator(primitives, bindings, documentRenderer),
      resolveBookingPiiService: (bindings) => resolveBookingPiiService(primitives, bindings),
    },
    contractDocument: createContractDocumentRoutesOptions(primitives, documentRenderer),
    bookingContractSubscriber: createBookingContractSubscriberHost(primitives, documentRenderer),
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
  documentRenderer?: DocumentRenderer | Promise<DocumentRenderer> | null,
): Promise<{ contractId: string; attachmentId: string } | null> {
  return createContractDocumentServiceForBindings(primitives, bindings, documentRenderer).generate(
    db,
    eventBus,
    bookingId,
    options,
  )
}

export function resolveContractDocumentGenerator(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
  configuredRenderer?: DocumentRenderer | Promise<DocumentRenderer> | null,
): ContractDocumentGenerator | undefined {
  const storage = resolveStorage(primitives, bindings)
  if (!storage) return undefined

  return async (context) => {
    const renderer =
      (configuredRenderer ? await configuredRenderer : null) ??
      createHttpDocumentRendererFromEnv(primitives.env(bindings))
    if (renderer) {
      return createStorageBackedContractDocumentGenerator({
        storage,
        serializer: createRenderedPdfContractDocumentSerializer({ renderer }),
      })(context)
    }

    console.warn(
      "[legal] No documents.renderer port or VOYANT_DOCUMENT_RENDERER_URL configured; " +
        "using the basic pdf-lib contract serializer.",
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
  documentRenderer?: DocumentRenderer | Promise<DocumentRenderer> | null,
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
        documentRenderer,
      ),
    previewContract: (bindings, db, bookingId) =>
      createContractDocumentServiceForBindings(primitives, bindings, documentRenderer).preview(
        db as PostgresJsDatabase,
        bookingId,
      ),
    resolveGeneratedDocument: async (bindings, db, attachmentId) => {
      const attachment = await contractsService.getAttachmentById(
        db as PostgresJsDatabase,
        attachmentId,
      )
      if (!attachment?.storageKey) return null
      const url = await primitives.storage.downloadUrl(bindings, attachment.storageKey)
      if (!url) return null
      return {
        url,
        filename: attachment.name,
        contentType: attachment.mimeType,
      }
    },
    resolveStorage: (bindings) => resolveStorage(primitives, bindings),
    guessMimeType,
  }
}

function createBookingContractSubscriberHost(
  primitives: VoyantRuntimeHostPrimitives,
  documentRenderer?: DocumentRenderer | Promise<DocumentRenderer> | null,
): LegalBookingContractSubscriberHost {
  return {
    createRuntime(bindings): LegalBookingContractSubscriberRuntime | null {
      const documentGenerator = resolveContractDocumentGenerator(
        primitives,
        bindings,
        documentRenderer,
      )
      if (!documentGenerator) {
        console.error(
          "[legal] autoGenerateContractOnConfirmed.enabled=true but no documentGenerator resolved; skipping subscriber.",
        )
        return null
      }
      return {
        options: createDefaultAutoGenerateContractOptions(primitives),
        withDb: (runtimeBindings, operation) =>
          primitives.database.transaction(runtimeBindings, (db) =>
            operation(db as PostgresJsDatabase),
          ),
        documentGenerator,
        documentStorage: resolveStorage(primitives, bindings),
        resolveBookingPiiService: () => resolveBookingPiiService(primitives, bindings),
        resolveVariables: createDefaultAutoGenerateContractOptions(primitives).resolveVariables,
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
  documentRenderer?: DocumentRenderer | Promise<DocumentRenderer> | null,
) {
  return createContractDocumentService({
    resolveGenerator: () =>
      resolveContractDocumentGenerator(primitives, bindings, documentRenderer) ?? null,
    autoGenerateOptions: createDefaultAutoGenerateContractOptions(primitives),
    resolveBindings: () => primitives.env(bindings),
    resolveBookingPiiService: () => resolveBookingPiiService(primitives, bindings),
  })
}

function resolveStorage(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
): StorageProvider | null {
  return (
    (primitives.storage.resolve(bindings, "documents") as StorageProvider | null | undefined) ??
    null
  )
}

function arrayBufferDataUrl(body: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(body)
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768))
  }
  return `data:${mimeType};base64,${btoa(binary)}`
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
