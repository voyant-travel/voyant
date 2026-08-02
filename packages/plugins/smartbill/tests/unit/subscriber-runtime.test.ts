import type { BootstrapContext, EventEnvelope } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import type { SmartbillRuntimeHost } from "../../src/graph-runtime.js"
import {
  SMARTBILL_RUNTIME_HOST_KEY,
  smartbillInvoiceIssuedSubscriber,
  smartbillPaymentRecordedSubscriber,
  smartbillProformaIssuedSubscriber,
} from "../../src/subscriber-runtime.js"

const descriptors = [
  smartbillInvoiceIssuedSubscriber,
  smartbillProformaIssuedSubscriber,
  smartbillPaymentRecordedSubscriber,
]

function contextWithHost(host: SmartbillRuntimeHost) {
  return {
    bindings: {},
    container: {
      has: vi.fn((key: string) => key === SMARTBILL_RUNTIME_HOST_KEY),
      resolve: vi.fn(() => host),
    },
    eventBus: { subscribe: vi.fn() },
  } as unknown as BootstrapContext
}

describe("SmartBill subscriber runtimes", () => {
  it.each(descriptors)("owns the stable graph runtime %s", (descriptor) => {
    expect(descriptor.id).toContain("@voyant-travel/plugin-smartbill#subscriber.")
    expect(descriptor.eventType).toBeTruthy()
  })

  it("keeps disabled configuration out of the event bus", async () => {
    const host: SmartbillRuntimeHost = {
      resolveConfig: () => null,
      resolveDatabase: vi.fn(),
    }
    const context = contextWithHost(host)

    await smartbillInvoiceIssuedSubscriber.register(context)

    expect(context.container.resolve).toHaveBeenCalledWith(SMARTBILL_RUNTIME_HOST_KEY)
    expect(context.eventBus.subscribe).not.toHaveBeenCalled()
    expect(host.resolveDatabase).not.toHaveBeenCalled()
  })

  it("fails clearly when the generic host adapter is unavailable", async () => {
    const context = {
      bindings: {},
      container: { has: () => false },
      eventBus: { subscribe: (_eventType: string, _handler: (event: EventEnvelope) => void) => {} },
    } as unknown as BootstrapContext

    await expect(smartbillInvoiceIssuedSubscriber.register(context)).rejects.toThrow(
      SMARTBILL_RUNTIME_HOST_KEY,
    )
  })
})
