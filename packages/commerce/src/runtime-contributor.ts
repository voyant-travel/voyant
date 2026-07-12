import { catalogCommerceRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import { catalogCommerceRuntimeExtension } from "./catalog-runtime-extension.js"
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

export interface CommerceRuntimeContributorHost {
  capabilities: {
    loadCommerceRuntime(): RuntimePortValue<CommerceRuntimePortContribution>
  }
}

/** Package-owned registration map for Commerce's deployment-supplied runtime adapters. */
export function createCommerceRuntimePortContribution(
  host: CommerceRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = Promise.resolve(host.capabilities.loadCommerceRuntime())
  return {
    [catalogCommerceRuntimeExtensionPort.id]: catalogCommerceRuntimeExtension,
    [bookingMaintenanceRuntimePort.id]: contribution.then((runtime) => runtime.bookingMaintenance),
    [catalogCheckoutApiRuntimePort.id]: contribution.then((runtime) => runtime.checkoutApi),
    [catalogCheckoutDatabaseRuntimePort.id]: contribution.then(
      (runtime) => runtime.checkoutDatabase,
    ),
    [catalogCheckoutLegalRuntimePort.id]: contribution.then((runtime) => runtime.checkoutLegal),
    [catalogCheckoutContractPdfRuntimePort.id]: contribution.then(
      (runtime) => runtime.checkoutContractPdf,
    ),
    [promotionRedemptionDatabaseRuntimePort.id]: contribution.then(
      (runtime) => runtime.promotionRedemptionDatabase,
    ),
    [promotionsBulkReindexRuntimePort.id]: contribution.then(
      (runtime) => runtime.promotionsBulkReindex,
    ),
  }
}
