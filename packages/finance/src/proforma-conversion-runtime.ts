import type { EventBus, ModuleContainer, SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { InvoicingMode } from "./booking-tax.js"
import { financeService } from "./service.js"
import { convertProformaToInvoice } from "./service-issue.js"

/**
 * Standard proforma → fiscal invoice conversion.
 *
 * When the operator runs `invoicing.mode: "proforma-first"`, a proforma
 * is issued at checkout and the fiscal invoice is minted once the
 * proforma is fully settled. This subscriber watches settlement signals
 * (`invoice.settled` from the settlement poller and
 * `invoice.payment.recorded` from manual/processed payments) and, in
 * proforma-first mode only, converts a fully-paid proforma to its fiscal
 * invoice via {@link convertProformaToInvoice} (which copies lines,
 * assigns the fiscal number, links both documents, and voids the
 * proforma). `direct` mode is a no-op — zero behaviour change for
 * existing deployments — and the conversion is idempotent (the service
 * guards against double-conversion under an advisory lock).
 */

export const FINANCE_PROFORMA_CONVERSION_SUBSCRIBER_ID =
  "@voyant-travel/finance#subscriber.proforma-conversion"
export const PROFORMA_CONVERSION_SUBSCRIBER_RUNTIME_KEY =
  "finance.proformaConversionSubscriberRuntime"

export interface ProformaConversionSubscriberRuntime {
  /** Operator invoicing mode; defaults to `direct` when unconfigured. */
  resolveInvoicingMode(db: PostgresJsDatabase): Promise<InvoicingMode>
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
        // Runtime is only registered when the operator-settings port is
        // available. Absent → treat as `direct` mode → no-op.
        if (!container.has(PROFORMA_CONVERSION_SUBSCRIBER_RUNTIME_KEY)) return
        const runtime = resolveProformaConversionSubscriberRuntime(container)
        try {
          await runtime.withDb(bindings, async (db) => {
            if ((await runtime.resolveInvoicingMode(db)) !== "proforma-first") return

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
