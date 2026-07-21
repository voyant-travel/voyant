import type { BootstrapContext, EventBus, SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type AcceptanceSignatureLegalPort,
  persistAcceptanceSignature,
} from "./acceptance-signature.js"
import { type CatalogCheckoutContractPdfGenerator, finalizeCheckout } from "./finalize.js"
import {
  type CatalogCheckoutDatabaseRuntime,
  catalogCheckoutContractPdfRuntimePort,
  catalogCheckoutDatabaseRuntimePort,
  catalogCheckoutLegalRuntimePort,
} from "./runtime-ports.js"

export type { AcceptanceSignatureLegalPort } from "./acceptance-signature.js"
export type {
  CatalogCheckoutApiRuntime,
  CatalogCheckoutContractPdfRuntime,
  CatalogCheckoutDatabaseRuntime,
} from "./runtime-ports.js"
export {
  catalogCheckoutApiRuntimePort,
  catalogCheckoutContractPdfRuntimePort,
  catalogCheckoutDatabaseRuntimePort,
  catalogCheckoutLegalRuntimePort,
} from "./runtime-ports.js"

export const COMMERCE_ACCEPTANCE_SIGNATURE_SUBSCRIBER_ID =
  "@voyant-travel/commerce#subscriber.catalog-checkout-contract-document-generated"
export const COMMERCE_CHECKOUT_FINALIZE_SUBSCRIBER_ID =
  "@voyant-travel/commerce#subscriber.catalog-checkout-payment-completed"

export interface CatalogCheckoutRuntimeDatabase<TBindings = unknown>
  extends CatalogCheckoutDatabaseRuntime {
  withDb<T>(bindings: TBindings, operation: (db: PostgresJsDatabase) => Promise<T>): Promise<T>
}

export interface AcceptanceSignatureSubscriberRuntimeOptions<TBindings = unknown>
  extends CatalogCheckoutRuntimeDatabase<TBindings> {
  legal: AcceptanceSignatureLegalPort
  persistSignature?: typeof persistAcceptanceSignature
  logger?: Pick<Console, "error">
}

export interface CheckoutFinalizeSubscriberRuntimeOptions<TBindings = unknown>
  extends CatalogCheckoutRuntimeDatabase<TBindings> {
  generateContractPdf?: CatalogCheckoutContractPdfGenerator
  finalize?: typeof finalizeCheckout
}

interface ContractDocumentGeneratedPayload {
  contractId: string
}

interface PaymentCompletedPayload {
  bookingId: string | null
  paymentSessionId?: string
  paymentIntent?: "card" | "bank_transfer" | "hold" | "ticket_on_credit"
}

/** Build the acceptance-signature descriptor without activating its manifest runtime. */
export function createAcceptanceSignatureSubscriberRuntime<TBindings = unknown>(
  options: AcceptanceSignatureSubscriberRuntimeOptions<TBindings>,
): SubscriberRuntimeDescriptor {
  const persistSignature = options.persistSignature ?? persistAcceptanceSignature
  const logger = options.logger ?? console

  return {
    id: COMMERCE_ACCEPTANCE_SIGNATURE_SUBSCRIBER_ID,
    eventType: "contract.document.generated",
    register: ({ bindings, eventBus }) => {
      const runtimeBindings = bindings as TBindings
      eventBus.subscribe<ContractDocumentGeneratedPayload>(
        "contract.document.generated",
        async ({ data }) => {
          try {
            await options.withDb(runtimeBindings, (db) =>
              persistSignature(db, data.contractId, eventBus, options.legal),
            )
          } catch (error) {
            logger.error("[catalog-checkout] persistAcceptanceSignature failed", error)
          }
        },
      )
    },
  }
}

/** Build the payment-finalization descriptor without activating its manifest runtime. */
export function createCheckoutFinalizeSubscriberRuntime<TBindings = unknown>(
  options: CheckoutFinalizeSubscriberRuntimeOptions<TBindings>,
): SubscriberRuntimeDescriptor {
  const finalize = options.finalize ?? finalizeCheckout

  return {
    id: COMMERCE_CHECKOUT_FINALIZE_SUBSCRIBER_ID,
    eventType: "payment.completed",
    register: ({ bindings, eventBus }) => {
      const runtimeBindings = bindings as TBindings
      eventBus.subscribe<PaymentCompletedPayload>(
        "payment.completed",
        async ({ data }, context) => {
          if (!data.bookingId) return
          const bookingId = data.bookingId
          const nestedEventBus = (context?.eventBus ?? eventBus) as EventBus

          try {
            await options.withDb(runtimeBindings, (db) =>
              finalize({
                db,
                eventBus: nestedEventBus,
                input: {
                  bookingId,
                  paymentSessionId: data.paymentSessionId,
                  paymentIntent: data.paymentIntent,
                },
                generateContractPdf: options.generateContractPdf,
              }),
            )
          } catch {
            // Durable outbox delivery owns retry; this subscriber remains idempotent.
          }
        },
        { inline: true },
      )
    },
  }
}

/** Selected-graph factory for acceptance-signature promotion. */
export const createAcceptanceSignatureSubscriberGraphRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) =>
    createAcceptanceSignatureSubscriberRuntime({
      ...(await getPort(catalogCheckoutDatabaseRuntimePort)),
      legal: await getPort(catalogCheckoutLegalRuntimePort),
    }),
)

/** Selected-graph factory for inline payment finalization. */
export const createCheckoutFinalizeSubscriberGraphRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) => {
    const [database, contractPdf] = await Promise.all([
      getPort(catalogCheckoutDatabaseRuntimePort),
      getPort(catalogCheckoutContractPdfRuntimePort),
    ])
    return {
      id: COMMERCE_CHECKOUT_FINALIZE_SUBSCRIBER_ID,
      eventType: "payment.completed",
      register: async (context: BootstrapContext) => {
        const descriptor = createCheckoutFinalizeSubscriberRuntime({
          ...database,
          generateContractPdf: (input) =>
            contractPdf.generate({ ...input, bindings: context.bindings }),
        })
        await descriptor.register(context)
      },
    }
  },
)
