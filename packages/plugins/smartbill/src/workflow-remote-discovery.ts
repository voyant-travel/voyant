import { SmartbillApiError, type SmartbillClientApi } from "./client.js"
import type { SmartbillSeriesResponse, SmartbillStatusResponse } from "./types.js"
import type {
  SmartbillReferenceParts,
  SmartbillRemoteDocument,
  SmartbillRemoteDocumentAccessors,
  SmartbillRemoteDocumentStatus,
} from "./workflows.js"

export async function discoverRemoteDocuments(
  client: SmartbillClientApi,
  companyVatCode: string,
): Promise<SmartbillRemoteDocument[]> {
  const response = await client.listSeries()
  const documents: SmartbillRemoteDocument[] = []

  for (const series of discoverableSeries(response)) {
    for (let number = 1; number < series.nextNumber; number += 1) {
      const document: SmartbillReferenceParts = {
        companyVatCode,
        seriesName: series.name,
        number: String(number),
        documentType: series.type === "f" ? "invoice" : "proforma",
      }

      try {
        const remote =
          document.documentType === "invoice"
            ? await discoverInvoiceDocument(client, document)
            : await discoverProformaDocument(client, document)
        documents.push(remote)
      } catch (error) {
        if (isMissingRemoteDocumentError(error)) continue
        throw error
      }
    }
  }

  return documents
}

export function paymentStatusToRemoteStatus(
  status: SmartbillStatusResponse,
): SmartbillRemoteDocumentStatus {
  const providerStatus = `${status.message ?? ""} ${status.errorText ?? ""}`.toLowerCase()
  if (providerStatus.includes("cancel")) return "cancelled"
  if (providerStatus.includes("reverse")) return "reversed"
  if (providerStatus.includes("void")) return "voided"
  if (providerStatus.includes("delete")) return "deleted"
  if (status.paid) return "paid"
  if ((status.paidAmount ?? 0) > 0) return "partially_paid"
  return "unpaid"
}

function discoverableSeries(response: SmartbillSeriesResponse) {
  return (response.list ?? []).filter(
    (
      series,
    ): series is {
      name: string
      nextNumber: number
      type: "f" | "p"
    } =>
      typeof series.name === "string" &&
      series.name.length > 0 &&
      Number.isInteger(series.nextNumber) &&
      series.nextNumber > 1 &&
      (series.type === "f" || series.type === "p"),
  )
}

async function discoverInvoiceDocument(
  client: SmartbillClientApi,
  document: SmartbillReferenceParts,
): Promise<SmartbillRemoteDocument> {
  const paymentStatus = await client.getPaymentStatus(
    document.companyVatCode,
    document.seriesName,
    document.number,
  )
  return {
    ...document,
    status: paymentStatusToRemoteStatus(paymentStatus),
    metadata: { paymentStatus },
    accessors: remoteDocumentAccessors(client, document),
  }
}

async function discoverProformaDocument(
  client: SmartbillClientApi,
  document: SmartbillReferenceParts,
): Promise<SmartbillRemoteDocument> {
  const estimateInvoices = await client.listEstimateInvoices(
    document.companyVatCode,
    document.seriesName,
    document.number,
  )
  return {
    ...document,
    status: "present",
    metadata: { estimateInvoices },
    accessors: remoteDocumentAccessors(client, document),
  }
}

function remoteDocumentAccessors(
  client: SmartbillClientApi,
  document: SmartbillReferenceParts,
): SmartbillRemoteDocumentAccessors {
  if (document.documentType === "proforma") {
    return {
      viewPdf: () =>
        client.viewEstimatePdf(document.companyVatCode, document.seriesName, document.number),
      listEstimateInvoices: () =>
        client.listEstimateInvoices(document.companyVatCode, document.seriesName, document.number),
    }
  }
  return {
    viewPdf: () =>
      client.viewInvoicePdf(document.companyVatCode, document.seriesName, document.number),
    getPaymentStatus: () =>
      client.getPaymentStatus(document.companyVatCode, document.seriesName, document.number),
  }
}

function isMissingRemoteDocumentError(error: unknown) {
  return error instanceof SmartbillApiError && error.status === 404
}
