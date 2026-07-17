import type { EventBus, ModuleContainer, SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { financeService } from "./service.js"
import { convertProformaToInvoice } from "./service-issue.js"

/**
 * Standard proforma → fiscal invoice conversion.
 *
 * A proforma is issued for deferred (bank-transfer) checkouts when the
 * operator runs the `proforma-first` invoicing mode, or by the manual
 * `POST /invoices/{id}/convert-to-invoice` flow. This subscriber watches
 * settlement signals (`invoice.settled` from the settlement poller and
 * `invoice.payment.recorded` from manual/processed payments) and converts
 * a fully-paid proforma to its fiscal invoice via
 * {@link convertProformaToInvoice} (which copies lines, assigns the fiscal
 * number, links both documents, and voids the proforma).
 *
 * The conversion is not gated on the invoicing mode: any fully-paid
 * proforma should mint its fiscal invoice, and the `invoiceType ===
 * "proforma"` guard already scopes it to proformas. Gating on the current
 * mode would strand a proforma that is still outstanding when an operator
 * switches from `proforma-first` to `direct`. When no proforma exists
 * (card checkouts, or bank transfer in `direct` mode) the subscriber
 * simply never fires. The conversion is idempotent (the service guards
 * against double-conversion under an advisory lock).
 */

export const FINANCE_PROFORMA_CONVERSION_SUBSCRIBER_ID =
  "@voyant-travel/finance#subscriber.proforma-conversion"
export const PROFORMA_CONVERSION_SUBSCRIBER_RUNTIME_KEY =
  "finance.proformaConversionSubscriberRuntime"

export interface ProformaConversionSubscriberRuntime {
  /** Resolve the deployment database and retain ownership of its lifecycle. */
  withDb<T>(bindings: unknown, operation: (db: PostgresJsDatabase) => Promise<T>): Promise<T>
  /** Event bus used to re-emit conversion events for downstream plugins. */
  eventBus?: EventBus
}

export interface ProformaConversionSubscriberDependencies {
  logger?: Pick<Console, "error" | "info">
}

/**
 * The settled-invoice signals this subscriber reacts to. `invoice.settled`
 * carries only `{ invoiceId, ... }`; `invoice.payment.recorded` carries
 * `{ invoiceId, ... }` too. Either way the invoice is re-read from the DB
 * (authoritative) rather than trusting the payload's derived fields.
 */
interface SettlementSignalPayload {
  invoiceId: string
}

const SETTLEMENT_EVENTS = ["invoice.settled", "invoice.payment.recorded"] as const

/** Build the package-owned descriptor resolved by selected-graph lowering. */
export function createProformaConversionSubscriberRuntime(
  dependencies: ProformaConversionSubscriberDependencies = {},
): SubscriberRuntimeDescriptor {
  const logger = dependencies.logger ?? console

  return {
    id: FINANCE_PROFORMA_CONVERSION_SUBSCRIBER_ID,
    eventType: "invoice.settled",
    register: ({ bindings, container, eventBus }) => {
      const handler = async ({ data }: { data: SettlementSignalPayload }) => {
        // Runtime is registered by the finance booking-schedule host wiring.
        // Absent → the deployment did not mount finance settlement → no-op.
        if (!container.has(PROFORMA_CONVERSION_SUBSCRIBER_RUNTIME_KEY)) return
        const runtime = resolveProformaConversionSubscriberRuntime(container)
        try {
          await runtime.withDb(bindings, async (db) => {
            const invoice = await financeService.getInvoiceById(db, data.invoiceId)
            if (!invoice) return
            // Only fully-settled proformas convert. Partial payments leave
            // the proforma outstanding until the balance is cleared.
            if (invoice.invoiceType !== "proforma" || invoice.balanceDueCents !== 0) return

            const result = await convertProformaToInvoice(
              db,
              invoice.id,
              {},
              { eventBus: runtime.eventBus ?? eventBus },
            )
            if (result.status !== "ok" && result.status !== "already_converted") {
              logger.error("[proforma-conversion] conversion did not complete", {
                invoiceId: invoice.id,
                status: result.status,
              })
            }
          })
        } catch (error) {
          logger.error("[proforma-conversion] failed to convert settled proforma", {
            invoiceId: data.invoiceId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      for (const eventType of SETTLEMENT_EVENTS) {
        eventBus.subscribe<SettlementSignalPayload>(eventType, handler)
      }
    },
  }
}

function resolveProformaConversionSubscriberRuntime(
  container: ModuleContainer,
): ProformaConversionSubscriberRuntime {
  if (!container.has(PROFORMA_CONVERSION_SUBSCRIBER_RUNTIME_KEY)) {
    throw new Error(
      `Proforma-conversion subscriber runtime is not registered at "${PROFORMA_CONVERSION_SUBSCRIBER_RUNTIME_KEY}".`,
    )
  }
  return container.resolve<ProformaConversionSubscriberRuntime>(
    PROFORMA_CONVERSION_SUBSCRIBER_RUNTIME_KEY,
  )
}

export const proformaConversionSubscriber = createProformaConversionSubscriberRuntime()
