import type { EventEnvelope } from "@voyant-travel/core"
import { createContainer, createEventBus } from "@voyant-travel/core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getInvoiceById = vi.fn()
const convertProformaToInvoice = vi.fn()

vi.mock("../../src/service.js", () => ({
  financeService: { getInvoiceById },
}))
vi.mock("../../src/service-issue.js", () => ({
  convertProformaToInvoice,
}))

const {
  createProformaConversionSubscriberRuntime,
  FINANCE_PROFORMA_CONVERSION_SUBSCRIBER_ID,
  PROFORMA_CONVERSION_SUBSCRIBER_RUNTIME_KEY,
} = await import("../../src/proforma-conversion-runtime.js")

interface HarnessOptions {
  invoice?: { id: string; invoiceType: string; balanceDueCents: number } | null
  registerRuntime?: boolean
}

function setup(options: HarnessOptions = {}) {
  const db = {} as never
  const bindings = { DATABASE_URL: "postgres://finance" }
  const withDb = vi.fn(async (_bindings: unknown, operation: (db: never) => Promise<unknown>) =>
    operation(db),
  )
  const eventBus = createEventBus()
  const container = createContainer()
  if (options.registerRuntime !== false) {
    container.register(PROFORMA_CONVERSION_SUBSCRIBER_RUNTIME_KEY, {
      withDb,
      eventBus,
    })
  }
  const handlers: Array<(event: EventEnvelope) => Promise<void> | void> = []
  vi.spyOn(eventBus, "subscribe").mockImplementation((_eventType, registeredHandler) => {
    handlers.push(registeredHandler as (event: EventEnvelope) => Promise<void> | void)
    return { unsubscribe: vi.fn() }
  })
  getInvoiceById.mockResolvedValue(options.invoice ?? null)
  convertProformaToInvoice.mockResolvedValue({ status: "ok", invoice: { id: "inv_final" } })
  return { bindings, container, eventBus, handlers, withDb }
}

const settledEnvelope = (invoiceId: string): EventEnvelope => ({
  name: "invoice.settled",
  data: { invoiceId },
  emittedAt: new Date().toISOString(),
  metadata: undefined,
})

describe("finance proforma-conversion subscriber runtime", () => {
  beforeEach(() => {
    getInvoiceById.mockReset()
    convertProformaToInvoice.mockReset()
  })

  it("exposes the package-owned descriptor identity and subscribes to both settlement events", async () => {
    const { bindings, container, eventBus } = setup()
    const descriptor = createProformaConversionSubscriberRuntime()

    await descriptor.register({ bindings, container, eventBus })

    expect({ id: descriptor.id, eventType: descriptor.eventType }).toEqual({
      id: FINANCE_PROFORMA_CONVERSION_SUBSCRIBER_ID,
      eventType: "invoice.settled",
    })
    expect(eventBus.subscribe).toHaveBeenCalledWith("invoice.settled", expect.any(Function))
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      "invoice.payment.recorded",
      expect.any(Function),
    )
  })

  it("converts any fully-paid proforma regardless of the operator mode", async () => {
    // The conversion is not gated on the invoicing mode: a fully-paid
    // proforma should always mint its fiscal invoice, so a proforma left
    // outstanding after a mode switch still converts.
    const harness = setup({
      invoice: { id: "inv_proforma", invoiceType: "proforma", balanceDueCents: 0 },
    })
    const descriptor = createProformaConversionSubscriberRuntime()
    await descriptor.register(harness)

    await harness.handlers[0]?.(settledEnvelope("inv_proforma"))

    expect(getInvoiceById).toHaveBeenCalledWith(expect.anything(), "inv_proforma")
    expect(convertProformaToInvoice).toHaveBeenCalledWith(
      expect.anything(),
      "inv_proforma",
      {},
      expect.objectContaining({ eventBus: expect.anything() }),
    )
  })

  it("ignores non-proforma invoices and partially-paid proformas", async () => {
    const finalInvoice = setup({
      invoice: { id: "inv_final", invoiceType: "invoice", balanceDueCents: 0 },
    })
    const finalDescriptor = createProformaConversionSubscriberRuntime()
    await finalDescriptor.register(finalInvoice)
    await finalInvoice.handlers[0]?.(settledEnvelope("inv_final"))
    expect(convertProformaToInvoice).not.toHaveBeenCalled()

    const partial = setup({
      invoice: { id: "inv_partial", invoiceType: "proforma", balanceDueCents: 500 },
    })
    const partialDescriptor = createProformaConversionSubscriberRuntime()
    await partialDescriptor.register(partial)
    await partial.handlers[0]?.(settledEnvelope("inv_partial"))
    expect(convertProformaToInvoice).not.toHaveBeenCalled()
  })

  it("no-ops when the runtime is not registered (finance settlement absent)", async () => {
    const harness = setup({ registerRuntime: false })
    const descriptor = createProformaConversionSubscriberRuntime()
    await descriptor.register(harness)

    await expect(harness.handlers[0]?.(settledEnvelope("inv_x"))).resolves.toBeUndefined()
    expect(getInvoiceById).not.toHaveBeenCalled()
    expect(convertProformaToInvoice).not.toHaveBeenCalled()
  })

  it("logs conversion failures without rejecting event delivery", async () => {
    const harness = setup({
      invoice: { id: "inv_proforma", invoiceType: "proforma", balanceDueCents: 0 },
    })
    convertProformaToInvoice.mockRejectedValueOnce(new Error("db down"))
    const logger = { error: vi.fn(), info: vi.fn() }
    const descriptor = createProformaConversionSubscriberRuntime({ logger })
    await descriptor.register(harness)

    await expect(harness.handlers[0]?.(settledEnvelope("inv_proforma"))).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      "[proforma-conversion] failed to convert settled proforma",
      expect.objectContaining({ invoiceId: "inv_proforma", error: "db down" }),
    )
  })
})
