import { buildBookingRouteRuntime, createBookingPiiService } from "@voyant-travel/bookings"
import type { EventBus } from "@voyant-travel/core"
import {
  type ContractDocumentGenerator,
  type ContractDocumentRoutesOptions,
  createContractDocumentRoutes,
} from "@voyant-travel/legal"
import { createContractDocumentService } from "@voyant-travel/legal/contract-document"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { tryGetCloudPdfClient } from "../../lib/voyant-cloud"
import { createDocumentStorage, guessMimeType } from "../lib/storage"
import {
  AUTO_GENERATE_CONTRACT_OPTIONS,
  contractVariableBindings,
  DEFAULT_CONTRACT_SERIES_NAME,
} from "./contract-document-variables"

export { AUTO_GENERATE_CONTRACT_OPTIONS } from "./contract-document-variables"

/**
 * Build the `ContractDocumentGenerator` configured for this template.
 * Used by both the legal module's `resolveDocumentGenerator` and by the
 * explicit `generate_contract_pdf` checkout-finalize step.
 *
 * The returned generator lazy-imports the concrete PDF/browser helpers so the
 * operator Hono app can assemble routes without loading the document rendering
 * implementation until a contract is actually generated.
 */
export function resolveContractDocumentGenerator(
  env: AppBindings,
): ContractDocumentGenerator | null {
  const storage = createDocumentStorage(env)
  if (!storage) return null

  return async (context) => {
    const cloud = tryGetCloudPdfClient(env)
    const legal = await import("@voyant-travel/legal")
    if (cloud) {
      const generator = legal.createStorageBackedContractDocumentGenerator({
        storage,
        serializer: legal.createBrowserRenderedPdfContractDocumentSerializer({
          cloudClient: cloud,
        }),
      })
      return generator(context)
    }

    // Local dev / no PDF-rendering key — fall back to the basic pdf-lib
    // serializer. Contract PDFs will be plain text but the worker boots and
    // downstream flows complete. Cloud deployments can keep using VOYANT_API_KEY
    // in voyant-cloud auth mode; local/self-hosted deployments should opt in
    // explicitly with VOYANT_CLOUD_PDF_API_KEY.
    console.warn(
      "[operator] VOYANT_CLOUD_PDF_API_KEY not set — using basic pdf-lib serializer. " +
        "Contract PDFs will be unstyled. Set the key to enable browser-rendered output.",
    )
    const generator = legal.createPdfContractDocumentGenerator({ storage })
    return generator(context)
  }
}

/**
 * Build the legal contract-document service wired with this deployment's
 * providers: the PDF generator (above), the runtime env bindings, and the
 * KMS-backed booking PII reader. The legal-domain orchestration (series
 * seeding, booking lookup, template render, contract-record persistence) lives
 * in `@voyant-travel/legal/contract-document`.
 */
function contractDocumentService(env: AppBindings) {
  return createContractDocumentService({
    resolveGenerator: () => resolveContractDocumentGenerator(env),
    autoGenerateOptions: AUTO_GENERATE_CONTRACT_OPTIONS,
    defaultSeriesName: DEFAULT_CONTRACT_SERIES_NAME,
    resolveBindings: () => contractVariableBindings(env),
    resolveBookingPiiService: () => createContractBookingPiiService(env),
  })
}

export function generateContractPdfForBooking(
  env: AppBindings,
  db: PostgresJsDatabase,
  eventBus: EventBus | undefined,
  bookingId: string,
  options: { force?: boolean } = {},
): Promise<{ contractId: string; attachmentId: string } | null> {
  return contractDocumentService(env).generate(db, eventBus, bookingId, options)
}

function previewContractForBooking(
  env: AppBindings,
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<{ html: string; templateName: string; templateLanguage: string } | null> {
  return contractDocumentService(env).preview(db, bookingId)
}

/**
 * Build the contract-document routes wired with this deployment's options.
 *
 * The route shapes live in `@voyant-travel/legal`; this supplies the
 * generator/preview (above), the private document storage resolver, and the
 * MIME guesser (from `./lib/storage`).
 */
export function buildContractDocumentRoutes() {
  const options: ContractDocumentRoutesOptions = {
    generateContract: (env, db, eventBus, bookingId, opts) =>
      generateContractPdfForBooking(
        env as AppBindings,
        db as PostgresJsDatabase,
        eventBus as EventBus | undefined,
        bookingId,
        opts,
      ),
    previewContract: (env, db, bookingId) =>
      previewContractForBooking(env as AppBindings, db as PostgresJsDatabase, bookingId),
    resolveStorage: (env) => createDocumentStorage(env as AppBindings),
    guessMimeType,
  }
  return createContractDocumentRoutes(options)
}

async function createContractBookingPiiService(env: AppBindings) {
  const runtime = buildBookingRouteRuntime(env)
  try {
    return createBookingPiiService({ kms: await runtime.getKmsProvider() })
  } catch {
    return null
  }
}
