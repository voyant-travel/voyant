import type { EventBus } from "@voyant-travel/core"
import { definePort } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import type { AcceptanceSignatureLegalPort } from "./acceptance-signature.js"
import type { CheckoutStartOptions } from "./options.js"

export type CatalogCheckoutApiRuntime = (context: Context) => CheckoutStartOptions

export interface CatalogCheckoutDatabaseRuntime {
  withDb<T>(bindings: unknown, operation: (db: PostgresJsDatabase) => Promise<T>): Promise<T>
}

export interface CatalogCheckoutContractPdfRuntime {
  generate(input: {
    bindings: unknown
    db: PostgresJsDatabase
    eventBus: EventBus
    bookingId: string
    force?: boolean
  }): Promise<{ contractId: string; attachmentId: string } | null>
}

export const catalogCheckoutDatabaseRuntimePort = definePort<CatalogCheckoutDatabaseRuntime>({
  id: "commerce.checkout-database",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.withDb !== "function"
    ) {
      throw new Error("commerce.checkout-database provider must implement withDb().")
    }
  },
})

export const catalogCheckoutLegalRuntimePort = definePort<AcceptanceSignatureLegalPort>({
  id: "legal.acceptance-signature",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("legal.acceptance-signature provider must be an object.")
    }
    for (const method of [
      "getContract",
      "listSignatures",
      "sendContract",
      "signContract",
    ] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`legal.acceptance-signature provider must implement ${method}().`)
      }
    }
  },
})

export const catalogCheckoutContractPdfRuntimePort = definePort<CatalogCheckoutContractPdfRuntime>({
  id: "legal.booking-contract-pdf",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.generate !== "function"
    ) {
      throw new Error("legal.booking-contract-pdf provider must implement generate().")
    }
  },
})

export const catalogCheckoutApiRuntimePort = definePort<CatalogCheckoutApiRuntime>({
  id: "commerce.checkout-api-options",
  test(provider) {
    if (typeof provider !== "function") {
      throw new Error("commerce.checkout-api-options provider must be a function.")
    }
  },
})
