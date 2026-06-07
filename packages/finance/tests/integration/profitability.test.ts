/**
 * Per-departure / per-product profitability read model (RFC §8):
 *  - revenue = issued customer invoices, split across a booking's departures by
 *    booked sell amount; credit notes net it down, proforma/draft/void excluded
 *  - actual cost = departure/product-targeted supplier_cost_allocations
 *  - planned cost = booking_items.totalCostAmountCents; variance = planned − actual
 *  - rows are emitted per currency and never summed across currencies
 */

import { bookingItems, bookings, bookingTravelers } from "@voyantjs/bookings/schema"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { exchangeRatesRef } from "../../src/markets-ref.js"
import { invoices } from "../../src/schema.js"
import { financeService } from "../../src/service.js"
import { supplierInvoicesService } from "../../src/service-supplier-invoices.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let seq = 0
const next = () => {
  seq += 1
  return seq
}

async function seedSupplierCost(
  // biome-ignore lint/suspicious/noExplicitAny: test db typing
  db: any,
  opts: {
    currency: string
    serviceType: "transport" | "flight" | "guide" | "other"
    amountCents: number
    target: { targetType: "departure"; departureId: string } | { targetType: "unattributed" }
  },
) {
  const created = await supplierInvoicesService.create(db, {
    supplierId: "supp_test",
    supplierInvoiceNo: `SINV-PROF-${String(next()).padStart(5, "0")}`,
    currency: opts.currency,
    issueDate: "2026-06-01",
    status: "approved",
    lines: [
      {
        description: opts.serviceType,
        serviceType: opts.serviceType,
        quantity: 1,
        unitAmountCents: opts.amountCents,
        taxAmountCents: 0,
        totalAmountCents: opts.amountCents,
        sortOrder: 0,
      },
    ],
  })
  const id = created?.id as string
  const lineId = created?.lines?.[0]?.id as string
  await supplierInvoicesService.setAllocations(db, id, {
    allocations: [
      opts.target.targetType === "departure"
        ? {
            targetType: "departure",
            departureId: opts.target.departureId,
            supplierInvoiceLineId: lineId,
            amountCents: opts.amountCents,
          }
        : {
            targetType: "unattributed",
            supplierInvoiceLineId: lineId,
            amountCents: opts.amountCents,
          },
    ],
  })
}

describe.skipIf(!DB_AVAILABLE)("profitability read model", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    seq = 0
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    await closeTestDb()
  })

  async function seedBaseScenario() {
    // B1: one item on D1 (EUR). B2: two items split across D1 + D2 (EUR).
    await db.insert(bookings).values([
      {
        id: "book_b1",
        bookingNumber: "BKG-B1",
        status: "confirmed",
        sellCurrency: "EUR",
        startDate: "2026-07-01",
      },
      {
        id: "book_b2",
        bookingNumber: "BKG-B2",
        status: "confirmed",
        sellCurrency: "EUR",
        startDate: "2026-07-01",
      },
    ])
    await db.insert(bookingItems).values([
      {
        bookingId: "book_b1",
        title: "Tour P1",
        availabilitySlotId: "avsl_d1",
        productId: "prod_p1",
        productNameSnapshot: "Tour P1",
        departureLabelSnapshot: "P1 · Jul 1",
        startsAt: new Date("2026-07-01T09:00:00Z"),
        quantity: 1,
        sellCurrency: "EUR",
        totalSellAmountCents: 100000,
        costCurrency: "EUR",
        totalCostAmountCents: 60000,
      },
      {
        bookingId: "book_b2",
        title: "Tour P1",
        availabilitySlotId: "avsl_d1",
        productId: "prod_p1",
        productNameSnapshot: "Tour P1",
        departureLabelSnapshot: "P1 · Jul 1",
        startsAt: new Date("2026-07-01T09:00:00Z"),
        quantity: 1,
        sellCurrency: "EUR",
        totalSellAmountCents: 50000,
        costCurrency: "EUR",
        totalCostAmountCents: 30000,
      },
      {
        bookingId: "book_b2",
        title: "Tour P1",
        availabilitySlotId: "avsl_d2",
        productId: "prod_p1",
        productNameSnapshot: "Tour P1",
        departureLabelSnapshot: "P1 · Jul 8",
        startsAt: new Date("2026-07-08T09:00:00Z"),
        quantity: 1,
        sellCurrency: "EUR",
        totalSellAmountCents: 50000,
        costCurrency: "EUR",
        totalCostAmountCents: 30000,
      },
    ])
    await db.insert(invoices).values([
      {
        invoiceNumber: "INV-B1",
        invoiceType: "invoice",
        status: "issued",
        bookingId: "book_b1",
        currency: "EUR",
        totalCents: 100000,
        paidCents: 0,
        balanceDueCents: 100000,
        issueDate: "2026-06-15",
        dueDate: "2026-06-30",
      },
      {
        invoiceNumber: "INV-B2",
        invoiceType: "invoice",
        status: "issued",
        bookingId: "book_b2",
        currency: "EUR",
        totalCents: 100000,
        paidCents: 0,
        balanceDueCents: 100000,
        issueDate: "2026-06-15",
        dueDate: "2026-06-30",
      },
    ])
    // Actual supplier costs: D1 70000 EUR, D2 40000 EUR, D1 20000 RON, plus 5000 EUR unattributed.
    await seedSupplierCost(db, {
      currency: "EUR",
      serviceType: "transport",
      amountCents: 70000,
      target: { targetType: "departure", departureId: "avsl_d1" },
    })
    await seedSupplierCost(db, {
      currency: "EUR",
      serviceType: "guide",
      amountCents: 40000,
      target: { targetType: "departure", departureId: "avsl_d2" },
    })
    await seedSupplierCost(db, {
      currency: "RON",
      serviceType: "transport",
      amountCents: 20000,
      target: { targetType: "departure", departureId: "avsl_d1" },
    })
    await seedSupplierCost(db, {
      currency: "EUR",
      serviceType: "other",
      amountCents: 5000,
      target: { targetType: "unattributed" },
    })
  }

  it("computes per-departure P&L with proportional revenue split and per-currency rows", async () => {
    await seedBaseScenario()
    const report = await financeService.getDepartureProfitability(db, {})

    const d1Eur = report.rows.find((r) => r.departureId === "avsl_d1" && r.currency === "EUR")
    expect(d1Eur).toMatchObject({
      revenueCents: 150000, // B1 100000 + B2 split 50% of 100000
      actualCostCents: 70000,
      plannedCostCents: 90000, // 60000 + 30000
      profitCents: 80000,
      varianceCents: 20000,
      productName: "Tour P1",
      departureDate: "2026-07-01",
    })
    expect(d1Eur?.marginPercent).toBeCloseTo(53.3, 1)

    const d2Eur = report.rows.find((r) => r.departureId === "avsl_d2" && r.currency === "EUR")
    expect(d2Eur).toMatchObject({
      revenueCents: 50000,
      actualCostCents: 40000,
      plannedCostCents: 30000,
      profitCents: 10000,
      varianceCents: -10000,
    })
    expect(d2Eur?.marginPercent).toBeCloseTo(20, 1)

    // RON cost on D1 is its own row — never summed with the EUR figures.
    const d1Ron = report.rows.find((r) => r.departureId === "avsl_d1" && r.currency === "RON")
    expect(d1Ron).toMatchObject({
      revenueCents: 0,
      actualCostCents: 20000,
      profitCents: -20000,
      marginPercent: null,
    })

    expect(report.unattributed).toContainEqual({ currency: "EUR", amountCents: 5000 })
    expect(report.costByServiceType).toContainEqual({
      serviceType: "transport",
      currency: "EUR",
      amountCents: 70000,
    })
    expect(report.costByServiceType).toContainEqual({
      serviceType: "guide",
      currency: "EUR",
      amountCents: 40000,
    })
  })

  it("rolls up profitability per product across departures", async () => {
    await seedBaseScenario()
    const report = await financeService.getProductProfitability(db, {})

    const p1Eur = report.rows.find((r) => r.productId === "prod_p1" && r.currency === "EUR")
    expect(p1Eur).toMatchObject({
      departureCount: 2,
      revenueCents: 200000, // 150000 + 50000
      actualCostCents: 110000, // 70000 + 40000
      plannedCostCents: 120000,
      profitCents: 90000,
      varianceCents: 10000,
    })
    expect(p1Eur?.marginPercent).toBeCloseTo(45, 1)

    const p1Ron = report.rows.find((r) => r.productId === "prod_p1" && r.currency === "RON")
    expect(p1Ron).toMatchObject({ actualCostCents: 20000, revenueCents: 0, departureCount: 1 })
  })

  it("excludes proforma/draft/void invoices and nets credit notes", async () => {
    await db.insert(bookings).values({
      id: "book_c",
      bookingNumber: "BKG-C",
      status: "confirmed",
      sellCurrency: "EUR",
      startDate: "2026-07-01",
    })
    await db.insert(bookingItems).values({
      bookingId: "book_c",
      title: "Tour C",
      availabilitySlotId: "avsl_c",
      productId: "prod_c",
      startsAt: new Date("2026-07-01T09:00:00Z"),
      quantity: 1,
      sellCurrency: "EUR",
      totalSellAmountCents: 100000,
      costCurrency: "EUR",
      totalCostAmountCents: 50000,
    })
    await db.insert(invoices).values([
      {
        invoiceNumber: "INV-C-ISSUED",
        invoiceType: "invoice",
        status: "issued",
        bookingId: "book_c",
        currency: "EUR",
        totalCents: 100000,
        paidCents: 0,
        balanceDueCents: 100000,
        issueDate: "2026-06-15",
        dueDate: "2026-06-30",
      },
      {
        invoiceNumber: "INV-C-DRAFT",
        invoiceType: "invoice",
        status: "draft",
        bookingId: "book_c",
        currency: "EUR",
        totalCents: 999900,
        paidCents: 0,
        balanceDueCents: 999900,
        issueDate: "2026-06-15",
        dueDate: "2026-06-30",
      },
      {
        invoiceNumber: "INV-C-VOID",
        invoiceType: "invoice",
        status: "void",
        bookingId: "book_c",
        currency: "EUR",
        totalCents: 999900,
        paidCents: 0,
        balanceDueCents: 0,
        issueDate: "2026-06-15",
        dueDate: "2026-06-30",
      },
      {
        invoiceNumber: "INV-C-PROFORMA",
        invoiceType: "proforma",
        status: "issued",
        bookingId: "book_c",
        currency: "EUR",
        totalCents: 999900,
        paidCents: 0,
        balanceDueCents: 999900,
        issueDate: "2026-06-15",
        dueDate: "2026-06-30",
      },
      {
        invoiceNumber: "CN-C",
        invoiceType: "credit_note",
        status: "issued",
        bookingId: "book_c",
        currency: "EUR",
        totalCents: 30000,
        paidCents: 0,
        balanceDueCents: 0,
        issueDate: "2026-06-20",
        dueDate: "2026-06-20",
      },
    ])

    const report = await financeService.getDepartureProfitability(db, {})
    const row = report.rows.find((r) => r.departureId === "avsl_c" && r.currency === "EUR")
    // 100000 issued − 30000 credit note; draft/void/proforma ignored.
    expect(row?.revenueCents).toBe(70000)
  })

  it("filters departures by date range and currency", async () => {
    await seedBaseScenario()
    const onlyD2 = await financeService.getDepartureProfitability(db, { from: "2026-07-05" })
    expect(onlyD2.rows.every((r) => r.departureId === "avsl_d2")).toBe(true)

    const onlyRon = await financeService.getDepartureProfitability(db, { currency: "RON" })
    expect(onlyRon.rows.every((r) => r.currency === "RON")).toBe(true)
    expect(onlyRon.rows.length).toBeGreaterThan(0)
  })

  it("rolls up to a base currency via persisted FX rates", async () => {
    await seedBaseScenario()
    // 1 RON = 0.2 EUR (fx_rate_sets lives in @voyantjs/markets; seed via raw SQL)
    await db.execute(
      sql`insert into fx_rate_sets (id, base_currency, effective_at) values ('fxrs_test', 'EUR', now())`,
    )
    await db.insert(exchangeRatesRef).values({
      fxRateSetId: "fxrs_test",
      baseCurrency: "RON",
      quoteCurrency: "EUR",
      rateDecimal: "0.2",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    })

    const report = await financeService.getDepartureProfitability(db, { baseCurrency: "EUR" })
    expect(report.base?.currency).toBe("EUR")
    expect(report.base?.unconvertibleCurrencies).toEqual([])

    // D1 actual = 70000 EUR + (20000 RON × 0.2 = 4000 EUR) = 74000 EUR.
    const d1 = report.base?.rows.find((r) => r.departureId === "avsl_d1")
    expect(d1).toMatchObject({
      currency: "EUR",
      revenueCents: 150000,
      actualCostCents: 74000,
      plannedCostCents: 90000,
      profitCents: 76000,
      varianceCents: 16000,
    })

    expect(report.base?.costByServiceType).toContainEqual({
      serviceType: "transport",
      currency: "EUR",
      amountCents: 74000, // 70000 EUR + 4000 (RON→EUR)
    })
    expect(report.base?.unattributedCents).toBe(5000)
  })

  it("flags unconvertible currencies when no FX rate exists", async () => {
    await seedBaseScenario()
    const report = await financeService.getDepartureProfitability(db, { baseCurrency: "USD" })
    expect(report.base?.unconvertibleCurrencies.sort()).toEqual(["EUR", "RON"])
    expect(report.base?.rows).toHaveLength(0)
  })

  it("splits a departure's revenue and cost across its travellers (equal)", async () => {
    await db.insert(bookings).values({
      id: "book_t1",
      bookingNumber: "BKG-T1",
      status: "confirmed",
      sellCurrency: "EUR",
      startDate: "2026-07-01",
    })
    await db.insert(bookingItems).values({
      bookingId: "book_t1",
      title: "Tour T",
      availabilitySlotId: "avsl_t",
      productId: "prod_t",
      startsAt: new Date("2026-07-01T09:00:00Z"),
      quantity: 3,
      sellCurrency: "EUR",
      totalSellAmountCents: 120000,
      costCurrency: "EUR",
      totalCostAmountCents: 60000,
    })
    await db.insert(invoices).values({
      invoiceNumber: "INV-T1",
      invoiceType: "invoice",
      status: "issued",
      bookingId: "book_t1",
      currency: "EUR",
      totalCents: 120000,
      paidCents: 0,
      balanceDueCents: 120000,
      issueDate: "2026-06-15",
      dueDate: "2026-06-30",
    })
    await db.insert(bookingTravelers).values([
      { bookingId: "book_t1", firstName: "Alice", lastName: "A", participantType: "traveler" },
      { bookingId: "book_t1", firstName: "Bob", lastName: "B", participantType: "traveler" },
      { bookingId: "book_t1", firstName: "Cara", lastName: "C", participantType: "traveler" },
      // Non-traveller participant — excluded from the split.
      { bookingId: "book_t1", firstName: "Dan", lastName: "D", participantType: "other" },
    ])
    await seedSupplierCost(db, {
      currency: "EUR",
      serviceType: "transport",
      amountCents: 90000,
      target: { targetType: "departure", departureId: "avsl_t" },
    })

    const report = await financeService.getTravelerProfitability(db, {
      departureId: "avsl_t",
      currency: "EUR",
    })
    expect(report.travelerCount).toBe(3)
    expect(report.rows).toHaveLength(3)
    // 120000 revenue / 3 = 40000; 90000 actual / 3 = 30000; 60000 planned / 3 = 20000.
    for (const row of report.rows) {
      expect(row).toMatchObject({
        revenueCents: 40000,
        actualCostCents: 30000,
        plannedCostCents: 20000,
        profitCents: 10000,
        varianceCents: -10000,
      })
      expect(row.marginPercent).toBeCloseTo(25, 1)
    }
  })
})
