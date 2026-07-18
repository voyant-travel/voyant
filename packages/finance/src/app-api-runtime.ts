import { bookings } from "@voyant-travel/bookings/schema"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type {
  FinanceAppApiExternalReference,
  FinanceAppApiExternalReferenceUpsertInput,
  FinanceAppApiExternalSyncMutationResult,
  FinanceAppApiExternalSyncState,
  FinanceAppApiExternalSyncStateInput,
  FinanceAppApiIssuanceDocument,
  FinanceAppApiPdfArtifact,
  FinanceAppApiPdfArtifactMutationResult,
  FinanceAppApiReferenceMutationResult,
  FinanceAppApiRuntime,
} from "@voyant-travel/finance-contracts/app-api"
import { FinanceAppApiNumberConflictError } from "@voyant-travel/finance-contracts/app-api"
import type { StorageProvider } from "@voyant-travel/storage"
import { and, asc, eq, sql } from "drizzle-orm"
import {
  invoiceExternalRefs,
  invoiceExternalSyncObservations,
  invoiceLineItems,
  invoiceNumberSeries,
  invoiceRenditions,
  invoices,
  taxRegimes,
} from "./schema.js"
import { financeService } from "./service.js"
import { buildInvoiceIssuedEvent } from "./service-issue.js"
import { InvoiceNumberConflictError, toRows } from "./service-shared.js"

type ArtifactRuntimePrimitives = Pick<VoyantRuntimeHostPrimitives, "storage">

export function createFinanceAppApiRuntime(
  primitives?: ArtifactRuntimePrimitives,
): FinanceAppApiRuntime {
  return {
    async getIssuanceDocument(db, documentId) {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, documentId)).limit(1)
      if (!invoice || invoice.invoiceType === "credit_note") return null

      const [[booking], [series], [taxRegime], lines, issuedEvent] = await Promise.all([
        db.select().from(bookings).where(eq(bookings.id, invoice.bookingId)).limit(1),
        invoice.seriesId
          ? db
              .select()
              .from(invoiceNumberSeries)
              .where(eq(invoiceNumberSeries.id, invoice.seriesId))
              .limit(1)
          : Promise.resolve([]),
        invoice.taxRegimeId
          ? db.select().from(taxRegimes).where(eq(taxRegimes.id, invoice.taxRegimeId)).limit(1)
          : Promise.resolve([]),
        db
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, documentId))
          .orderBy(asc(invoiceLineItems.sortOrder)),
        buildInvoiceIssuedEvent(db, invoice),
      ])

      return {
        id: invoice.id,
        documentType: invoice.invoiceType,
        number: invoice.invoiceNumber,
        status: invoice.status,
        booking: { id: invoice.bookingId, number: booking?.bookingNumber ?? null },
        billing: {
          name:
            [booking?.contactFirstName, booking?.contactLastName].filter(Boolean).join(" ") ||
            "Customer",
          email: booking?.contactEmail ?? null,
          phone: booking?.contactPhone ?? null,
          address:
            [booking?.contactAddressLine1, booking?.contactAddressLine2]
              .filter(Boolean)
              .join("\n") || null,
          city: booking?.contactCity ?? null,
          region: booking?.contactRegion ?? null,
          country: booking?.contactCountry ?? null,
          vatCode: booking?.contactTaxId ?? null,
          registrationNumber: null,
        },
        currency: { document: invoice.currency, base: invoice.baseCurrency },
        fx: buildHydratedFx(invoice, issuedEvent),
        totals: {
          subtotalCents: invoice.subtotalCents,
          taxCents: invoice.taxCents,
          totalCents: invoice.totalCents,
        },
        dates: { issuedOn: invoice.issueDate, dueOn: invoice.dueDate },
        language: invoice.language,
        taxRegime: taxRegime
          ? {
              id: taxRegime.id,
              code: taxRegime.code,
              name: taxRegime.name,
              legalReference: taxRegime.legalReference,
              specialRegime: !["standard", "reduced"].includes(taxRegime.code),
              marginSchemeArticle311: taxRegime.code === "margin_scheme_art311",
            }
          : null,
        series: series
          ? {
              id: series.id,
              code: series.code,
              name: series.name,
              scope: series.scope,
            }
          : null,
        allocation: {
          required: Boolean(series?.externalProvider),
          pending: invoice.status === "pending_external_allocation",
          placeholderNumber:
            invoice.status === "pending_external_allocation" ? invoice.invoiceNumber : null,
        },
        lines: lines.map((line, index) => {
          const projectedLine = issuedEvent.lineItems?.[index]
          return {
            id: line.id,
            description: line.description,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            totalCents: line.totalCents,
            tax: {
              ratePercent: projectedLine?.taxPercentage ?? line.taxRate,
              name: projectedLine?.taxName ?? null,
              regimeCode: projectedLine?.taxRegimeCode ?? null,
            },
          }
        }),
      } satisfies FinanceAppApiIssuanceDocument
    },

    async getExternalReference(db, documentId, provider) {
      const [row] = await db
        .select()
        .from(invoiceExternalRefs)
        .where(
          and(
            eq(invoiceExternalRefs.invoiceId, documentId),
            eq(invoiceExternalRefs.provider, provider),
          ),
        )
        .limit(1)
      return row ? mapExternalReference(row) : null
    },

    async upsertExternalReference(db, documentId, provider, input) {
      const locked = toRows<{
        invoice_number: string
        series_id: string | null
        status: string
      }>(
        await db.execute(
          // agent-quality: raw-sql reviewed -- identifiers are static and values are bound.
          sql`SELECT invoice_number, series_id, status FROM invoices WHERE id = ${documentId} FOR UPDATE`,
        ),
      )[0]
      if (!locked) return { status: "not_found" }

      let allocationOutcome: "not_requested" | "applied" | "already_applied" = "not_requested"
      if (input.allocation) {
        if (locked.status !== "pending_external_allocation") {
          if (locked.invoice_number !== input.allocation.invoiceNumber) {
            return {
              status: "allocation_conflict",
              currentNumber: locked.invoice_number,
              currentStatus: locked.status,
            }
          }
          allocationOutcome = "already_applied"
        } else {
          const series = toRows<{ external_provider: string | null }>(
            await db.execute(
              // agent-quality: raw-sql reviewed -- identifiers are static and values are bound.
              sql`SELECT external_provider FROM invoice_number_series WHERE id = ${locked.series_id} FOR UPDATE`,
            ),
          )[0]
          if (!series || series.external_provider !== provider) {
            return {
              status: "allocation_conflict",
              currentNumber: locked.invoice_number,
              currentStatus: locked.status,
            }
          }

          try {
            const allocation = await financeService.applyExternalInvoiceAllocation(db, documentId, {
              invoiceNumber: input.allocation.invoiceNumber,
            })
            if (allocation.status === "not_found") return { status: "not_found" }
            if (allocation.status === "not_pending_external_allocation") {
              return {
                status: "allocation_conflict",
                currentNumber: allocation.invoice.invoiceNumber,
                currentStatus: allocation.invoice.status,
              }
            }
            allocationOutcome = "applied"
          } catch (error) {
            if (error instanceof InvoiceNumberConflictError) {
              throw new FinanceAppApiNumberConflictError(input.allocation.invoiceNumber)
            }
            throw error
          }
        }
      }

      const [existing] = await db
        .select()
        .from(invoiceExternalRefs)
        .where(
          and(
            eq(invoiceExternalRefs.invoiceId, documentId),
            eq(invoiceExternalRefs.provider, provider),
          ),
        )
        .limit(1)
      const referenceOutcome = existing
        ? referenceMatches(existing, input.reference)
          ? "unchanged"
          : "updated"
        : "created"
      const row =
        referenceOutcome === "unchanged"
          ? existing
          : await financeService.registerInvoiceExternalRef(db, documentId, {
              provider,
              ...input.reference,
            })
      if (!row) return { status: "not_found" }
      return {
        status: "ok",
        reference: mapExternalReference(row),
        referenceOutcome,
        allocationOutcome,
      } satisfies FinanceAppApiReferenceMutationResult
    },

    async attachPdfArtifact(db, environment, documentId, provider, input) {
      const checksum = await sha256(input.bytes)
      const idempotencyDigest = await sha256(new TextEncoder().encode(input.idempotencyKey))
      const existing = await findAppArtifact(db, documentId, provider, idempotencyDigest)
      if (existing) return replayArtifact(existing, checksum, input.fileName)

      const storage = primitives?.storage.resolve(environment, "documents") as
        | StorageProvider
        | null
        | undefined
      if (!storage) return { status: "not_configured" }

      const requestedStorageKey = await artifactStorageKey(
        documentId,
        provider,
        input.idempotencyKey,
        checksum,
      )
      let uploaded: Awaited<ReturnType<StorageProvider["upload"]>>
      try {
        uploaded = await storage.upload(input.bytes, {
          key: requestedStorageKey,
          contentType: input.contentType,
          metadata: {
            documentId,
            provider,
            checksum,
          },
        })
      } catch (error) {
        await bestEffortDelete(storage, requestedStorageKey)
        throw error
      }
      const storageKey = uploaded.key

      try {
        const result = await financeService.bindInvoiceRendition(db, documentId, {
          format: "pdf",
          contentType: input.contentType,
          storageKey,
          fileSize: input.bytes.byteLength,
          checksum,
          generatedAt: new Date().toISOString(),
          appProvider: provider,
          appIdempotencyDigest: idempotencyDigest,
          appFileName: input.fileName,
          metadata: { source: "remote_app" },
        })
        if (result.status === "not_found") {
          await bestEffortDelete(storage, storageKey)
          return { status: "not_found" }
        }
        return {
          status: "ok",
          outcome: "created",
          artifact: mapPdfArtifact(result.rendition, provider),
        } satisfies FinanceAppApiPdfArtifactMutationResult
      } catch (error) {
        const raced = await findAppArtifact(db, documentId, provider, idempotencyDigest)
        if (raced) {
          if (raced.storageKey !== storageKey) await bestEffortDelete(storage, storageKey)
          return replayArtifact(raced, checksum, input.fileName)
        }
        await bestEffortDelete(storage, storageKey)
        throw error
      }
    },

    async updateExternalSyncState(db, documentId, provider, input) {
      const locked = toRows<{ id: string }>(
        await db.execute(
          // agent-quality: raw-sql reviewed -- identifiers are static and values are bound.
          sql`SELECT id FROM invoices WHERE id = ${documentId} FOR UPDATE`,
        ),
      )[0]
      if (!locked) return { status: "not_found" }

      const [replay] = await db
        .select()
        .from(invoiceExternalSyncObservations)
        .where(
          and(
            eq(invoiceExternalSyncObservations.invoiceId, documentId),
            eq(invoiceExternalSyncObservations.provider, provider),
            eq(invoiceExternalSyncObservations.operationId, input.operationId),
          ),
        )
        .limit(1)
      if (replay) {
        const replayState = mapExternalSyncObservation(replay)
        return syncStateMatches(replayState, input)
          ? { status: "ok", outcome: "unchanged", sync: replayState }
          : {
              status: "conflict",
              reason: "idempotency_key_reused",
              current: replayState,
            }
      }

      const [existing] = await db
        .select()
        .from(invoiceExternalRefs)
        .where(
          and(
            eq(invoiceExternalRefs.invoiceId, documentId),
            eq(invoiceExternalRefs.provider, provider),
          ),
        )
        .limit(1)

      const current = existing ? mapExternalSyncState(existing) : null
      if (
        current &&
        new Date(current.occurredAt).getTime() >= new Date(input.occurredAt).getTime()
      ) {
        return { status: "conflict", reason: "out_of_order", current }
      }

      await db.insert(invoiceExternalSyncObservations).values({
        invoiceId: documentId,
        provider,
        operationId: input.operationId,
        status: input.status,
        occurredAt: new Date(input.occurredAt),
        errorCode: input.error?.code ?? null,
        errorMessage: input.error?.message ?? null,
        metadata: input.metadata,
      })
      const values = syncStateValues(input)
      const [row] = existing
        ? await db
            .update(invoiceExternalRefs)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(invoiceExternalRefs.id, existing.id))
            .returning()
        : await db
            .insert(invoiceExternalRefs)
            .values({ invoiceId: documentId, provider, ...values })
            .returning()
      if (!row) return { status: "not_found" }
      const sync = mapExternalSyncState(row)
      if (!sync) {
        throw new Error("Persisted external sync state is incomplete.")
      }
      return {
        status: "ok",
        outcome: existing ? "updated" : "created",
        sync,
      } satisfies FinanceAppApiExternalSyncMutationResult
    },
  }
}

function buildHydratedFx(
  invoice: typeof invoices.$inferSelect,
  issuedEvent: Awaited<ReturnType<typeof buildInvoiceIssuedEvent>>,
): FinanceAppApiIssuanceDocument["fx"] {
  if (!invoice.baseCurrency || invoice.baseCurrency === invoice.currency) return null
  const persistedRate = derivePersistedFxRate(invoice)
  return {
    rateSetId: issuedEvent.fxRateSetId ?? invoice.fxRateSetId,
    rate: issuedEvent.fxRate ?? persistedRate,
    effectiveRate: issuedEvent.effectiveRate ?? persistedRate,
    source: issuedEvent.fxRateSource ?? null,
    quotedAt: issuedEvent.fxRateQuotedAt ?? null,
    validUntil: issuedEvent.fxRateValidUntil ?? null,
    commissionBasisPoints: issuedEvent.fxCommissionBps ?? null,
    invoiceMention: issuedEvent.fxCommissionInvoiceMention ?? null,
  }
}

function derivePersistedFxRate(invoice: typeof invoices.$inferSelect): number | null {
  const pairs = [
    [invoice.baseTotalCents, invoice.totalCents],
    [invoice.baseSubtotalCents, invoice.subtotalCents],
  ] as const
  for (const [baseAmount, documentAmount] of pairs) {
    if (baseAmount != null && documentAmount > 0) return baseAmount / documentAmount
  }
  return null
}

function mapExternalReference(
  row: typeof invoiceExternalRefs.$inferSelect,
): FinanceAppApiExternalReference {
  return {
    id: row.id,
    documentId: row.invoiceId,
    provider: row.provider,
    externalId: row.externalId,
    externalNumber: row.externalNumber,
    externalUrl: row.externalUrl,
    status: row.status,
    metadata: isRecord(row.metadata) ? row.metadata : null,
    syncedAt: row.syncedAt?.toISOString() ?? null,
    syncError: row.syncError,
    sync: mapExternalSyncState(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapExternalSyncState(
  row: typeof invoiceExternalRefs.$inferSelect,
): FinanceAppApiExternalSyncState | null {
  if (!isExternalSyncStatus(row.syncState) || !row.syncOperationId || !row.syncOccurredAt) {
    return null
  }
  return {
    provider: row.provider,
    documentId: row.invoiceId,
    operationId: row.syncOperationId,
    status: row.syncState,
    occurredAt: row.syncOccurredAt.toISOString(),
    error:
      row.syncErrorCode && row.syncErrorMessage
        ? { code: row.syncErrorCode, message: row.syncErrorMessage }
        : null,
    metadata: isRecord(row.syncMetadata) ? row.syncMetadata : null,
  }
}

function mapExternalSyncObservation(
  row: typeof invoiceExternalSyncObservations.$inferSelect,
): FinanceAppApiExternalSyncState {
  if (!isExternalSyncStatus(row.status)) {
    throw new Error("Persisted external sync observation has an invalid status.")
  }
  return {
    provider: row.provider,
    documentId: row.invoiceId,
    operationId: row.operationId,
    status: row.status,
    occurredAt: row.occurredAt.toISOString(),
    error:
      row.errorCode && row.errorMessage ? { code: row.errorCode, message: row.errorMessage } : null,
    metadata: isRecord(row.metadata) ? row.metadata : null,
  }
}

function syncStateValues(input: FinanceAppApiExternalSyncStateInput) {
  return {
    syncState: input.status,
    syncOperationId: input.operationId,
    syncOccurredAt: new Date(input.occurredAt),
    syncErrorCode: input.error?.code ?? null,
    syncErrorMessage: input.error?.message ?? null,
    syncMetadata: input.metadata,
    syncedAt: input.status === "succeeded" ? new Date(input.occurredAt) : null,
  }
}

function syncStateMatches(
  current: FinanceAppApiExternalSyncState,
  input: FinanceAppApiExternalSyncStateInput,
) {
  return (
    current.status === input.status &&
    new Date(current.occurredAt).getTime() === new Date(input.occurredAt).getTime() &&
    current.error?.code === input.error?.code &&
    current.error?.message === input.error?.message &&
    canonicalJson(current.metadata) === canonicalJson(input.metadata)
  )
}

function isExternalSyncStatus(
  value: string | null,
): value is FinanceAppApiExternalSyncState["status"] {
  return ["succeeded", "retryable_failure", "terminal_failure"].includes(value ?? "")
}

async function findAppArtifact(
  db: Parameters<FinanceAppApiRuntime["attachPdfArtifact"]>[0],
  documentId: string,
  provider: string,
  idempotencyDigest: string,
) {
  const [row] = await db
    .select()
    .from(invoiceRenditions)
    .where(
      and(
        eq(invoiceRenditions.invoiceId, documentId),
        eq(invoiceRenditions.appProvider, provider),
        eq(invoiceRenditions.appIdempotencyDigest, idempotencyDigest),
      ),
    )
    .limit(1)
  return row ?? null
}

function replayArtifact(
  row: typeof invoiceRenditions.$inferSelect,
  checksum: string,
  fileName: string,
): FinanceAppApiPdfArtifactMutationResult {
  if (row.checksum !== checksum || row.appFileName !== fileName) {
    return { status: "conflict", reason: "idempotency_key_reused" }
  }
  return {
    status: "ok",
    outcome: "unchanged",
    artifact: mapPdfArtifact(row, row.appProvider ?? ""),
  }
}

function mapPdfArtifact(
  row: typeof invoiceRenditions.$inferSelect,
  provider: string,
): FinanceAppApiPdfArtifact {
  return {
    id: row.id,
    documentId: row.invoiceId,
    provider,
    fileName: row.appFileName ?? "document.pdf",
    byteSize: row.fileSize ?? 0,
    checksum: row.checksum ?? "",
    createdAt: row.createdAt.toISOString(),
  }
}

async function artifactStorageKey(
  documentId: string,
  provider: string,
  idempotencyKey: string,
  checksum: string,
) {
  const providerHash = (await sha256(new TextEncoder().encode(provider))).slice(0, 24)
  const documentHash = (await sha256(new TextEncoder().encode(documentId))).slice(0, 24)
  const replayHash = (await sha256(new TextEncoder().encode(idempotencyKey))).slice(0, 24)
  return `finance/app-artifacts/${providerHash}/${documentHash}/${replayHash}-${crypto.randomUUID()}-${checksum}.pdf`
}

async function sha256(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function bestEffortDelete(storage: StorageProvider, key: string) {
  try {
    await storage.delete(key)
  } catch {
    // Compensation is best effort; an unbound key remains unreachable through
    // every Voyant document route and must never replace the persistence error.
  }
}

function referenceMatches(
  existing: typeof invoiceExternalRefs.$inferSelect,
  input: FinanceAppApiExternalReferenceUpsertInput["reference"],
) {
  return (
    existing.externalId === (input.externalId ?? null) &&
    existing.externalNumber === (input.externalNumber ?? null) &&
    existing.externalUrl === (input.externalUrl ?? null) &&
    existing.status === (input.status ?? null) &&
    canonicalJson(existing.metadata) === canonicalJson(input.metadata ?? null) &&
    (existing.syncedAt?.toISOString() ?? null) === (input.syncedAt ?? null) &&
    existing.syncError === (input.syncError ?? null)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "undefined"
}
