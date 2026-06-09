import {
  type Invoice,
  type InvoiceExternalRef,
  invoiceExternalRefs,
  invoices,
} from "@voyantjs/finance"
import { desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type SmartbillClientApi,
  SmartbillRateLimitCircuitOpenError,
  SmartbillRateLimitError,
} from "./client.js"
import type {
  SmartbillEstimateInvoicesResponse,
  SmartbillInvoiceResponse,
  SmartbillPdfResponse,
  SmartbillStatusResponse,
} from "./types.js"
import {
  loadSmartbillCandidateRefs,
  type SmartbillCandidateExternalRefRecorder,
  type SmartbillCandidateInvoice,
  type SmartbillWorkflowCandidateSource,
} from "./workflow-candidates.js"
import {
  discoverRemoteDocuments,
  paymentStatusToRemoteStatus,
} from "./workflow-remote-discovery.js"

export type {
  SmartbillCandidateExternalRefRecorder,
  SmartbillCandidateExternalRefRecorderContext,
  SmartbillCandidateInvoice,
  SmartbillWorkflowCandidateSource,
} from "./workflow-candidates.js"

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
  requestSpacingMs?: number
  companyVatCode?: string
  source?: SmartbillWorkflowCandidateSource
  logger?: SmartbillWorkflowLogger
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
  listCandidateInvoices?: () => Promise<SmartbillCandidateInvoice[]>
  recordCandidateExternalRef?: SmartbillCandidateExternalRefRecorder
  onConverted: (
    proformaRef: SmartbillWorkflowExternalRef,
    conversion: SmartbillProformaConversion,
  ) => void | Promise<void>
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
  accessors?: SmartbillRemoteDocumentAccessors
}

export interface SmartbillRemoteDocumentAccessors {
  viewPdf: () => Promise<SmartbillPdfResponse>
  getPaymentStatus?: () => Promise<SmartbillStatusResponse>
  listEstimateInvoices?: () => Promise<SmartbillEstimateInvoicesResponse>
}

export type SmartbillDriftFindingType = "missing_local" | "missing_remote" | "voided_remote"

interface SmartbillDriftFindingBase {
  document: SmartbillReferenceParts
  error?: unknown
}

export interface SmartbillMissingLocalDriftFinding extends SmartbillDriftFindingBase {
  type: "missing_local"
  remote: SmartbillRemoteDocument
}

export interface SmartbillKnownLocalDriftFinding extends SmartbillDriftFindingBase {
  type: "missing_remote" | "voided_remote"
  ref?: SmartbillWorkflowExternalRef
  invoice?: SmartbillWorkflowInvoice | null
  remote?: SmartbillRemoteDocument | null
}

export type SmartbillDriftFinding =
  | SmartbillMissingLocalDriftFinding
  | SmartbillKnownLocalDriftFinding

export interface SmartbillDriftReconcilerOptions {
  db?: PostgresJsDatabase
  client: SmartbillClientApi
  limit?: number
  requestSpacingMs?: number
  companyVatCode?: string
  logger?: SmartbillWorkflowLogger
  discoverRemote?: boolean
  source?: SmartbillWorkflowCandidateSource
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
  listCandidateInvoices?: () => Promise<SmartbillCandidateInvoice[]>
  recordCandidateExternalRef?: SmartbillCandidateExternalRefRecorder
  listRemoteDocuments?: (context: {
    refs: SmartbillWorkflowExternalRef[]
  }) => Promise<SmartbillRemoteDocument[]>
  verifyRemoteDocument?: (context: {
    ref: SmartbillWorkflowExternalRef
    document: SmartbillReferenceParts
  }) => Promise<SmartbillRemoteDocumentStatus | SmartbillRemoteDocument>
  onFinding?: (finding: SmartbillDriftFinding) => void | Promise<void>
  onMissingLocal?: (finding: SmartbillMissingLocalDriftFinding) => void | Promise<void>
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
    const client = createSpacedSmartbillClient(options.client, options.requestSpacingMs)
    const refs = await loadSmartbillWorkflowRefs(options)

    for (const ref of refs) {
      const document = resolveReferenceParts(ref, options.companyVatCode)
      if (document?.documentType !== "proforma") continue
      result.checked += 1

      try {
        const response = await client.listEstimateInvoices(
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
          await options.onConverted(ref, conversion)
          options.logger?.info?.("[smartbill] proforma conversion detected", conversion)
          result.converted.push(conversion)
        }
      } catch (error) {
        await recordWorkflowError(options, result.errors, { ref, error })
        if (isSmartbillRateLimitError(error)) break
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
    const workflowOptions = {
      ...options,
      client: createSpacedSmartbillClient(options.client, options.requestSpacingMs),
    }
    const refs = await loadSmartbillWorkflowRefs(options)
    let remoteDocuments: SmartbillRemoteDocument[] | undefined
    try {
      remoteDocuments = await loadRemoteDocuments(workflowOptions, refs)
    } catch (error) {
      if (!isSmartbillRateLimitError(error)) throw error
      await recordWorkflowError(options, result.errors, { error })
      return result
    }
    const remoteDocumentMap = new Map(
      (remoteDocuments ?? []).map((remote) => [documentKey(remote), remote]),
    )
    const hasTrustedRemoteInventory = options.listRemoteDocuments !== undefined
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
        const remote = hasTrustedRemoteInventory
          ? (remoteDocumentMap.get(key) ?? { ...document, status: "missing" as const })
          : await verifyRemoteDocument(workflowOptions, ref, document)
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
        if (isSmartbillRateLimitError(error)) break
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
        await recordMissingLocalFinding(options, result.findings, {
          type: "missing_local",
          document: remote,
          remote,
        })
      }
    }

    return result
  }
}

async function loadRemoteDocuments(
  options: SmartbillDriftReconcilerOptions,
  refs: SmartbillWorkflowExternalRef[],
) {
  if (options.listRemoteDocuments) return options.listRemoteDocuments({ refs })
  if (!options.discoverRemote) return undefined
  return discoverRemoteDocuments(options.client, resolveDiscoveryCompanyVatCode(options, refs))
}

function resolveDiscoveryCompanyVatCode(
  options: SmartbillDriftReconcilerOptions,
  refs: SmartbillWorkflowExternalRef[],
) {
  if (options.companyVatCode) return options.companyVatCode

  const companyVatCodes = new Set(
    refs
      .map((ref) => resolveReferenceParts(ref, options.companyVatCode)?.companyVatCode)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  )
  if (companyVatCodes.size === 1) return [...companyVatCodes][0]!

  throw new Error("SmartBill remote discovery requires companyVatCode")
}

async function loadSmartbillWorkflowRefs(options: {
  db?: PostgresJsDatabase
  limit?: number
  companyVatCode?: string
  source?: SmartbillWorkflowCandidateSource
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
  listCandidateInvoices?: () => Promise<SmartbillCandidateInvoice[]>
  recordCandidateExternalRef?: SmartbillCandidateExternalRefRecorder
}) {
  if (options.listCandidateInvoices || options.source === "invoices") {
    return loadSmartbillCandidateRefs(options)
  }
  return loadSmartbillExternalRefs(options)
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

function createSpacedSmartbillClient(
  client: SmartbillClientApi,
  requestSpacingMs: number | undefined,
): SmartbillClientApi {
  const minIntervalMs =
    typeof requestSpacingMs === "number" && Number.isFinite(requestSpacingMs)
      ? Math.max(0, requestSpacingMs)
      : 0
  if (minIntervalMs === 0) return client

  let lastRequestStartedAt: number | null = null
  let pendingRequest = Promise.resolve()

  const spaceRequest = async <Result>(request: () => Promise<Result>) => {
    const run = pendingRequest.then(async () => {
      if (lastRequestStartedAt !== null) {
        const elapsedMs = Date.now() - lastRequestStartedAt
        const delayMs = minIntervalMs - elapsedMs
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
      lastRequestStartedAt = Date.now()
      return request()
    })
    pendingRequest = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return {
    createInvoice: (body) => spaceRequest(() => client.createInvoice(body)),
    createProforma: (body) => spaceRequest(() => client.createProforma(body)),
    convertEstimateToInvoice: (companyVatCode, estimateSeriesName, estimateNumber, body) =>
      spaceRequest(() =>
        client.convertEstimateToInvoice(companyVatCode, estimateSeriesName, estimateNumber, body),
      ),
    cancelInvoice: (companyVatCode, seriesName, number) =>
      spaceRequest(() => client.cancelInvoice(companyVatCode, seriesName, number)),
    restoreInvoice: (companyVatCode, seriesName, number) =>
      spaceRequest(() => client.restoreInvoice(companyVatCode, seriesName, number)),
    deleteInvoice: (companyVatCode, seriesName, number) =>
      spaceRequest(() => client.deleteInvoice(companyVatCode, seriesName, number)),
    reverseInvoice: (companyVatCode, seriesName, number) =>
      spaceRequest(() => client.reverseInvoice(companyVatCode, seriesName, number)),
    viewInvoicePdf: (companyVatCode, seriesName, number) =>
      spaceRequest(() => client.viewInvoicePdf(companyVatCode, seriesName, number)),
    viewPdf: (companyVatCode, seriesName, number) =>
      spaceRequest(() => client.viewPdf(companyVatCode, seriesName, number)),
    viewEstimatePdf: (companyVatCode, seriesName, number) =>
      spaceRequest(() => client.viewEstimatePdf(companyVatCode, seriesName, number)),
    getPaymentStatus: (companyVatCode, seriesName, number) =>
      spaceRequest(() => client.getPaymentStatus(companyVatCode, seriesName, number)),
    listTaxes: () => spaceRequest(() => client.listTaxes()),
    listSeries: () => spaceRequest(() => client.listSeries()),
    listEstimateInvoices: (companyVatCode, seriesName, number) =>
      spaceRequest(() => client.listEstimateInvoices(companyVatCode, seriesName, number)),
  }
}

function isSmartbillRateLimitError(error: unknown) {
  return (
    error instanceof SmartbillRateLimitError || error instanceof SmartbillRateLimitCircuitOpenError
  )
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

async function recordMissingLocalFinding(
  options: SmartbillDriftReconcilerOptions,
  findings: SmartbillDriftFinding[],
  finding: SmartbillMissingLocalDriftFinding,
) {
  await recordFinding(options, findings, finding)
  await options.onMissingLocal?.(finding)
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
