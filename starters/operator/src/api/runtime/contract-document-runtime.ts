import { buildBookingRouteRuntime, createBookingPiiService } from "@voyant-travel/bookings"
import { bookings } from "@voyant-travel/bookings/schema"
import type { EventBus } from "@voyant-travel/core"
import {
  type ContractDocumentGenerator,
  type ContractDocumentRoutesOptions,
  createContractDocumentRoutes,
} from "@voyant-travel/legal"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { tryGetCloudClient } from "../../lib/voyant-cloud"
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
  env: CloudflareBindings,
): ContractDocumentGenerator | null {
  const storage = createDocumentStorage(env)
  if (!storage) return null

  return async (context) => {
    const cloud = tryGetCloudClient(env)
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

    // Local dev / no cloud key — fall back to the basic pdf-lib
    // serializer. Contract PDFs will be plain text but the worker
    // boots and downstream flows complete. Prod deploys MUST set
    // VOYANT_API_KEY.
    console.warn(
      "[operator] VOYANT_API_KEY not set — using basic pdf-lib serializer. " +
        "Contract PDFs will be unstyled. Set the key to enable browser-rendered output.",
    )
    const generator = legal.createPdfContractDocumentGenerator({ storage })
    return generator(context)
  }
}

export async function generateContractPdfForBooking(
  env: CloudflareBindings,
  db: PostgresJsDatabase,
  eventBus: EventBus | undefined,
  bookingId: string,
  options: { force?: boolean } = {},
): Promise<{ contractId: string; attachmentId: string } | null> {
  const generator = resolveContractDocumentGenerator(env)
  if (!generator) return null

  // Lazy seed — creates the default series on the first contract generation.
  await ensureDefaultContractSeries(db)

  const [bookingRow] = await db
    .select({ bookingNumber: bookings.bookingNumber })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!bookingRow) {
    throw new Error(`generateContractPdfForBooking: booking ${bookingId} not found`)
  }

  if (options.force) {
    await resetContractDocumentForBooking(db, bookingId)
  }

  const { autoGenerateContractForBooking } = await import("@voyant-travel/legal")
  const result = await autoGenerateContractForBooking(
    db,
    { bookingId, bookingNumber: bookingRow.bookingNumber, actorId: null },
    AUTO_GENERATE_CONTRACT_OPTIONS,
    {
      generator,
      eventBus,
      bindings: contractVariableBindings(env),
      bookingPiiService: await createContractBookingPiiService(env),
      actionLedgerContext: {
        actor: "system",
        callerType: "internal",
        isInternalRequest: true,
      },
    },
  )

  if (result.status === "ok") {
    return { contractId: result.contractId, attachmentId: result.attachmentId }
  }

  const reason = "reason" in result && typeof result.reason === "string" ? result.reason : "unknown"
  throw new Error(
    `Contract PDF generation failed: ${result.status} (${reason}). ` +
      "Check wrangler logs for the underlying generator error " +
      "(Cloud SDK call, R2 upload, or template render).",
  )
}

export async function previewContractForBooking(
  env: CloudflareBindings,
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<{ html: string; templateName: string; templateLanguage: string } | null> {
  const generator = resolveContractDocumentGenerator(env)
  const previewGenerator: ContractDocumentGenerator =
    generator ??
    (() => {
      throw new Error("Contract document generator not configured")
    })

  const [bookingRow] = await db
    .select({ bookingNumber: bookings.bookingNumber })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!bookingRow) {
    throw new Error(`previewContractForBooking: booking ${bookingId} not found`)
  }

  const { autoGenerateContractForBooking } = await import("@voyant-travel/legal")
  const result = await autoGenerateContractForBooking(
    db,
    { bookingId, bookingNumber: bookingRow.bookingNumber, actorId: null },
    { ...AUTO_GENERATE_CONTRACT_OPTIONS, previewMode: true },
    {
      generator: previewGenerator,
      bindings: contractVariableBindings(env),
      bookingPiiService: await createContractBookingPiiService(env),
      actionLedgerContext: {
        actor: "system",
        callerType: "internal",
        isInternalRequest: true,
      },
    },
  )

  if (result.status === "preview") {
    return {
      html: result.html,
      templateName: result.templateName,
      templateLanguage: result.templateLanguage,
    }
  }

  if (result.status === "template_not_found" || result.status === "template_version_missing") {
    return null
  }

  const reason = "reason" in result && typeof result.reason === "string" ? result.reason : "unknown"
  throw new Error(`Contract preview failed: ${result.status} (${reason})`)
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
        env as CloudflareBindings,
        db as PostgresJsDatabase,
        eventBus as EventBus | undefined,
        bookingId,
        opts,
      ),
    previewContract: (env, db, bookingId) =>
      previewContractForBooking(env as CloudflareBindings, db as PostgresJsDatabase, bookingId),
    resolveStorage: (env) => createDocumentStorage(env as CloudflareBindings),
    guessMimeType,
  }
  return createContractDocumentRoutes(options)
}

async function createContractBookingPiiService(env: CloudflareBindings) {
  const runtime = buildBookingRouteRuntime(env)
  try {
    return createBookingPiiService({ kms: await runtime.getKmsProvider() })
  } catch {
    return null
  }
}

async function ensureDefaultContractSeries(db: PostgresJsDatabase): Promise<void> {
  const { contractsService } = await import("@voyant-travel/legal/contracts")
  const existing = await contractsService.findSeriesByName(db, DEFAULT_CONTRACT_SERIES_NAME)
  if (existing) return
  try {
    await contractsService.createSeries(db, {
      name: DEFAULT_CONTRACT_SERIES_NAME,
      prefix: `CTR-${new Date().getFullYear()}-`,
      separator: "",
      padLength: 5,
      resetStrategy: "never",
      scope: "customer",
      active: true,
    })
  } catch (err) {
    console.warn("[operator] ensureDefaultContractSeries failed", err)
  }
}

async function resetContractDocumentForBooking(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<void> {
  const { contractsService } = await import("@voyant-travel/legal/contracts")
  const { contracts: contractsTable } = await import("@voyant-travel/legal/schema")
  const existing = await contractsService.listContracts(db, { bookingId, limit: 25, offset: 0 })
  for (const contract of existing.data) {
    const attachments = await contractsService.listAttachments(db, contract.id)
    for (const attachment of attachments) {
      if (attachment.kind === "document") {
        await contractsService.deleteAttachment(db, attachment.id)
      }
    }
    await db
      .update(contractsTable)
      .set({ renderedBody: null, updatedAt: new Date() })
      .where(eq(contractsTable.id, contract.id))
  }
}
