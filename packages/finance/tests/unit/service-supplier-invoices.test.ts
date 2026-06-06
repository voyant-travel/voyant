import { describe, expect, it } from "vitest"

import {
  recomputeTotalsFromLines,
  validateAllocations,
} from "../../src/service-supplier-invoices.js"

describe("recomputeTotalsFromLines", () => {
  it("derives subtotal/tax/total from line totals (total includes tax)", () => {
    const totals = recomputeTotalsFromLines([
      {
        description: "Coach",
        serviceType: "transport",
        quantity: 1,
        unitAmountCents: 480000,
        taxAmountCents: 0,
        totalAmountCents: 480000,
        sortOrder: 0,
      },
      {
        description: "Guide",
        serviceType: "guide",
        quantity: 2,
        unitAmountCents: 45000,
        taxAmountCents: 19000,
        totalAmountCents: 109000,
        sortOrder: 1,
      },
    ])
    expect(totals.totalCents).toBe(589000)
    expect(totals.taxCents).toBe(19000)
    expect(totals.subtotalCents).toBe(570000)
  })

  it("is zero for no lines", () => {
    expect(recomputeTotalsFromLines([])).toEqual({
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
    })
  })
})

describe("validateAllocations (§6.1 invariants)", () => {
  it("allows zero allocations (under-allocation is fine)", () => {
    expect(validateAllocations({ invoiceTotalCents: 1000, lines: [], allocations: [] })).toEqual({
      ok: true,
    })
  })

  it("rejects mixing whole-invoice and per-line allocations", () => {
    const result = validateAllocations({
      invoiceTotalCents: 1000,
      lines: [{ id: "sinl_1", totalAmountCents: 1000 }],
      allocations: [
        { supplierInvoiceLineId: null, amountCents: 400 },
        { supplierInvoiceLineId: "sinl_1", amountCents: 600 },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("mixed_allocation_modes")
  })

  it("rejects whole-invoice over-allocation", () => {
    const result = validateAllocations({
      invoiceTotalCents: 1000,
      lines: [],
      allocations: [
        { supplierInvoiceLineId: null, amountCents: 700 },
        { supplierInvoiceLineId: null, amountCents: 400 },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("over_allocated")
  })

  it("allows whole-invoice allocation up to the total (split across departures)", () => {
    expect(
      validateAllocations({
        invoiceTotalCents: 1000,
        lines: [],
        allocations: [
          { supplierInvoiceLineId: null, amountCents: 600 },
          { supplierInvoiceLineId: null, amountCents: 400 },
        ],
      }),
    ).toEqual({ ok: true })
  })

  it("allows under-allocation (remainder reported as unattributed, not stored)", () => {
    expect(
      validateAllocations({
        invoiceTotalCents: 1000,
        lines: [],
        allocations: [{ supplierInvoiceLineId: null, amountCents: 600 }],
      }),
    ).toEqual({ ok: true })
  })

  it("rejects per-line over-allocation for a single line", () => {
    const result = validateAllocations({
      invoiceTotalCents: 1000,
      lines: [
        { id: "sinl_1", totalAmountCents: 600 },
        { id: "sinl_2", totalAmountCents: 400 },
      ],
      allocations: [
        { supplierInvoiceLineId: "sinl_1", amountCents: 300 },
        { supplierInvoiceLineId: "sinl_1", amountCents: 400 },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("over_allocated")
  })

  it("allows per-line allocations that split a line within its total", () => {
    expect(
      validateAllocations({
        invoiceTotalCents: 1000,
        lines: [{ id: "sinl_1", totalAmountCents: 600 }],
        allocations: [
          { supplierInvoiceLineId: "sinl_1", amountCents: 300 },
          { supplierInvoiceLineId: "sinl_1", amountCents: 300 },
        ],
      }),
    ).toEqual({ ok: true })
  })

  it("rejects allocations referencing an unknown line", () => {
    const result = validateAllocations({
      invoiceTotalCents: 1000,
      lines: [{ id: "sinl_1", totalAmountCents: 600 }],
      allocations: [{ supplierInvoiceLineId: "sinl_missing", amountCents: 100 }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("unknown_allocation_line")
  })
})
