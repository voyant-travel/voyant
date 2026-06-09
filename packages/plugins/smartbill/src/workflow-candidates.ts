import { financeService, type Invoice, invoiceNumberSeries, invoices } from "@voyantjs/finance"
import { and, desc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type {
  SmartbillReferenceParts,
  SmartbillWorkflowDocumentType,
  SmartbillWorkflowExternalRef,
  SmartbillWorkflowInvoice,
} from "./workflows.js"

export type SmartbillWorkflowCandidateSource = "external_refs" | "invoices"

export interface SmartbillCandidateInvoice {
  invoiceId: string
  invoiceNumber: string
  invoiceType?: Invoice["invoiceType"]
  documentType?: SmartbillWorkflowDocumentType
  companyVatCode?: string | null
  seriesName?: string | null
  series?: string | null
  number?: string | null
  sequence?: number | null
  status?: Invoice["status"]
  currency?: string | null
  totalCents?: number | null
  paidCents?: number | null
  balanceDueCents?: number | null
  metadata?: Record<string, unknown> | null
}

export interface SmartbillCandidateExternalRefRecorderContext {
  candidate: SmartbillCandidateInvoice
  document: SmartbillReferenceParts
  ref: SmartbillWorkflowExternalRef
}

export type SmartbillCandidateExternalRefRecorder = (
  context: SmartbillCandidateExternalRefRecorderContext,
) => Promise<SmartbillWorkflowExternalRef | null | undefined>

export interface SmartbillCandidateSourceOptions {
  db?: PostgresJsDatabase
  limit?: number
  companyVatCode?: string
  listCandidateInvoices?: () => Promise<SmartbillCandidateInvoice[]>
  recordCandidateExternalRef?: SmartbillCandidateExternalRefRecorder
}

export async function loadSmartbillCandidateRefs(
  options: SmartbillCandidateSourceOptions,
): Promise<SmartbillWorkflowExternalRef[]> {
  const candidates = options.listCandidateInvoices
    ? await options.listCandidateInvoices()
    : await loadDbCandidateInvoices(options)
  const refs: SmartbillWorkflowExternalRef[] = []

  for (const candidate of candidates) {
    const document = resolveCandidateReferenceParts(candidate, options.companyVatCode)
    const ref = toCandidateWorkflowExternalRef(candidate, document)
    refs.push(document ? await recordCandidateExternalRef(options, candidate, document, ref) : ref)
  }

  return refs
}

async function loadDbCandidateInvoices(
  options: SmartbillCandidateSourceOptions,
): Promise<SmartbillCandidateInvoice[]> {
  if (!options.db) {
    throw new Error("SmartBill invoice candidate source requires db or listCandidateInvoices")
  }

  const rows = await options.db
    .select({
      invoice: {
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceType: invoices.invoiceType,
        status: invoices.status,
        currency: invoices.currency,
        totalCents: invoices.totalCents,
        paidCents: invoices.paidCents,
        balanceDueCents: invoices.balanceDueCents,
        sequence: invoices.sequence,
      },
      seriesName: invoiceNumberSeries.externalConfigKey,
    })
    .from(invoices)
    .leftJoin(invoiceNumberSeries, eq(invoices.seriesId, invoiceNumberSeries.id))
    .where(
      and(
        inArray(invoices.invoiceType, ["invoice", "proforma"]),
        inArray(invoices.status, ["issued", "partially_paid", "paid", "overdue"]),
      ),
    )
    .orderBy(desc(invoices.createdAt))
    .limit(options.limit ?? 500)

  return rows
    .filter((row) => !isPendingExternalAllocationPlaceholder(row.invoice.invoiceNumber))
    .map((row) => ({
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      invoiceType: row.invoice.invoiceType,
      documentType: row.invoice.invoiceType === "proforma" ? "proforma" : "invoice",
      seriesName: row.seriesName,
      sequence: row.invoice.sequence,
      status: row.invoice.status,
      currency: row.invoice.currency,
      totalCents: row.invoice.totalCents,
      paidCents: row.invoice.paidCents,
      balanceDueCents: row.invoice.balanceDueCents,
    }))
}

function resolveCandidateReferenceParts(
  candidate: SmartbillCandidateInvoice,
  fallbackCompanyVatCode?: string,
): SmartbillReferenceParts | null {
  const metadata = candidate.metadata ?? null
  const parsed = parseInvoiceNumber(candidate.invoiceNumber)
  const documentType = coerceCandidateDocumentType(
    candidate.documentType ?? candidate.invoiceType ?? metadataString(metadata, "documentType"),
  )
  const companyVatCode =
    candidate.companyVatCode ??
    metadataString(metadata, "companyVatCode") ??
    metadataString(metadata, "vatCode") ??
    fallbackCompanyVatCode
  const seriesName =
    candidate.seriesName ??
    candidate.series ??
    metadataString(metadata, "seriesName") ??
    metadataString(metadata, "series") ??
    parsed?.seriesName
  const number =
    candidate.number ??
    metadataString(metadata, "number") ??
    numberFromInvoiceNumber(candidate.invoiceNumber, seriesName) ??
    (candidate.sequence !== null && candidate.sequence !== undefined
      ? String(candidate.sequence)
      : null) ??
    parsed?.number

  if (!documentType || !companyVatCode || !seriesName || !number) return null
  return { companyVatCode, seriesName, number, documentType }
}

async function recordCandidateExternalRef(
  options: SmartbillCandidateSourceOptions,
  candidate: SmartbillCandidateInvoice,
  document: SmartbillReferenceParts,
  ref: SmartbillWorkflowExternalRef,
) {
  if (options.recordCandidateExternalRef) {
    const recorded = await options.recordCandidateExternalRef({ candidate, document, ref })
    return recorded ?? ref
  }
  if (!options.db) return ref

  const row = await financeService.registerInvoiceExternalRef(options.db, candidate.invoiceId, {
    provider: "smartbill",
    externalId: document.number,
    externalNumber: document.number,
    status: ref.status,
    syncedAt: new Date().toISOString(),
    syncError: null,
    metadata: coerceMetadata(ref.metadata),
  })

  return row ? toRegisteredWorkflowExternalRef(row, ref.invoice ?? null) : ref
}

function toCandidateWorkflowExternalRef(
  candidate: SmartbillCandidateInvoice,
  document: SmartbillReferenceParts | null,
): SmartbillWorkflowExternalRef {
  return {
    id: `candidate:${candidate.invoiceId}`,
    invoiceId: candidate.invoiceId,
    provider: "smartbill",
    externalId: document?.number ?? candidate.number ?? null,
    externalNumber: document?.number ?? candidate.number ?? null,
    externalUrl: null,
    status: "candidate",
    syncError: null,
    metadata: {
      ...(candidate.metadata ?? {}),
      source: "invoices",
      invoiceNumber: candidate.invoiceNumber,
      ...(document
        ? {
            companyVatCode: document.companyVatCode,
            seriesName: document.seriesName,
            series: document.seriesName,
            number: document.number,
            documentType: document.documentType,
          }
        : {}),
    },
    invoice: candidateToWorkflowInvoice(candidate),
  }
}

function toRegisteredWorkflowExternalRef(
  ref: Awaited<ReturnType<typeof financeService.registerInvoiceExternalRef>>,
  invoice: SmartbillWorkflowInvoice | null,
): SmartbillWorkflowExternalRef {
  if (!ref) throw new Error("SmartBill candidate external ref registration returned no row")
  return {
    id: ref.id,
    invoiceId: ref.invoiceId,
    provider: ref.provider,
    externalId: ref.externalId,
    externalNumber: ref.externalNumber,
    externalUrl: ref.externalUrl,
    status: ref.status,
    metadata: coerceMetadata(ref.metadata),
    syncError: ref.syncError,
    createdAt: ref.createdAt,
    updatedAt: ref.updatedAt,
    invoice,
  }
}

function candidateToWorkflowInvoice(
  candidate: SmartbillCandidateInvoice,
): SmartbillWorkflowInvoice | null {
  if (!candidate.status || !candidate.currency) return null
  return {
    id: candidate.invoiceId,
    invoiceNumber: candidate.invoiceNumber,
    invoiceType: candidate.invoiceType ?? candidate.documentType ?? "invoice",
    status: candidate.status,
    currency: candidate.currency,
    totalCents: candidate.totalCents ?? 0,
    paidCents: candidate.paidCents ?? 0,
    balanceDueCents: candidate.balanceDueCents ?? 0,
  }
}

function coerceCandidateDocumentType(value: unknown): SmartbillWorkflowDocumentType | null {
  return value === "invoice" || value === "proforma" ? value : null
}

function metadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function coerceMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function numberFromInvoiceNumber(invoiceNumber: string, seriesName: string | null | undefined) {
  if (!seriesName || !invoiceNumber.startsWith(seriesName)) return null
  const number = invoiceNumber.slice(seriesName.length).replace(/^[\s._/-]+/, "")
  return number.length > 0 ? number : null
}

function parseInvoiceNumber(invoiceNumber: string) {
  const match = /^(.+?)[\s._/-]+(.+)$/.exec(invoiceNumber)
  if (!match?.[1] || !match[2]) return null
  return { seriesName: match[1], number: match[2] }
}

function isPendingExternalAllocationPlaceholder(invoiceNumber: string) {
  return invoiceNumber.toUpperCase().startsWith("PENDING-")
}
