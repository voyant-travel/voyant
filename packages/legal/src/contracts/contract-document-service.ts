/**
 * Contract-document generation orchestration, owned by the legal module.
 *
 * Generating a booking's contract PDF is a fixed legal-domain pipeline:
 *
 *   1. resolve the document generator (deployment-supplied),
 *   2. resolve the operator-authored default contract number series,
 *   3. look up the booking's number,
 *   4. (optional) reset any prior rendered document for a forced regenerate,
 *   5. run `autoGenerateContractForBooking` (template lookup → variable
 *      binding → PDF render → contract-record persistence), and
 *   6. return the persisted `{ contractId, attachmentId }` (or the preview
 *      HTML for `previewMode`).
 *
 * That sequence is framework (legal) logic and lives here so every
 * deployment doesn't re-own it. The genuinely deployment-specific inputs are
 * injected via `ContractDocumentServiceOptions`:
 *
 *   - `resolveGenerator()` — the concrete PDF engine + document storage
 *     (object storage / browser-rendering / pdf-lib). Returns `null` when storage isn't
 *     configured, which surfaces as a `null` generate result (→ 503).
 *   - `autoGenerateOptions` — the `AutoGenerateContractOptions` carrying the
 *     template slug / scope / series identity and the operator-injected
 *     `resolveVariables` binding (see `buildContractVariableBindings`).
 *   - `defaultSeries` — an optional legacy compatibility seed. Standard
 *     deployments omit it and require an operator-configured default series.
 *   - `resolveBindings()` — the runtime env bindings forwarded into
 *     `resolveVariables` (e.g. `DOCUMENTS_BASE_URL`).
 *   - `resolveBookingPiiService()` — the deployment's KMS-backed traveler
 *     PII reader (or `null`).
 *
 * legal already depends (acyclically) on `@voyant-travel/bookings` (for the
 * booking-number lookup) and owns the contract series / attachment service,
 * so no new dependency or cycle is introduced.
 */

import type { BookingPiiService } from "@voyant-travel/bookings"
import { bookings } from "@voyant-travel/bookings/schema"
import type { EventBus } from "@voyant-travel/core"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { contractsService } from "./service.js"
import {
  type AutoGenerateContractOptions,
  autoGenerateContractForBooking,
} from "./service-auto-generate.js"
import type { ContractSeriesIdentity } from "./service-auto-generate-types.js"
import type { ContractDocumentGenerator } from "./service-documents.js"

export interface DefaultContractSeries extends ContractSeriesIdentity {
  name: string
}

/**
 * Deployment-supplied dependencies for the contract-document service. Keeps the
 * legal package free of operator types / CloudflareBindings — the deployment
 * closes over its concrete `env` inside these callbacks.
 */
export interface ContractDocumentServiceOptions {
  /**
   * Resolve the document generator (PDF engine + storage backend). Returns
   * `null` when document storage isn't configured — `generateContractPdfForBooking`
   * then returns `null` so the route can answer 503.
   */
  resolveGenerator(): ContractDocumentGenerator | null
  /**
   * The auto-generate options (template slug, scope, series identity, and the
   * operator-injected `resolveVariables` binding).
   */
  autoGenerateOptions: AutoGenerateContractOptions
  /** @deprecated Legacy compatibility seed. Standard deployments omit this. */
  defaultSeries?: DefaultContractSeries
  /**
   * Runtime env bindings forwarded into `resolveVariables` (e.g.
   * `DOCUMENTS_BASE_URL`, `APP_URL`). Optional.
   */
  resolveBindings?(): Record<string, unknown> | null
  /** Resolve the KMS-backed traveler PII reader (or `null`). Optional. */
  resolveBookingPiiService?(): Promise<BookingPiiService | null> | BookingPiiService | null
}

export interface ContractDocumentService {
  generate(
    db: PostgresJsDatabase,
    eventBus: EventBus | undefined,
    bookingId: string,
    options?: { force?: boolean },
  ): Promise<{ contractId: string; attachmentId: string } | null>
  preview(
    db: PostgresJsDatabase,
    bookingId: string,
  ): Promise<{ html: string; templateName: string; templateLanguage: string } | null>
}

const SYSTEM_ACTION_LEDGER_CONTEXT = {
  actor: "system",
  callerType: "internal",
  isInternalRequest: true,
} as const

/**
 * Build a contract-document service bound to a deployment's providers. The
 * returned `generate` / `preview` methods run the legal-domain pipeline using
 * the injected PDF generator, env bindings, and PII reader.
 */
export function createContractDocumentService(
  options: ContractDocumentServiceOptions,
): ContractDocumentService {
  const {
    resolveGenerator,
    autoGenerateOptions,
    defaultSeries,
    resolveBindings,
    resolveBookingPiiService,
  } = options

  async function bindings(): Promise<Record<string, unknown> | null> {
    return resolveBindings?.() ?? null
  }

  async function bookingPiiService(): Promise<BookingPiiService | null> {
    return (await resolveBookingPiiService?.()) ?? null
  }

  return {
    async generate(db, eventBus, bookingId, opts = {}) {
      const generator = resolveGenerator()
      if (!generator) return null

      // Compatibility only: standard deployments never synthesize operator
      // numbering policy and instead resolve the persisted default series.
      if (defaultSeries) await ensureDefaultContractSeries(db, defaultSeries)

      const [bookingRow] = await db
        .select({ bookingNumber: bookings.bookingNumber })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)
      if (!bookingRow) {
        throw new Error(`generateContractPdfForBooking: booking ${bookingId} not found`)
      }

      if (opts.force) {
        await resetContractDocumentForBooking(db, bookingId)
      }

      const result = await autoGenerateContractForBooking(
        db,
        { bookingId, bookingNumber: bookingRow.bookingNumber, actorId: null },
        autoGenerateOptions,
        {
          generator,
          eventBus,
          bindings: await bindings(),
          bookingPiiService: await bookingPiiService(),
          actionLedgerContext: SYSTEM_ACTION_LEDGER_CONTEXT,
        },
      )

      if (result.status === "ok") {
        return { contractId: result.contractId, attachmentId: result.attachmentId }
      }

      const reason =
        "reason" in result && typeof result.reason === "string" ? result.reason : "unknown"
      throw new Error(
        `Contract PDF generation failed: ${result.status} (${reason}). ` +
          "Check wrangler logs for the underlying generator error " +
          "(Cloud SDK call, storage upload, or template render).",
      )
    },

    async preview(db, bookingId) {
      const generator = resolveGenerator()
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

      const result = await autoGenerateContractForBooking(
        db,
        { bookingId, bookingNumber: bookingRow.bookingNumber, actorId: null },
        { ...autoGenerateOptions, previewMode: true },
        {
          generator: previewGenerator,
          bindings: await bindings(),
          bookingPiiService: await bookingPiiService(),
          actionLedgerContext: SYSTEM_ACTION_LEDGER_CONTEXT,
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

      const reason =
        "reason" in result && typeof result.reason === "string" ? result.reason : "unknown"
      throw new Error(`Contract preview failed: ${result.status} (${reason})`)
    },
  }
}

/**
 * Lazy-seed the default contract number series by its canonical `(prefix,
 * scope)` identity. Swallows insert races so concurrent first-generation
 * requests do not fail.
 */
export async function ensureDefaultContractSeries(
  db: PostgresJsDatabase,
  series: DefaultContractSeries,
): Promise<void> {
  const existing = await contractsService.findActiveByPrefixScope(db, series.prefix, series.scope)
  if (existing) return
  try {
    await contractsService.createSeries(db, {
      name: series.name,
      prefix: series.prefix,
      separator: "",
      padLength: 5,
      resetStrategy: "never",
      scope: series.scope,
      active: true,
    })
  } catch (err) {
    console.warn("[legal] ensureDefaultContractSeries failed", err)
  }
}

/**
 * Reset the rendered document for a booking's existing contracts so a forced
 * regenerate produces a fresh attachment. Deletes prior `document` attachments
 * and clears `renderedBody`.
 */
export async function resetContractDocumentForBooking(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<void> {
  const { contracts: contractsTable } = await import("./schema.js")
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
