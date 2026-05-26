import type { EventBus } from "@voyantjs/core"

import type { InvoiceFxOptions } from "./invoice-fx.js"
import type { FinanceDocumentRouteOptions, InvoiceDocumentGenerator } from "./routes-documents.js"
import type { FinanceSettlementRouteOptions, InvoiceSettlementPoller } from "./routes-settlement.js"
import type { InvoiceLineDescriptionResolver } from "./service.js"

export type FinanceRouteRuntime = {
  invoiceDocumentGenerator?: InvoiceDocumentGenerator
  resolveDocumentDownloadUrl?: FinanceDocumentRouteOptions["resolveDocumentDownloadUrl"]
  invoiceSettlementPollers: Record<string, InvoiceSettlementPoller>
  eventBus?: EventBus
  descriptionResolver?: InvoiceLineDescriptionResolver
} & InvoiceFxOptions

export const FINANCE_ROUTE_RUNTIME_CONTAINER_KEY = "providers.finance.runtime"

export interface FinanceRuntimeOptions
  extends FinanceDocumentRouteOptions,
    FinanceSettlementRouteOptions,
    InvoiceFxOptions {
  descriptionResolver?: InvoiceLineDescriptionResolver
}

export function buildFinanceRouteRuntime(
  bindings: Record<string, unknown>,
  options: FinanceRuntimeOptions = {},
): FinanceRouteRuntime {
  return {
    invoiceDocumentGenerator:
      options.resolveInvoiceDocumentGenerator?.(bindings) ?? options.invoiceDocumentGenerator,
    resolveDocumentDownloadUrl: options.resolveDocumentDownloadUrl,
    invoiceSettlementPollers:
      options.resolveInvoiceSettlementPollers?.(bindings) ?? options.invoiceSettlementPollers ?? {},
    eventBus: options.resolveEventBus?.(bindings) ?? options.eventBus,
    descriptionResolver: options.descriptionResolver,
    invoiceFxSettings: options.invoiceFxSettings,
    resolveInvoiceFxSettings: options.resolveInvoiceFxSettings,
    updateInvoiceFxSettings: options.updateInvoiceFxSettings,
    resolveInvoiceExchangeRate:
      options.resolveInvoiceExchangeRateResolver?.(bindings) ?? options.resolveInvoiceExchangeRate,
    resolveInvoiceExchangeRateResolver: options.resolveInvoiceExchangeRateResolver,
    onInvoiceFxResolutionError: options.onInvoiceFxResolutionError,
  }
}
