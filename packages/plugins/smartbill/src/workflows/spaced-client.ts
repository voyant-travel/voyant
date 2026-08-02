import type { SmartbillClientApi } from "../client.js"
import { SmartbillRateLimitCircuitOpenError, SmartbillRateLimitError } from "../client.js"

export function createSpacedSmartbillClient(
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

export function isSmartbillRateLimitError(error: unknown) {
  return (
    error instanceof SmartbillRateLimitError || error instanceof SmartbillRateLimitCircuitOpenError
  )
}
