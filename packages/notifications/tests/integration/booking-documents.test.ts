import { bookings, bookingTravelers } from "@voyantjs/bookings/schema"
import { createEventBus } from "@voyantjs/core"
import { invoiceRenditions, invoices } from "@voyantjs/finance/schema"
import { contractAttachments, contracts } from "@voyantjs/legal/schema"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"
import { notificationDeliveries } from "../../src/schema.js"
import { createNotificationsTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Booking document notification routes", () => {
  const eventBus = createEventBus()
  const ctx = createNotificationsTestContext({ eventBus })
  const sentEvents: Array<Record<string, unknown>> = []

  eventBus.subscribe("booking.documents.sent", (event) => {
    sentEvents.push(event as Record<string, unknown>)
  })

  beforeEach(() => {
    sentEvents.length = 0
  })

  it("lists and sends a booking document bundle using default attachment URLs", async () => {
    await ctx.db.insert(bookings).values({
      id: "book_docs_1",
      bookingNumber: "BKG-1001",
      status: "confirmed",
      contactFirstName: "Ana",
      contactLastName: "Popescu",
      contactEmail: "ana@example.com",
      sellCurrency: "EUR",
      sellAmountCents: 120000,
    })

    await ctx.db.insert(bookingTravelers).values({
      id: "bp_docs_1",
      bookingId: "book_docs_1",
      firstName: "Ana",
      lastName: "Popescu",
      email: "ana@example.com",
      participantType: "traveler",
      isPrimary: true,
    })

    await ctx.db.insert(contracts).values({
      id: "ctr_docs_1",
      bookingId: "book_docs_1",
      scope: "customer",
      status: "issued",
      title: "Booking contract",
      language: "ro",
    })

    await ctx.db.insert(contractAttachments).values({
      id: "ctat_docs_1",
      contractId: "ctr_docs_1",
      kind: "document",
      name: "contract.pdf",
      mimeType: "application/pdf",
      storageKey: "contracts/book_docs_1/contract.pdf",
      metadata: {
        url: "https://cdn.example.com/contracts/book_docs_1/contract.pdf",
      },
    })

    await ctx.db.insert(invoices).values({
      id: "inv_docs_1",
      invoiceNumber: "PRO-1001",
      invoiceType: "proforma",
      bookingId: "book_docs_1",
      status: "sent",
      currency: "EUR",
      subtotalCents: 120000,
      taxCents: 0,
      totalCents: 120000,
      paidCents: 0,
      balanceDueCents: 120000,
      issueDate: "2026-04-13",
      dueDate: "2026-04-20",
      language: "ro",
    })

    await ctx.db.insert(invoiceRenditions).values({
      id: "invr_docs_1",
      invoiceId: "inv_docs_1",
      format: "pdf",
      status: "ready",
      storageKey: "invoices/inv_docs_1/proforma.pdf",
      metadata: {
        url: "https://cdn.example.com/invoices/inv_docs_1/proforma.pdf",
      },
    })

    const bundleRes = await ctx.request("/bookings/book_docs_1/document-bundle")
    expect(bundleRes.status).toBe(200)
    const bundleBody = await bundleRes.json()
    expect(bundleBody.data.bookingId).toBe("book_docs_1")
    expect(bundleBody.data.documents).toHaveLength(2)
    expect(
      bundleBody.data.documents.map((document: { documentType: string }) => document.documentType),
    ).toEqual(["contract", "proforma"])

    const sendRes = await ctx.request("/bookings/book_docs_1/send-documents", {
      method: "POST",
      ...json({}),
    })
    expect(sendRes.status).toBe(201)

    const sendBody = await sendRes.json()
    expect(sendBody.data.recipient).toBe("ana@example.com")
    expect(sendBody.data.documents).toHaveLength(2)

    expect(ctx.sink).toHaveBeenCalledOnce()
    expect(ctx.sink.mock.calls[0]?.[0]).toMatchObject({
      to: "ana@example.com",
      channel: "email",
      attachments: [
        {
          filename: "contract.pdf",
          path: "https://cdn.example.com/contracts/book_docs_1/contract.pdf",
        },
        {
          filename: "PRO-1001.pdf",
          path: "https://cdn.example.com/invoices/inv_docs_1/proforma.pdf",
        },
      ],
    })

    const [delivery] = await ctx.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.bookingId, "book_docs_1"))
      .limit(1)

    expect(delivery?.status).toBe("sent")
    expect(delivery?.targetType).toBe("booking")
    expect(delivery?.metadata).toMatchObject({
      attachmentCount: 2,
      attachments: [
        {
          filename: "contract.pdf",
          path: "https://cdn.example.com/contracts/book_docs_1/contract.pdf",
        },
        {
          filename: "PRO-1001.pdf",
          path: "https://cdn.example.com/invoices/inv_docs_1/proforma.pdf",
        },
      ],
    })
    expect(sentEvents).toEqual([
      expect.objectContaining({
        name: "booking.documents.sent",
        metadata: {
          category: "domain",
          source: "service",
        },
        data: expect.objectContaining({
          bookingId: "book_docs_1",
          recipient: "ana@example.com",
          provider: "local",
          documentKeys: ["legal:ctat_docs_1", "finance:invr_docs_1"],
        }),
      }),
    ])
  })
})
