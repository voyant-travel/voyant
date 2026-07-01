/**
 * Integration coverage for the accounts-payable (supplier invoice) service:
 *
 *  - create with lines recomputes header totals (total includes tax)
 *  - setAllocations enforces the §6.1 invariants (over-allocation rejected;
 *    a valid whole-invoice split persists)
 *  - recording a completed supplier payment against the invoice updates
 *    paid / balance / status (§5.4 settlement flow)
 *  - softDelete removes the invoice from list()
 *
 * Skipped unless TEST_DATABASE_URL points at a schema-provisioned Postgres
 * (the AP tables must exist — see the migration caveat on the AP branch).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { financeService } from "../../src/service.js"
import {
  SupplierInvoiceServiceError,
  supplierInvoicesService,
} from "../../src/service-supplier-invoices.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let counter = 0
function nextSupplierInvoiceNo() {
  counter += 1
  return `SUP-INV-${String(counter).padStart(6, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("supplier invoices (accounts payable)", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: finance; existing suppression is intentional pending typed cleanup.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    counter = 0
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  it("recomputes header totals from lines on create", async () => {
    const invoice = await supplierInvoicesService.create(db, {
      supplierId: "supp_test",
      supplierInvoiceNo: nextSupplierInvoiceNo(),
      currency: "EUR",
      issueDate: "2026-06-01",
      status: "received",
      lines: [
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
      ],
    })

    expect(invoice).not.toBeNull()
    expect(invoice?.totalCents).toBe(589000)
    expect(invoice?.taxCents).toBe(19000)
    expect(invoice?.subtotalCents).toBe(570000)
    expect(invoice?.balanceDueCents).toBe(589000)
    expect(invoice?.lines).toHaveLength(2)
  })

  it("rejects an over-allocation and persists a valid whole-invoice split", async () => {
    const created = await supplierInvoicesService.create(db, {
      supplierId: "supp_test",
      supplierInvoiceNo: nextSupplierInvoiceNo(),
      currency: "EUR",
      issueDate: "2026-06-01",
      totalCents: 100000,
    })
    const id = created?.id as string

    await expect(
      supplierInvoicesService.setAllocations(db, id, {
        allocations: [
          { targetType: "departure", departureId: "avsl_a", amountCents: 70000 },
          { targetType: "departure", departureId: "avsl_b", amountCents: 50000 },
        ],
      }),
    ).rejects.toBeInstanceOf(SupplierInvoiceServiceError)

    const ok = await supplierInvoicesService.setAllocations(db, id, {
      allocations: [
        { targetType: "departure", departureId: "avsl_a", amountCents: 60000 },
        { targetType: "departure", departureId: "avsl_b", amountCents: 40000 },
      ],
    })
    expect(ok?.allocations).toHaveLength(2)
  })

  it("rejects line edits that would over-allocate surviving whole-invoice allocations", async () => {
    const created = await supplierInvoicesService.create(db, {
      supplierId: "supp_test",
      supplierInvoiceNo: nextSupplierInvoiceNo(),
      currency: "EUR",
      issueDate: "2026-06-01",
      lines: [
        {
          description: "Transport",
          quantity: 1,
          unitAmountCents: 100000,
          taxAmountCents: 0,
          totalAmountCents: 100000,
          sortOrder: 0,
        },
      ],
    })
    const id = created?.id as string

    // Whole-invoice allocation that fills the current 100000 total.
    await supplierInvoicesService.setAllocations(db, id, {
      allocations: [{ targetType: "departure", departureId: "avsl_a", amountCents: 100000 }],
    })

    // Shrinking the lines below the allocated amount must be rejected, not silently
    // leave the invoice over-allocated.
    await expect(
      supplierInvoicesService.setLines(db, id, {
        lines: [
          {
            description: "Transport (reduced)",
            quantity: 1,
            unitAmountCents: 40000,
            taxAmountCents: 0,
            totalAmountCents: 40000,
            sortOrder: 0,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(SupplierInvoiceServiceError)

    // The original total + allocation are untouched (the failed edit rolled back).
    const after = await supplierInvoicesService.getById(db, id)
    expect(after?.totalCents).toBe(100000)
    expect(after?.allocations).toHaveLength(1)
  })

  it("settles the invoice when a completed supplier payment is recorded", async () => {
    const created = await supplierInvoicesService.create(db, {
      supplierId: "supp_test",
      supplierInvoiceNo: nextSupplierInvoiceNo(),
      currency: "EUR",
      issueDate: "2026-06-01",
      status: "approved",
      totalCents: 100000,
    })
    const id = created?.id as string

    await financeService.createSupplierPayment(db, {
      supplierInvoiceId: id,
      amountCents: 40000,
      currency: "EUR",
      paymentMethod: "bank_transfer",
      status: "completed",
      paymentDate: "2026-06-10",
    })
    let after = await supplierInvoicesService.getById(db, id)
    expect(after?.paidCents).toBe(40000)
    expect(after?.balanceDueCents).toBe(60000)
    expect(after?.status).toBe("partially_paid")

    await financeService.createSupplierPayment(db, {
      supplierInvoiceId: id,
      amountCents: 60000,
      currency: "EUR",
      paymentMethod: "bank_transfer",
      status: "completed",
      paymentDate: "2026-06-12",
    })
    after = await supplierInvoicesService.getById(db, id)
    expect(after?.paidCents).toBe(100000)
    expect(after?.balanceDueCents).toBe(0)
    expect(after?.status).toBe("paid")
  })

  it("rejects completed supplier payments above the payable balance", async () => {
    const created = await supplierInvoicesService.create(db, {
      supplierId: "supp_test",
      supplierInvoiceNo: nextSupplierInvoiceNo(),
      currency: "EUR",
      issueDate: "2026-06-01",
      status: "approved",
      totalCents: 100000,
    })
    const id = created?.id as string

    await financeService.createSupplierPayment(db, {
      supplierInvoiceId: id,
      amountCents: 70000,
      currency: "EUR",
      paymentMethod: "bank_transfer",
      status: "completed",
      paymentDate: "2026-06-10",
    })

    await expect(
      financeService.createSupplierPayment(db, {
        supplierInvoiceId: id,
        amountCents: 30001,
        currency: "EUR",
        paymentMethod: "bank_transfer",
        status: "completed",
        paymentDate: "2026-06-12",
      }),
    ).rejects.toMatchObject({
      code: "invalid_payable_state",
      message: "supplier invoice payment exceeds payable balance (30000)",
    })

    const after = await supplierInvoicesService.getById(db, id)
    expect(after?.paidCents).toBe(70000)
    expect(after?.balanceDueCents).toBe(30000)
  })

  it("hides soft-deleted invoices from list()", async () => {
    const created = await supplierInvoicesService.create(db, {
      supplierId: "supp_del",
      supplierInvoiceNo: nextSupplierInvoiceNo(),
      currency: "EUR",
      issueDate: "2026-06-01",
      totalCents: 5000,
    })
    const id = created?.id as string

    const before = await supplierInvoicesService.list(db, {
      supplierId: "supp_del",
      sortBy: "createdAt",
      sortDir: "desc",
      limit: 50,
      offset: 0,
    })
    expect(before.total).toBe(1)

    await supplierInvoicesService.softDelete(db, id)

    const afterList = await supplierInvoicesService.list(db, {
      supplierId: "supp_del",
      sortBy: "createdAt",
      sortDir: "desc",
      limit: 50,
      offset: 0,
    })
    expect(afterList.total).toBe(0)
  })
})
