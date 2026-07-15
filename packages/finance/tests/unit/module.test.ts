import { createContainer, createEventBus } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import {
  createFinanceApiModule,
  FINANCE_CHECKOUT_ROUTE_RUNTIME_CONTAINER_KEY,
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
} from "../../src/index.js"

describe("createFinanceApiModule", () => {
  it("registers finance route runtime during bootstrap", () => {
    const generator = vi.fn()
    const poller = vi.fn()
    const eventBus = createEventBus()
    const resolveInvoiceDocumentGenerator = vi.fn(() => generator)
    const resolveInvoiceSettlementPollers = vi.fn(() => ({ netopia: poller }))
    const resolveEventBus = vi.fn(() => eventBus)
    const notificationDispatcher = {
      sendInvoiceNotification: vi.fn(),
      sendPaymentSessionNotification: vi.fn(),
    }
    const paymentStarter = vi.fn()
    const resolveNotificationDispatcher = vi.fn(() => notificationDispatcher)
    const resolvePaymentStarters = vi.fn(() => ({ netopia: paymentStarter }))
    const resolveBankTransferDetails = vi.fn(() => ({
      provider: "manual",
      beneficiary: "Voyant",
      iban: "RO49AAAA1B31007593840000",
    }))
    const container = createContainer()
    const bindings = { NETOPIA_SIGNATURE: "sig" }

    const module = createFinanceApiModule({
      resolveInvoiceDocumentGenerator,
      resolveInvoiceSettlementPollers,
      resolveEventBus,
      resolveNotificationDispatcher,
      resolvePaymentStarters,
      resolveBankTransferDetails,
    }).module

    module.bootstrap?.({ bindings, container })

    const runtime = container.resolve(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)

    expect(resolveInvoiceDocumentGenerator).toHaveBeenCalledTimes(1)
    expect(resolveInvoiceSettlementPollers).toHaveBeenCalledTimes(1)
    expect(resolveEventBus).toHaveBeenCalledTimes(1)
    expect(runtime?.invoiceDocumentGenerator).toBe(generator)
    expect(runtime?.invoiceSettlementPollers.netopia).toBe(poller)
    expect(runtime?.eventBus).toBe(eventBus)

    const checkoutRuntime = container.resolve(FINANCE_CHECKOUT_ROUTE_RUNTIME_CONTAINER_KEY)
    expect(resolveNotificationDispatcher).toHaveBeenCalledTimes(1)
    expect(resolvePaymentStarters).toHaveBeenCalledTimes(1)
    expect(resolveBankTransferDetails).toHaveBeenCalledTimes(1)
    expect(checkoutRuntime?.notificationDispatcher).toBe(notificationDispatcher)
    expect(checkoutRuntime?.paymentStarters.netopia).toBe(paymentStarter)
    expect(checkoutRuntime?.bankTransferDetails).toEqual({
      provider: "manual",
      beneficiary: "Voyant",
      iban: "RO49AAAA1B31007593840000",
    })
  })
})
