import type { SmartbillClientApi } from "./client.js"
import type { SmartbillEstimateInvoicesResponse } from "./types.js"
import {
  discoverRemoteDocuments,
  paymentStatusToRemoteStatus,
} from "./workflow-remote-discovery.js"
import { loadSmartbillWorkflowRefs } from "./workflows/refs.js"
import {
  createSpacedSmartbillClient,
  isSmartbillRateLimitError,
} from "./workflows/spaced-client.js"
import type {
  SmartbillDriftFinding,
  SmartbillDriftReconciler,
  SmartbillDriftReconcilerOptions,
  SmartbillDriftReconcilerResult,
  SmartbillMissingLocalDriftFinding,
  SmartbillProformaConversion,
  SmartbillProformaConversionPoller,
  SmartbillProformaConversionPollerOptions,
  SmartbillProformaConversionPollerResult,
  SmartbillReferenceParts,
  SmartbillRemoteDocument,
  SmartbillRemoteDocumentStatus,
  SmartbillWorkflowDocumentType,
  SmartbillWorkflowError,
  SmartbillWorkflowExternalRef,
  SmartbillWorkflowLogger,
} from "./workflows/types.js"

export type {
  SmartbillCandidateExternalRefRecorder,
  SmartbillCandidateExternalRefRecorderContext,
  SmartbillCandidateInvoice,
  SmartbillDriftFinding,
  SmartbillDriftFindingType,
  SmartbillDriftReconciler,
  SmartbillDriftReconcilerOptions,
  SmartbillDriftReconcilerResult,
  SmartbillKnownLocalDriftFinding,
  SmartbillMissingLocalDriftFinding,
  SmartbillProformaConversion,
  SmartbillProformaConversionPoller,
  SmartbillProformaConversionPollerOptions,
  SmartbillProformaConversionPollerResult,
  SmartbillReferenceParts,
  SmartbillRemoteDocument,
  SmartbillRemoteDocumentAccessors,
  SmartbillRemoteDocumentStatus,
  SmartbillWorkflowCandidateSource,
  SmartbillWorkflowDocumentType,
  SmartbillWorkflowError,
  SmartbillWorkflowExternalRef,
  SmartbillWorkflowInvoice,
  SmartbillWorkflowLogger,
} from "./workflows/types.js"

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
        if (isSmartbillRateLimitError(error)) return result
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
