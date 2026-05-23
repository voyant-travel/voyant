import { describe, expect, it } from "vitest"

import {
  mapClient,
  mapLineItems,
  mapVoyantInvoiceToSmartbill,
  mapVoyantInvoiceToSmartbillAsync,
} from "../../src/mapping.js"
import type { VoyantInvoiceEvent } from "../../src/types.js"

const defaultOptions = {
  companyVatCode: "RO12345678",
  seriesName: "A",
}

function event(overrides: Partial<VoyantInvoiceEvent> = {}): VoyantInvoiceEvent {
  return { id: "inv_test", ...overrides }
}

describe("mapClient", () => {
  it("extracts client fields from event", () => {
    const result = mapClient(
      event({
        clientName: "Acme SRL",
        clientVatCode: "RO999",
        clientAddress: "Str. Test 1",
        clientCity: "Bucharest",
        clientCounty: "B",
        clientCountry: "RO",
        clientEmail: "acme@test.com",
        clientPhone: "+40700000000",
      }),
    )
    expect(result.name).toBe("Acme SRL")
    expect(result.vatCode).toBe("RO999")
    expect(result.address).toBe("Str. Test 1")
    expect(result.city).toBe("Bucharest")
    expect(result.email).toBe("acme@test.com")
    expect(result.saveToDb).toBe(false)
  })

  it("falls back to customerName if clientName is missing", () => {
    const result = mapClient(event({ customerName: "Fallback Inc" }))
    expect(result.name).toBe("Fallback Inc")
  })

  it("uses 'Client' fallback for missing name", () => {
    const result = mapClient(event())
    expect(result.name).toBe("Client")
  })

  it("returns undefined for missing optional fields", () => {
    const result = mapClient(event())
    expect(result.vatCode).toBeUndefined()
    expect(result.address).toBeUndefined()
    expect(result.email).toBeUndefined()
  })
})

describe("mapLineItems", () => {
  it("maps an array of line items", () => {
    const result = mapLineItems(
      event({
        lineItems: [
          {
            description: "Safari Tour",
            code: "TOUR-1",
            unit: "buc",
            quantity: 2,
            unitPrice: 50000,
            currency: "RON",
            isService: true,
          },
        ],
      }),
      defaultOptions,
    )
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe("Safari Tour")
    expect(result[0]!.code).toBe("TOUR-1")
    expect(result[0]!.quantity).toBe(2)
    expect(result[0]!.price).toBe(50000)
    expect(result[0]!.isService).toBe(true)
    expect(result[0]!.isTaxIncluded).toBe(true)
  })

  it("returns empty array when no lineItems", () => {
    expect(mapLineItems(event(), defaultOptions)).toEqual([])
  })

  it("uses event.currency as fallback for item currency", () => {
    const result = mapLineItems(
      event({
        currency: "EUR",
        lineItems: [{ name: "X", quantity: 1, price: 10 }],
      }),
      defaultOptions,
    )
    expect(result[0]!.currency).toBe("EUR")
  })

  it("respects isTaxIncluded from options", () => {
    const result = mapLineItems(event({ lineItems: [{ name: "X", quantity: 1, price: 10 }] }), {
      ...defaultOptions,
      isTaxIncluded: false,
    })
    expect(result[0]!.isTaxIncluded).toBe(false)
  })

  it("passes through taxPercentage when present", () => {
    const result = mapLineItems(
      event({ lineItems: [{ name: "X", quantity: 1, price: 10, taxPercentage: 19 }] }),
      defaultOptions,
    )
    expect(result[0]!.taxPercentage).toBe(19)
  })

  it("omits taxPercentage when not present", () => {
    const result = mapLineItems(
      event({ lineItems: [{ name: "X", quantity: 1, price: 10 }] }),
      defaultOptions,
    )
    expect(result[0]!.taxPercentage).toBeUndefined()
  })
})

describe("mapVoyantInvoiceToSmartbill", () => {
  it("produces a complete SmartBill invoice body", () => {
    const result = mapVoyantInvoiceToSmartbill(
      event({
        clientName: "Test SRL",
        currency: "RON",
        issueDate: "2026-01-15",
        dueDate: "2026-02-15",
        lineItems: [{ name: "Tour Package", quantity: 1, unitPrice: 50000 }],
      }),
      defaultOptions,
    )
    expect(result.companyVatCode).toBe("RO12345678")
    expect(result.seriesName).toBe("A")
    expect(result.currency).toBe("RON")
    expect(result.language).toBe("RO")
    expect(result.client.name).toBe("Test SRL")
    expect(result.products).toHaveLength(1)
    expect(result.issueDate).toBe("2026-01-15")
    expect(result.dueDate).toBe("2026-02-15")
  })

  it("sets isDraft when event has isDraft=true", () => {
    const result = mapVoyantInvoiceToSmartbill(event({ isDraft: true }), defaultOptions)
    expect(result.isDraft).toBe(true)
  })

  it("asks SmartBill to allocate the number when external allocation is required", () => {
    const result = mapVoyantInvoiceToSmartbill(
      event({ externalAllocationRequired: true, invoiceNumber: "PENDING-INVOICE-1" }),
      defaultOptions,
    )
    expect(result.number).toBe("")
  })

  it("does not set isDraft when not present", () => {
    const result = mapVoyantInvoiceToSmartbill(event(), defaultOptions)
    expect(result.isDraft).toBeUndefined()
  })

  it("appends Art. 311 mention when art311SpecialRegime is true", () => {
    const result = mapVoyantInvoiceToSmartbill(event(), {
      ...defaultOptions,
      art311SpecialRegime: true,
    })
    expect(result.mentions).toContain("Art. 311")
  })

  it("appends Art. 311 to existing mentions", () => {
    const result = mapVoyantInvoiceToSmartbill(event({ mentions: "Custom note" }), {
      ...defaultOptions,
      art311SpecialRegime: true,
    })
    expect(result.mentions).toContain("Custom note")
    expect(result.mentions).toContain("Art. 311")
  })

  it("uses custom language", () => {
    const result = mapVoyantInvoiceToSmartbill(event(), {
      ...defaultOptions,
      language: "EN",
    })
    expect(result.language).toBe("EN")
  })

  it("defaults currency to RON", () => {
    const result = mapVoyantInvoiceToSmartbill(event(), defaultOptions)
    expect(result.currency).toBe("RON")
  })

  it("passes through observations", () => {
    const result = mapVoyantInvoiceToSmartbill(event({ observations: "Test obs" }), defaultOptions)
    expect(result.observations).toBe("Test obs")
  })

  it("maps effective FX rate to SmartBill exchangeRate", () => {
    const result = mapVoyantInvoiceToSmartbill(
      event({
        currency: "EUR",
        fxRate: 4.97,
        fxCommissionBps: 200,
        effectiveRate: 5.0694,
      }),
      defaultOptions,
    )

    expect(result.exchangeRate).toBe(5.0694)
  })

  it("appends FX commission mention when commission is non-zero", () => {
    const result = mapVoyantInvoiceToSmartbill(
      event({
        mentions: "Existing mention",
        fxCommissionBps: 200,
        fxCommissionInvoiceMention: "2% comision curs risc valutar",
      }),
      defaultOptions,
    )

    expect(result.mentions).toBe("Existing mention\n2% comision curs risc valutar")
  })

  it("resolves synchronous mapping callbacks", () => {
    const result = mapVoyantInvoiceToSmartbill(event({ channel: "proforma" }), {
      ...defaultOptions,
      seriesName: (invoice) => (invoice.channel === "proforma" ? "PF" : "A"),
      mentions: (invoice) => `Invoice ${invoice.id}`,
      observations: "Operator note",
    })
    expect(result.seriesName).toBe("PF")
    expect(result.mentions).toBe("Invoice inv_test")
    expect(result.observations).toBe("Operator note")
  })

  it("resolves async mapping callbacks", async () => {
    const result = await mapVoyantInvoiceToSmartbillAsync(event({ channel: "online" }), {
      ...defaultOptions,
      seriesName: async (invoice) => (invoice.channel === "online" ? "WEB" : "A"),
      mentions: async (invoice) => `Async ${invoice.id}`,
    })
    expect(result.seriesName).toBe("WEB")
    expect(result.mentions).toBe("Async inv_test")
  })

  it("uses custom Art. 311 text", () => {
    const result = mapVoyantInvoiceToSmartbill(event(), {
      ...defaultOptions,
      art311SpecialRegime: true,
      art311SpecialRegimeText: "Custom Art. 311 disclosure",
    })
    expect(result.mentions).toBe("Custom Art. 311 disclosure")
  })
})
