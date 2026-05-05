import { describe, expect, it, vi } from "vitest"

import { createSmartbillSyncRuntime } from "../../src/runtime.js"
import type { SmartbillFetch } from "../../src/types.js"

const baseOptions = {
  username: "user@test.com",
  apiToken: "tok",
  companyVatCode: "RO12345678",
  seriesName: "A",
}

describe("createSmartbillSyncRuntime", () => {
  it("builds the default client, logger, mapper, and event names", () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const runtime = createSmartbillSyncRuntime({
      ...baseOptions,
      fetch: fetchMock,
    })

    expect(runtime.client).toBeDefined()
    expect(runtime.logger).toBe(console)
    expect(runtime.eventNames).toEqual({
      issued: "invoice.issued",
      proformaIssued: "invoice.proforma.issued",
      voided: "invoice.voided",
      syncRequested: "invoice.external.sync.requested",
    })
    expect(
      runtime.mapEvent({
        id: "inv_123",
        clientName: "Client SRL",
        currency: "RON",
        lineItems: [{ name: "Tour", quantity: 1, unitPrice: 50000 }],
      }),
    ).toMatchObject({
      companyVatCode: "RO12345678",
      seriesName: "A",
      client: { name: "Client SRL" },
    })
  })

  it("honors custom logger, mapper, and event names", () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const logger = { error: vi.fn(), info: vi.fn() }
    const mapEvent = vi.fn().mockReturnValue({
      companyVatCode: "CUSTOM",
      client: { name: "Custom" },
      seriesName: "Z",
      currency: "EUR",
      products: [],
    })

    const runtime = createSmartbillSyncRuntime({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      mapEvent,
      events: {
        issued: "custom.issued",
        voided: "custom.voided",
        syncRequested: "custom.sync",
      },
    })

    expect(runtime.logger).toBe(logger)
    expect(runtime.mapEvent).toBe(mapEvent)
    expect(runtime.eventNames).toEqual({
      issued: "custom.issued",
      proformaIssued: "invoice.proforma.issued",
      voided: "custom.voided",
      syncRequested: "custom.sync",
    })
  })
})
