import {
  type Invoice,
  type InvoiceExternalRef,
  invoiceExternalRefs,
  invoices,
} from "@voyantjs/finance"
import { desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { SmartbillClientApi } from "./client.js"
import type {
  SmartbillEstimateInvoicesResponse,
  SmartbillInvoiceResponse,
  SmartbillStatusResponse,
} from "./types.js"

export type SmartbillWorkflowDocumentType = "invoice" | "proforma"

export interface SmartbillWorkflowLogger {
  info?: (message: string, meta?: unknown) => void
  error?: (message: string, meta?: unknown) => void
}

export interface SmartbillWorkflowInvoice {
  id: string
  invoiceNumber: string
  invoiceType: Invoice["invoiceType"]
  status: Invoice["status"]
  currency: string
  totalCents: number
  paidCents: number
  balanceDueCents: number
}

export interface SmartbillWorkflowExternalRef {
  id: string
  invoiceId: string
  provider: string
  externalId: string | null
  externalNumber: string | null
  externalUrl: string | null
  status: string | null
  metadata: unknown
  syncError: string | null
  createdAt?: Date | null
  updatedAt?: Date | null
  invoice?: SmartbillWorkflowInvoice | null
}

export interface SmartbillReferenceParts {
  companyVatCode: string
  seriesName: string
  number: string
  documentType: SmartbillWorkflowDocumentType
}

export interface SmartbillProformaConversion {
  proformaRef: SmartbillWorkflowExternalRef
  invoice: SmartbillWorkflowInvoice | null
  companyVatCode: string
  proformaSeriesName: string
  proformaNumber: string
  invoiceSeriesName: string
  invoiceNumber: string
  invoiceUrl: string | null
  response: SmartbillEstimateInvoicesResponse
  smartbillInvoice: SmartbillInvoiceResponse
}

export interface SmartbillProformaConversionPollerOptions {
  db?: PostgresJsDatabase
  client: SmartbillClientApi
  limit?: number
  companyVatCode?: string
  logger?: SmartbillWorkflowLogger
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
  onConverted: (conversion: SmartbillProformaConversion) => void | Promise<void>
  onError?: (error: SmartbillWorkflowError) => void | Promise<void>
}

export interface SmartbillWorkflowError {
  ref?: SmartbillWorkflowExternalRef
  error: unknown
}

export interface SmartbillProformaConversionPollerResult {
  checked: number
  converted: SmartbillProformaConversion[]
  skipped: Array<{ ref: SmartbillWorkflowExternalRef; reason: string }>
  errors: SmartbillWorkflowError[]
}

export type SmartbillRemoteDocumentStatus =
  | "present"
  | "issued"
  | "paid"
  | "unpaid"
  | "partially_paid"
  | "voided"
  | "cancelled"
  | "reversed"
  | "deleted"
  | "missing"

export interface SmartbillRemoteDocument extends SmartbillReferenceParts {
  status?: SmartbillRemoteDocumentStatus
  metadata?: Record<string, unknown>
}

export type SmartbillDriftFindingType = "missing_local" | "missing_remote" | "voided_remote"

export interface SmartbillDriftFinding {
  type: SmartbillDriftFindingType
  document: SmartbillReferenceParts
  ref?: SmartbillWorkflowExternalRef
  invoice?: SmartbillWorkflowInvoice | null
  remote?: SmartbillRemoteDocument | null
  error?: unknown
}

export interface SmartbillDriftReconcilerOptions {
  db?: PostgresJsDatabase
  client: SmartbillClientApi
  limit?: number
  companyVatCode?: string
  logger?: SmartbillWorkflowLogger
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
  listRemoteDocuments?: (context: {
    refs: SmartbillWorkflowExternalRef[]
  }) => Promise<SmartbillRemoteDocument[]>
  verifyRemoteDocument?: (context: {
    ref: SmartbillWorkflowExternalRef
    document: SmartbillReferenceParts
  }) => Promise<SmartbillRemoteDocumentStatus | SmartbillRemoteDocument>
  onFinding?: (finding: SmartbillDriftFinding) => void | Promise<void>
  onError?: (error: SmartbillWorkflowError) => void | Promise<void>
}

export interface SmartbillDriftReconcilerResult {
  checked: number
  findings: SmartbillDriftFinding[]
  skipped: Array<{ ref: SmartbillWorkflowExternalRef; reason: string }>
  errors: SmartbillWorkflowError[]
}

export type SmartbillProformaConversionPoller =
  () => Promise<SmartbillProformaConversionPollerResult>

export type SmartbillDriftReconciler = () => Promise<SmartbillDriftReconcilerResult>

export function createSmartbillProformaConversionPoller(
  options: SmartbillProformaConversionPollerOptions,
): SmartbillProformaConversionPoller {
  return async () => {
    const result: SmartbillProformaConversionPollerResult = {
      checked: 0,
      converted: [],
      skipped: [],
      errors: [],
    }
    const refs = await loadSmartbillExternalRefs(options)

    for (const ref of refs) {
      const document = resolveReferenceParts(ref, options.companyVatCode)
      if (document?.documentType !== "proforma") continue
      result.checked += 1

      try {
        const response = await options.client.listEstimateInvoices(
          document.companyVatCode,
          document.seriesName,
          document.number,
        )
        const convertedInvoices = convertedInvoicesFromResponse(response)
        if (convertedInvoices.length === 0) {
          result.skipped.push({ ref, reason: "not_converted" })
          continue
        }

        for (const smartbillInvoice of convertedInvoices) {
          if (!smartbillInvoice.series || !smartbillInvoice.number) {
            result.skipped.push({ ref, reason: "missing_converted_invoice_number" })
            continue
          }

          const conversion: SmartbillProformaConversion = {
            proformaRef: ref,
            invoice: ref.invoice ?? null,
            companyVatCode: document.companyVatCode,
            proformaSeriesName: document.seriesName,
            proformaNumber: document.number,
            invoiceSeriesName: smartbillInvoice.series,
            invoiceNumber: smartbillInvoice.number,
            invoiceUrl: smartbillInvoice.url ?? null,
            response,
            smartbillInvoice,
          }
          await options.onConverted(conversion)
          options.logger?.info?.("[smartbill] proforma conversion detected", conversion)
          result.converted.push(conversion)
        }
      } catch (error) {
        await recordWorkflowError(options, result.errors, { ref, error })
      }
    }

    return result
  }
}

export function createSmartbillDriftReconciler(
  options: SmartbillDriftReconcilerOptions,
): SmartbillDriftReconciler {
  return async () => {
    const result: SmartbillDriftReconcilerResult = {
      checked: 0,
      findings: [],
      skipped: [],
      errors: [],
    }
    const refs = await loadSmartbillExternalRefs(options)
    const remoteDocuments = await options.listRemoteDocuments?.({ refs })
    const remoteDocumentMap = new Map(
      (remoteDocuments ?? []).map((remote) => [documentKey(remote), remote]),
    )
    const hasRemoteInventory = remoteDocuments !== undefined
    const localDocuments = new Map<string, SmartbillReferenceParts>()

    for (const ref of refs) {
      const document = resolveReferenceParts(ref, options.companyVatCode)
      if (!document) {
        result.skipped.push({ ref, reason: "missing_smartbill_reference" })
        continue
      }
      const key = documentKey(document)
      localDocuments.set(key, document)
      result.checked += 1

      try {
        const remote = hasRemoteInventory
          ? (remoteDocumentMap.get(key) ?? { ...document, status: "missing" as const })
          : await verifyRemoteDocument(options, ref, document)
        if (remote.status === "missing" || remote.status === "deleted") {
          await recordFinding(options, result.findings, {
            type: "missing_remote",
            document,
            ref,
            invoice: ref.invoice ?? null,
            remote,
          })
        } else if (isVoidedRemote(remote.status) && ref.invoice?.status !== "void") {
          await recordFinding(options, result.findings, {
            type: "voided_remote",
            document,
            ref,
            invoice: ref.invoice ?? null,
            remote,
          })
        }
      } catch (error) {
        await recordWorkflowError(options, result.errors, { ref, error })
        await recordFinding(options, result.findings, {
          type: "missing_remote",
          document,
          ref,
          invoice: ref.invoice ?? null,
          remote: null,
          error,
        })
      }
    }

    for (const remote of remoteDocuments ?? []) {
      if (!localDocuments.has(documentKey(remote))) {
        await recordFinding(options, result.findings, {
          type: "missing_local",
          document: remote,
          remote,
        })
      }
    }

    return result
  }
}

async function loadSmartbillExternalRefs(options: {
  db?: PostgresJsDatabase
  limit?: number
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
}) {
  if (options.listExternalRefs) return options.listExternalRefs()
  if (!options.db) throw new Error("SmartBill workflow requires db or listExternalRefs")

  const rows = await options.db
    .select({
      ref: invoiceExternalRefs,
      invoice: {
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceType: invoices.invoiceType,
        status: invoices.status,
        currency: invoices.currency,
        totalCents: invoices.totalCents,
        paidCents: invoices.paidCents,
        balanceDueCents: invoices.balanceDueCents,
      },
    })
    .from(invoiceExternalRefs)
    .leftJoin(invoices, eq(invoiceExternalRefs.invoiceId, invoices.id))
    .where(eq(invoiceExternalRefs.provider, "smartbill"))
    .orderBy(desc(invoiceExternalRefs.createdAt))
    .limit(options.limit ?? 500)

  return rows.map((row) => toWorkflowExternalRef(row.ref, row.invoice))
}

function toWorkflowExternalRef(
  ref: InvoiceExternalRef,
  invoice: SmartbillWorkflowInvoice | null,
): SmartbillWorkflowExternalRef {
  return {
    id: ref.id,
    invoiceId: ref.invoiceId,
    provider: ref.provider,
    externalId: ref.externalId,
    externalNumber: ref.externalNumber,
    externalUrl: ref.externalUrl,
    status: ref.status,
    metadata: ref.metadata,
    syncError: ref.syncError,
    createdAt: ref.createdAt,
    updatedAt: ref.updatedAt,
    invoice,
  }
}

function convertedInvoicesFromResponse(response: SmartbillEstimateInvoicesResponse) {
  if (Array.isArray(response.invoices) && response.invoices.length > 0) {
    return response.invoices.filter((invoice) => invoice.series && invoice.number)
  }
  if (response.areInvoicesCreated && response.series && response.number) {
    return [{ series: response.series, number: response.number }]
  }
  return []
}

async function verifyRemoteDocument(
  options: SmartbillDriftReconcilerOptions,
  ref: SmartbillWorkflowExternalRef,
  document: SmartbillReferenceParts,
): Promise<SmartbillRemoteDocument> {
  const verified = await (options.verifyRemoteDocument
    ? options.verifyRemoteDocument({ ref, document })
    : defaultVerifyRemoteDocument(options.client, document))
  return typeof verified === "string" ? { ...document, status: verified } : verified
}

async function defaultVerifyRemoteDocument(
  client: SmartbillClientApi,
  document: SmartbillReferenceParts,
): Promise<SmartbillRemoteDocumentStatus> {
  if (document.documentType === "proforma") {
    await client.listEstimateInvoices(document.companyVatCode, document.seriesName, document.number)
    return "present"
  }
  const status = await client.getPaymentStatus(
    document.companyVatCode,
    document.seriesName,
    document.number,
  )
  return paymentStatusToRemoteStatus(status)
}

function paymentStatusToRemoteStatus(
  status: SmartbillStatusResponse,
): SmartbillRemoteDocumentStatus {
  if (status.paid) return "paid"
  if ((status.paidAmount ?? 0) > 0) return "partially_paid"
  return "unpaid"
}

function resolveReferenceParts(
  ref: SmartbillWorkflowExternalRef,
  fallbackCompanyVatCode?: string,
): SmartbillReferenceParts | null {
  const metadata = coerceMetadata(ref.metadata)
  const documentType = coerceDocumentType(metadata?.documentType)
  const companyVatCode =
    metadataString(metadata, "companyVatCode") ??
    metadataString(metadata, "vatCode") ??
    fallbackCompanyVatCode
  const seriesName = metadataString(metadata, "series") ?? metadataString(metadata, "seriesName")
  const number = metadataString(metadata, "number") ?? ref.externalNumber ?? ref.externalId

  if (!documentType || !companyVatCode || !seriesName || !number) return null
  return { companyVatCode, seriesName, number, documentType }
}

function coerceMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function metadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function coerceDocumentType(value: unknown): SmartbillWorkflowDocumentType | null {
  return value === "invoice" || value === "proforma" ? value : null
}

function documentKey(document: SmartbillReferenceParts) {
  return [
    document.documentType,
    document.companyVatCode,
    document.seriesName,
    document.number,
  ].join(":")
}

function isVoidedRemote(status: SmartbillRemoteDocumentStatus | undefined) {
  return status === "voided" || status === "cancelled" || status === "reversed"
}

async function recordFinding(
  options: SmartbillDriftReconcilerOptions,
  findings: SmartbillDriftFinding[],
  finding: SmartbillDriftFinding,
) {
  findings.push(finding)
  options.logger?.info?.("[smartbill] drift finding", finding)
  await options.onFinding?.(finding)
}

async function recordWorkflowError(
  options: {
    logger?: SmartbillWorkflowLogger
    onError?: (error: SmartbillWorkflowError) => void | Promise<void>
  },
  errors: SmartbillWorkflowError[],
  error: SmartbillWorkflowError,
) {
  errors.push(error)
  options.logger?.error?.("[smartbill] workflow error", error)
  await options.onError?.(error)
}
