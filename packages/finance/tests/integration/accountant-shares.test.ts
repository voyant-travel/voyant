/**
 * Accountant shares (RFC §13.2): revocable, period-scoped public links built on
 * the public_document_delivery_grants token store, + the portal data they expose
 * (invoices-in-period with attachments, attachment download scoping).
 */

import { bookings } from "@voyant-travel/bookings/schema"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  invoiceAttachments,
  invoices,
  supplierInvoiceAttachments,
  supplierInvoices,
} from "../../src/schema.js"
import { accountantSharesService } from "../../src/service-accountant-shares.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const tokenOf = (url: string) => url.split("/").pop() ?? ""

describe.skipIf(!DB_AVAILABLE)("accountant shares", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: finance; existing suppression is intentional pending typed cleanup.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })
  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })
  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  it("mints, resolves, lists and revokes a period-scoped share", async () => {
    const share = await accountantSharesService.create(
      db,
      { from: "2026-07-01", to: "2026-07-31", baseCurrency: "eur" },
      { publicBaseUrl: "https://ops.example.com", userId: "user_1" },
    )
    expect(share.url).toMatch(/^https:\/\/ops\.example\.com\/accountant\//)
    expect(share.baseCurrency).toBe("EUR")

    const token = tokenOf(share.url)
    const resolved = await accountantSharesService.resolve(db, token)
    expect(resolved.status).toBe("ready")
    if (resolved.status === "ready") {
      expect(resolved.scope).toEqual({ from: "2026-07-01", to: "2026-07-31", baseCurrency: "EUR" })
    }

    const list = await accountantSharesService.list(db)
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe(share.id)

    await accountantSharesService.revoke(db, share.id, "user_1")
    expect((await accountantSharesService.resolve(db, token)).status).toBe("gone")
    expect(await accountantSharesService.list(db)).toHaveLength(0)
  })

  it("returns not_found for an unknown token", async () => {
    const res = await accountantSharesService.resolve(db, "x".repeat(43))
    expect(res.status).toBe("not_found")
  })

  it("lists invoices in the scope window with their attachments", async () => {
    await db.insert(bookings).values({
      id: "book_x",
      bookingNumber: "BKG-X",
      status: "confirmed",
      sellCurrency: "EUR",
    })
    await db.insert(invoices).values([
      {
        id: "inv_in",
        invoiceNumber: "INV-IN",
        invoiceType: "invoice",
        status: "issued",
        bookingId: "book_x",
        currency: "EUR",
        totalCents: 100000,
        paidCents: 0,
        balanceDueCents: 100000,
        issueDate: "2026-07-10",
        dueDate: "2026-07-20",
      },
      {
        id: "inv_out",
        invoiceNumber: "INV-OUT",
        invoiceType: "invoice",
        status: "issued",
        bookingId: "book_x",
        currency: "EUR",
        totalCents: 50000,
        paidCents: 0,
        balanceDueCents: 50000,
        issueDate: "2026-08-10",
        dueDate: "2026-08-20",
      },
    ])
    await db.insert(invoiceAttachments).values({
      id: "iatt_1",
      invoiceId: "inv_in",
      name: "invoice.pdf",
      mimeType: "application/pdf",
      fileSize: 1234,
      storageKey: "invoices/inv_in/invoice.pdf",
    })
    // A supplier (AP) invoice in the same window — should appear with kind=supplier.
    await db.insert(supplierInvoices).values({
      id: "sinv_in",
      supplierId: "supp_x",
      supplierInvoiceNo: "SUP-IN",
      status: "approved",
      currency: "EUR",
      issueDate: "2026-07-12",
      totalCents: 40000,
      paidCents: 0,
      balanceDueCents: 40000,
    })
    await db.insert(supplierInvoiceAttachments).values({
      id: "siatt_1",
      supplierInvoiceId: "sinv_in",
      name: "supplier.pdf",
      storageKey: "supplier-invoices/sinv_in/supplier.pdf",
    })

    const scope = { from: "2026-07-01", to: "2026-07-31", baseCurrency: null }
    const list = await accountantSharesService.getInvoicesWithAttachments(db, scope)
    // inv_out is outside the window; client + supplier both inside it appear.
    expect(new Set(list.map((i) => `${i.kind}:${i.id}`))).toEqual(
      new Set(["client:inv_in", "supplier:sinv_in"]),
    )
    const client = list.find((i) => i.id === "inv_in")
    expect(client?.attachments).toEqual([
      {
        id: "iatt_1",
        name: "invoice.pdf",
        mimeType: "application/pdf",
        fileSize: 1234,
        hasFile: true,
      },
    ])

    const clientDl = await accountantSharesService.getAttachmentForDownload(
      db,
      scope,
      "client",
      "inv_in",
      "iatt_1",
    )
    expect(clientDl?.storageKey).toBe("invoices/inv_in/invoice.pdf")
    const supplierDl = await accountantSharesService.getAttachmentForDownload(
      db,
      scope,
      "supplier",
      "sinv_in",
      "siatt_1",
    )
    expect(supplierDl?.storageKey).toBe("supplier-invoices/sinv_in/supplier.pdf")

    // Out-of-scope invoice's attachment is not downloadable through this share.
    await db.insert(invoiceAttachments).values({
      id: "iatt_out",
      invoiceId: "inv_out",
      name: "x.pdf",
      storageKey: "invoices/inv_out/x.pdf",
    })
    expect(
      await accountantSharesService.getAttachmentForDownload(
        db,
        scope,
        "client",
        "inv_out",
        "iatt_out",
      ),
    ).toBeNull()
  })
})
