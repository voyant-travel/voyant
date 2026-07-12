import type { AcceptanceSignatureLegalPort } from "./checkout/acceptance-signature.js"
import type { BookingMaintenanceRoutesOptions } from "./checkout/routes.js"
import {
  bookingMaintenanceRuntimePort,
  type CatalogCheckoutApiRuntime,
  type CatalogCheckoutContractPdfRuntime,
  type CatalogCheckoutDatabaseRuntime,
  catalogCheckoutApiRuntimePort,
  catalogCheckoutContractPdfRuntimePort,
  catalogCheckoutDatabaseRuntimePort,
  catalogCheckoutLegalRuntimePort,
} from "./checkout/runtime-ports.js"
import {
  type PromotionRedemptionDatabaseRuntime,
  type PromotionsBulkReindexRuntime,
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "./promotions/runtime-ports.js"

type RuntimePortValue<T> = T | Promise<T>

export interface CommerceRuntimePortContribution {
  bookingMaintenance: RuntimePortValue<BookingMaintenanceRoutesOptions>
  checkoutApi: RuntimePortValue<CatalogCheckoutApiRuntime>
  checkoutDatabase: RuntimePortValue<CatalogCheckoutDatabaseRuntime>
  checkoutLegal: RuntimePortValue<AcceptanceSignatureLegalPort>
  checkoutContractPdf: RuntimePortValue<CatalogCheckoutContractPdfRuntime>
  promotionRedemptionDatabase: RuntimePortValue<PromotionRedemptionDatabaseRuntime>
  promotionsBulkReindex: RuntimePortValue<PromotionsBulkReindexRuntime>
}

/** Package-owned registration map for Commerce's deployment-supplied runtime adapters. */
export function createCommerceRuntimePortContribution(
  contribution: CommerceRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [bookingMaintenanceRuntimePort.id]: contribution.bookingMaintenance,
    [catalogCheckoutApiRuntimePort.id]: contribution.checkoutApi,
    [catalogCheckoutDatabaseRuntimePort.id]: contribution.checkoutDatabase,
    [catalogCheckoutLegalRuntimePort.id]: contribution.checkoutLegal,
    [catalogCheckoutContractPdfRuntimePort.id]: contribution.checkoutContractPdf,
    [promotionRedemptionDatabaseRuntimePort.id]: contribution.promotionRedemptionDatabase,
    [promotionsBulkReindexRuntimePort.id]: contribution.promotionsBulkReindex,
  }
}
