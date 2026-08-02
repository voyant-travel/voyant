import type { BootstrapContext, EventEnvelope } from "@voyant-travel/core"

import {
  createSmartbillOwnedSubscriberRuntime,
  type SmartbillOwnedSubscriberRuntime,
  type SmartbillRuntimeHost,
} from "./graph-runtime.js"
import { SMARTBILL_RUNTIME_HOST_KEY } from "./runtime-port.js"

export { SMARTBILL_RUNTIME_HOST_KEY } from "./runtime-port.js"

export interface SmartbillSubscriberRuntimeDescriptor {
  readonly id: string
  readonly eventType: string
  readonly register: (context: BootstrapContext) => Promise<void> | void
}

type SmartbillSubscriberRuntimeHandler = keyof Omit<SmartbillOwnedSubscriberRuntime, "bootstrap">

const runtimes = new WeakMap<object, Promise<SmartbillOwnedSubscriberRuntime | null>>()

function resolveRuntime(
  context: BootstrapContext,
): Promise<SmartbillOwnedSubscriberRuntime | null> {
  const container = context.container as object
  const existing = runtimes.get(container)
  if (existing) return existing

  const initializing = (async () => {
    if (!context.container.has(SMARTBILL_RUNTIME_HOST_KEY)) {
      throw new Error(`SmartBill host is not registered at "${SMARTBILL_RUNTIME_HOST_KEY}".`)
    }
    const host = context.container.resolve<SmartbillRuntimeHost>(SMARTBILL_RUNTIME_HOST_KEY)
    const runtime = createSmartbillOwnedSubscriberRuntime(host, context.bindings)
    await runtime?.bootstrap()
    return runtime
  })()
  runtimes.set(container, initializing)
  return initializing
}

function defineSmartbillSubscriberRuntime(
  id: string,
  eventType: string,
  handler: SmartbillSubscriberRuntimeHandler,
): SmartbillSubscriberRuntimeDescriptor {
  return {
    id,
    eventType,
    register: async (context) => {
      const runtime = await resolveRuntime(context)
      if (!runtime) return
      context.eventBus.subscribe(eventType, async (envelope: EventEnvelope) => {
        await runtime[handler](envelope)
      })
    },
  }
}

export const smartbillInvoiceIssuedSubscriber = defineSmartbillSubscriberRuntime(
  "@voyant-travel/plugin-smartbill#subscriber.invoice-issued",
  "invoice.issued",
  "invoiceIssued",
)

export const smartbillProformaIssuedSubscriber = defineSmartbillSubscriberRuntime(
  "@voyant-travel/plugin-smartbill#subscriber.proforma-issued",
  "invoice.proforma.issued",
  "proformaIssued",
)

export const smartbillPaymentRecordedSubscriber = defineSmartbillSubscriberRuntime(
  "@voyant-travel/plugin-smartbill#subscriber.payment-recorded",
  "invoice.payment.recorded",
  "paymentRecorded",
)
