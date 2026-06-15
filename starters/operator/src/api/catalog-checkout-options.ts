/**
 * Operator (deployment) wiring for the catalog-checkout cluster.
 *
 * The reusable checkout business logic lives in
 * `@voyant-travel/commerce/checkout`. This file builds the deployment-specific
 * options it needs, injected as structural functions so the package never
 * imports the operator (and never imports `@voyant-travel/inventory`, which
 * depends on commerce — a static import would cycle):
 *
 *   - `resolveBookingTaxSettings` — operator settings table read.
 *   - `getOwnedProductName` — owned product title via inventory's
 *     `productsService.getProductById` (injected to avoid the cycle).
 *   - `resolveBankTransferInstructions` — operator profile / payment-instruction
 *     rows + env fallbacks for the bank-transfer checkout path.
 */
import type { CheckoutModuleOptions, CheckoutStartOptions } from "@voyant-travel/commerce/checkout"
import { productsService } from "@voyant-travel/inventory"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  getOperatorPaymentInstructions,
  getOperatorProfile,
  resolveBookingTaxSettings,
} from "./settings"

/** Resolve an owned product's display name (cycle-avoiding inventory read). */
async function getOwnedProductName(
  db: PostgresJsDatabase,
  entityModule: string,
  entityId: string,
): Promise<string | null> {
  if (entityModule !== "products") return null
  const product = await productsService.getProductById(db, entityId)
  return product?.name ?? null
}

/**
 * Compose the bank-transfer instructions from the operator profile / payment
 * instructions rows, falling back to env vars. Mirrors the operator's previous
 * `resolveBankTransferInstructions`.
 */
async function resolveBankTransferInstructions(
  db: PostgresJsDatabase,
  env: Record<string, string | undefined>,
) {
  const [operatorProfile, paymentInstructions] = await Promise.all([
    getOperatorProfile(db),
    getOperatorPaymentInstructions(db),
  ])
  return {
    beneficiary:
      paymentInstructions?.bankTransferBeneficiary ||
      operatorProfile?.legalName ||
      operatorProfile?.name ||
      env.BANK_TRANSFER_BENEFICIARY ||
      env.STOREFRONT_BANK_BENEFICIARY ||
      "—",
    iban: paymentInstructions?.iban || env.BANK_TRANSFER_IBAN || env.STOREFRONT_BANK_IBAN || "—",
    bankName:
      paymentInstructions?.bank || env.BANK_TRANSFER_BANK_NAME || env.STOREFRONT_BANK_NAME || "—",
  }
}

/** Shared checkout-module options (materialization + tax). */
export function createOperatorCheckoutModuleOptions(): CheckoutModuleOptions {
  return {
    resolveBookingTaxSettings,
    getOwnedProductName,
  }
}

/** Checkout-start options — module options + bank-transfer reader. */
export function createOperatorCheckoutStartOptions(): CheckoutStartOptions {
  return {
    ...createOperatorCheckoutModuleOptions(),
    resolveBankTransferInstructions,
  }
}
