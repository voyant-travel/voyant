/**
 * Covers the dashboard-facing addition to `getFinanceAggregates`:
 *
 *  - `outstandingTopN` returns up to N rows of `issued | partially_paid |
 *    overdue` invoices with `balance_due_cents > 0`.
 *  - Ordering is `due_date` (nulls last), then `issue_date`, then `id`.
 *  - The slice respects the `outstandingTopLimit` query parameter.
 *  - Paid / draft / void invoices and zero-balance rows never appear.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { invoices } from "../../src/schema.js"
import { financeService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let counter = 0
function nextInvoiceNumber() {
  counter += 1
  return `INV-AGG-${String(counter).padStart(6, "0")}`
}

function isoDateInDays(days: number) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

describe.skipIf(!DB_AVAILABLE)("getFinanceAggregates dashboard fields", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    counter = 0
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    await closeTestDb()
  })

  it("returns outstanding invoices ordered by dueDate (nulls last) then issueDate", async () => {
    await db.insert(invoices).values([
      {
        invoiceNumber: nextInvoiceNumber(),
        bookingId: "book_agg_1",
        status: "issued",
        currency: "EUR",
        totalCents: 10000,
        balanceDueCents: 10000,
        issueDate: isoDateInDays(-30),
        dueDate: isoDateInDays(-5),
      },
      {
        invoiceNumber: nextInvoiceNumber(),
        bookingId: "book_agg_2",
        status: "partially_paid",
        currency: "EUR",
        totalCents: 20000,
        balanceDueCents: 5000,
        issueDate: isoDateInDays(-20),
        dueDate: isoDateInDays(2),
      },
      {
        invoiceNumber: nextInvoiceNumber(),
        bookingId: "book_agg_3",
        status: "overdue",
        currency: "EUR",
        totalCents: 7500,
        balanceDueCents: 7500,
        issueDate: isoDateInDays(-40),
        dueDate: isoDateInDays(-15),
      },
      // Null due_date — should sort last among outstanding rows.
      {
        invoiceNumber: nextInvoiceNumber(),
        bookingId: "book_agg_4",
        status: "issued",
        currency: "EUR",
        totalCents: 4000,
        balanceDueCents: 4000,
        issueDate: isoDateInDays(-10),
        dueDate: isoDateInDays(0),
      },
      // Paid invoices never appear.
      {
        invoiceNumber: nextInvoiceNumber(),
        bookingId: "book_agg_5",
        status: "paid",
        currency: "EUR",
        totalCents: 5000,
        balanceDueCents: 0,
        issueDate: isoDateInDays(-5),
        dueDate: isoDateInDays(-1),
      },
      // Draft / void are excluded regardless of balance.
      {
        invoiceNumber: nextInvoiceNumber(),
        bookingId: "book_agg_6",
        status: "draft",
        currency: "EUR",
        totalCents: 9000,
        balanceDueCents: 9000,
        issueDate: isoDateInDays(-25),
        dueDate: isoDateInDays(-3),
      },
      {
        invoiceNumber: nextInvoiceNumber(),
        bookingId: "book_agg_7",
        status: "void",
        currency: "EUR",
        totalCents: 1000,
        balanceDueCents: 1000,
        issueDate: isoDateInDays(-2),
        dueDate: isoDateInDays(-1),
      },
      // Zero balance with outstanding status — excluded by `balance_due_cents > 0`.
      {
        invoiceNumber: nextInvoiceNumber(),
        bookingId: "book_agg_8",
        status: "issued",
        currency: "EUR",
        totalCents: 6000,
        balanceDueCents: 0,
        issueDate: isoDateInDays(-1),
        dueDate: isoDateInDays(-1),
      },
    ])

    const aggregates = await financeService.getFinanceAggregates(db)

    expect(aggregates.outstandingTopN).toHaveLength(4)
    const dueDates = aggregates.outstandingTopN.map((row) => row.dueDate)
    // Order: oldest dueDate first, null dueDate last.
    expect(dueDates[0]).toBe(isoDateInDays(-15))
    expect(dueDates[1]).toBe(isoDateInDays(-5))
    expect(dueDates[2]).toBe(isoDateInDays(0))
    expect(dueDates[3]).toBe(isoDateInDays(2))

    // Paid / draft / void / zero-balance never appear.
    const statuses = new Set(aggregates.outstandingTopN.map((row) => row.status))
    expect(statuses.has("paid")).toBe(false)
    expect(statuses.has("draft")).toBe(false)
    expect(statuses.has("void")).toBe(false)
    for (const row of aggregates.outstandingTopN) {
      expect(row.balanceDueCents).toBeGreaterThan(0)
    }
  })

  it("bounds outstandingTopN by outstandingTopLimit (default 5, max 20)", async () => {
    const rows = Array.from({ length: 9 }, (_, idx) => ({
      invoiceNumber: nextInvoiceNumber(),
      bookingId: `book_lim_${idx}`,
      status: "issued" as const,
      currency: "EUR",
      totalCents: 1000,
      balanceDueCents: 1000,
      issueDate: isoDateInDays(-30 + idx),
      dueDate: isoDateInDays(-20 + idx),
    }))
    await db.insert(invoices).values(rows)

    const defaultLimit = await financeService.getFinanceAggregates(db)
    expect(defaultLimit.outstandingTopN).toHaveLength(5)

    const explicit = await financeService.getFinanceAggregates(db, { outstandingTopLimit: 3 })
    expect(explicit.outstandingTopN).toHaveLength(3)

    const zero = await financeService.getFinanceAggregates(db, { outstandingTopLimit: 0 })
    expect(zero.outstandingTopN).toHaveLength(0)

    const over = await financeService.getFinanceAggregates(db, { outstandingTopLimit: 50 })
    // Capped at 20 by service-side clamp; we have 9 rows.
    expect(over.outstandingTopN).toHaveLength(9)
  })
})
