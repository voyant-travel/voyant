import {
  catalogCommerceRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { VoyantPort } from "@voyant-travel/core/project"
import {
  financeAccommodationsPaymentPolicyRuntimePort,
  financeCruisesPaymentPolicyRuntimePort,
  financeDistributionPaymentPolicyRuntimePort,
  financeInventoryPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"
import { checkoutInquiryRuntimePort } from "@voyant-travel/quotes-contracts/checkout-inquiry"
import { catalogCommerceRuntimeExtension } from "./catalog-runtime-extension.js"
import {
  bookingMaintenanceRuntimePort,
  catalogCheckoutApiRuntimePort,
  catalogCheckoutContractPdfRuntimePort,
  catalogCheckoutDatabaseRuntimePort,
  catalogCheckoutLegalRuntimePort,
} from "./checkout/runtime-ports.js"
import {
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "./promotions/runtime-ports.js"
import { createCommerceRuntime } from "./runtime.js"
import {
  type CommerceCardPaymentRuntime,
  commerceCardPaymentRuntimePort,
  commerceInventoryRuntimePort,
  commerceLegalRuntimePort,
  commerceOperatorSettingsRuntimePort,
} from "./runtime-port.js"

export type CommerceRuntimePortContribution = ReturnType<typeof createCommerceRuntime>

export interface CommerceRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

/** Register Commerce-owned bindings composed from selected domain providers. */
export function createCommerceRuntimePortContribution(
  host: CommerceRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = Promise.resolve()
    .then(() =>
      Promise.all([
        host.getRuntimePort(commerceOperatorSettingsRuntimePort),
        host.getRuntimePort(commerceInventoryRuntimePort),
        host.getRuntimePort(commerceLegalRuntimePort),
        host.getRuntimePort(catalogRuntimeServicesPort),
        host.getRuntimePort(financeDistributionPaymentPolicyRuntimePort),
        host.getRuntimePort(financeAccommodationsPaymentPolicyRuntimePort),
        host.getRuntimePort(financeCruisesPaymentPolicyRuntimePort),
        host.getRuntimePort(financeInventoryPaymentPolicyRuntimePort),
        host.getRuntimePort(checkoutInquiryRuntimePort),
        resolveOptionalPort(host, commerceCardPaymentRuntimePort),
      ]),
    )
    .then(
      ([
        settings,
        inventory,
        legal,
        catalog,
        distribution,
        accommodations,
        cruises,
        inventoryPolicy,
        checkoutInquiry,
        cardPayment,
      ]) =>
        createCommerceRuntime({
          primitives: host.primitives,
          settings,
          inventory,
          legal,
          catalog,
          distribution,
          accommodations,
          cruises,
          inventoryPolicy,
          checkoutInquiry,
          cardPayment,
        }),
    )
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

async function resolveOptionalPort(
  host: CommerceRuntimeContributorHost,
  port: Pick<VoyantPort<CommerceCardPaymentRuntime>, "id">,
): Promise<CommerceCardPaymentRuntime | undefined> {
  try {
    return await host.getRuntimePort(port)
  } catch (error) {
    if (error instanceof Error && error.message.includes("was read before")) return undefined
    throw error
  }
}
