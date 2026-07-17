import type { BootstrapContext, EventBus, SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { workflowRunnerRegistryRuntimePort } from "@voyant-travel/workflow-runs/runtime-port"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { commerceOperatorSettingsRuntimePort } from "../runtime-port.js"

import {
  type AcceptanceSignatureLegalPort,
  persistAcceptanceSignature,
} from "./acceptance-signature.js"
import {
  type CatalogCheckoutContractPdfGenerator,
  type CatalogCheckoutInvoicingModeResolver,
  dispatchCheckoutFinalize,
} from "./finalize.js"
import { registerCheckoutFinalizeWorkflowRunner } from "./runner-runtime.js"
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
  resolveInvoicingMode?: CatalogCheckoutInvoicingModeResolver
  dispatchFinalize?: typeof dispatchCheckoutFinalize
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
  const dispatchFinalize = options.dispatchFinalize ?? dispatchCheckoutFinalize

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
              dispatchFinalize({
                db,
                eventBus: nestedEventBus,
                input: {
                  bookingId,
                  paymentSessionId: data.paymentSessionId,
                  paymentIntent: data.paymentIntent,
                },
                trigger: "payment.completed",
                correlationId: data.paymentSessionId ?? null,
                tags: [
                  `bookingId:${bookingId}`,
                  ...(data.paymentSessionId ? [`paymentSessionId:${data.paymentSessionId}`] : []),
                  ...(data.paymentIntent ? [`paymentIntent:${data.paymentIntent}`] : []),
                ],
                generateContractPdf: options.generateContractPdf,
                resolveInvoicingMode: options.resolveInvoicingMode,
              }),
            )
          } catch {
            // The dispatcher records and logs workflow failures; delivery stays successful.
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

/** Selected-graph factory for inline payment finalization and dashboard runner registration. */
export const createCheckoutFinalizeSubscriberGraphRuntime = defineGraphRuntimeFactory(
  async ({ getPort, hasPort }) => {
    const [database, contractPdf, registry, operatorSettings] = await Promise.all([
      getPort(catalogCheckoutDatabaseRuntimePort),
      getPort(catalogCheckoutContractPdfRuntimePort),
      getPort(workflowRunnerRegistryRuntimePort),
      hasPort(commerceOperatorSettingsRuntimePort)
        ? getPort(commerceOperatorSettingsRuntimePort)
        : undefined,
    ])
    // The invoicing mode drives whether checkout mints a fiscal invoice
    // (`direct`) or a proforma (`proforma-first`). Read it off the same
    // operator-settings port that supplies the booking tax settings, so
    // no new port is invented. The port is optional: without it the
    // finalize saga keeps the historical `direct` behaviour.
    const resolveInvoicingMode: CatalogCheckoutInvoicingModeResolver | undefined = operatorSettings
      ? async (db) =>
          (await operatorSettings.resolveBookingTaxSettings(db)).invoicingMode ?? "direct"
      : undefined
    return {
      id: COMMERCE_CHECKOUT_FINALIZE_SUBSCRIBER_ID,
      eventType: "payment.completed",
      register: async (context: BootstrapContext) => {
        const generateContractPdf: CatalogCheckoutContractPdfGenerator = (input) =>
          contractPdf.generate({ ...input, bindings: context.bindings })
        const descriptor = createCheckoutFinalizeSubscriberRuntime({
          ...database,
          generateContractPdf,
          resolveInvoicingMode,
        })
        await descriptor.register(context)
        registerCheckoutFinalizeWorkflowRunner({
          registry,
          bindings: context.bindings,
          eventBus: context.eventBus,
          ...database,
          generateContractPdf,
          resolveInvoicingMode,
        })
      },
    }
  },
)
