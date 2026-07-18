import { bookings } from "@voyant-travel/bookings/schema"
import type {
  FinanceAppApiExternalReference,
  FinanceAppApiExternalReferenceUpsertInput,
  FinanceAppApiIssuanceDocument,
  FinanceAppApiReferenceMutationResult,
  FinanceAppApiRuntime,
} from "@voyant-travel/finance-contracts/app-api"
import { FinanceAppApiNumberConflictError } from "@voyant-travel/finance-contracts/app-api"
import { and, asc, eq, sql } from "drizzle-orm"
import {
  invoiceExternalRefs,
  invoiceLineItems,
  invoiceNumberSeries,
  invoices,
  taxRegimes,
} from "./schema.js"
import { financeService } from "./service.js"
import { buildInvoiceIssuedEvent } from "./service-issue.js"
import { InvoiceNumberConflictError, toRows } from "./service-shared.js"

export function createFinanceAppApiRuntime(): FinanceAppApiRuntime {
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
      const locked = toRows<{ invoice_number: string; status: string }>(
        await db.execute(
          // agent-quality: raw-sql reviewed -- identifiers are static and values are bound.
          sql`SELECT invoice_number, status FROM invoices WHERE id = ${documentId} FOR UPDATE`,
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
    JSON.stringify(existing.metadata) === JSON.stringify(input.metadata ?? null) &&
    (existing.syncedAt?.toISOString() ?? null) === (input.syncedAt ?? null) &&
    existing.syncError === (input.syncError ?? null)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
