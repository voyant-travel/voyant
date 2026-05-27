import { bookings, bookingTravelers } from "@voyantjs/bookings/schema"
import { createEventBus } from "@voyantjs/core"
import { invoices, payments } from "@voyantjs/finance/schema"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  contractAttachments,
  contracts,
  contractTemplates,
  contractTemplateVersions,
} from "../../src/contracts/schema.js"
import { autoGenerateContractForBooking } from "../../src/contracts/service-auto-generate.js"
import { contractRecordsService } from "../../src/contracts/service-contracts.js"
import type { ContractDocumentGenerator } from "../../src/contracts/service-documents.js"
import { contractSeriesService } from "../../src/contracts/service-series.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let testSeq = 0
function nextBookingNumber() {
  testSeq += 1
  return `BK-CONTRACT-AUTO-${String(testSeq).padStart(5, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("autoGenerateContractForBooking", () => {
  let db: PostgresJsDatabase

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    await closeTestDb()
  })

  async function seedTemplate(slug: string) {
    const [template] = await db
      .insert(contractTemplates)
      .values({
        slug,
        name: "Customer Services Contract",
        scope: "customer",
        language: "en",
        body: "",
        active: true,
      })
      .returning()
    const [version] = await db
      .insert(contractTemplateVersions)
      .values({
        templateId: template!.id,
        version: 1,
        body: 'Contract for {{ booking.number }}. Lead: {{ leadTraveler.firstName }} {{ leadTraveler.lastName }}. Travelers: {% for t in travelers %}{{ t.firstName }}{% unless forloop.last %}, {% endunless %}{% endfor %}. Total: {{ booking.totalAmountCents | cents: booking.currency }}. Issued: {{ contract.date | format_date: "short" }}.',
      })
      .returning()
    // Point template at the version we just made.
    await db
      .update(contractTemplates)
      .set({ currentVersionId: version!.id, updatedAt: new Date() })
      .where(eq(contractTemplates.id, template!.id))
    return { template: template!, version: version! }
  }

  async function seedBooking(overrides: Partial<typeof bookings.$inferInsert> = {}) {
    const [row] = await db
      .insert(bookings)
      .values({
        bookingNumber: nextBookingNumber(),
        status: "confirmed",
        sellCurrency: "EUR",
        sellAmountCents: 125000,
        costAmountCents: 80000,
        marginPercent: 36,
        startDate: "2026-07-01",
        pax: 2,
        ...overrides,
      })
      .returning()
    return row!
  }

  function makeGenerator(captureBody: string[] = []): ContractDocumentGenerator {
    return async (ctx) => {
      captureBody.push(ctx.renderedBody)
      return {
        kind: "document",
        name: `contract-${ctx.contract.id}.pdf`,
        mimeType: "application/pdf",
        fileSize: 4096,
        storageKey: `contracts/${ctx.contract.id}/document.pdf`,
        metadata: { source: "test" },
      }
    }
  }

  it("creates contract, renders liquid, and attaches generated document", async () => {
    const { template } = await seedTemplate("cust-services-1")
    const booking = await seedBooking()
    await db.insert(bookingTravelers).values([
      {
        bookingId: booking.id,
        participantType: "traveler",
        firstName: "Ana",
        lastName: "Primary",
        email: "ana@example.com",
        isPrimary: true,
      },
      {
        bookingId: booking.id,
        participantType: "traveler",
        firstName: "Bob",
        lastName: "Second",
        isPrimary: false,
      },
    ])

    const renderedBodies: string[] = []
    const outcome = await autoGenerateContractForBooking(
      db,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: "usrp_tester" },
      { enabled: true, templateSlug: template.slug },
      { generator: makeGenerator(renderedBodies) },
    )

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    // Contract row persisted + linked to booking.
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, outcome.contractId))
    expect(contract?.bookingId).toBe(booking.id)
    expect(contract?.status).toBe("issued")
    // Template's currentVersionId was set after seedTemplate returned — refetch.
    const [refreshedTemplate] = await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, template.id))
    expect(contract?.templateVersionId).toBe(refreshedTemplate?.currentVersionId ?? null)
    expect(contract?.language).toBe("en")

    // Attachment created and linked to contract.
    const attachmentRows = await db
      .select()
      .from(contractAttachments)
      .where(eq(contractAttachments.contractId, outcome.contractId))
    expect(attachmentRows).toHaveLength(1)
    expect(attachmentRows[0]?.kind).toBe("document")

    // Liquid was actually executed — lead traveler + total should be interpolated.
    expect(renderedBodies).toHaveLength(1)
    const body = renderedBodies[0] ?? ""
    expect(body).toContain(booking.bookingNumber)
    expect(body).toContain("Ana Primary")
    expect(body).toContain("Ana, Bob")
    expect(body).toContain("1,250.00") // 125000 cents → 1,250.00 EUR
  })

  it("emits contract.document.generated event on the runtime bus", async () => {
    const { template } = await seedTemplate("cust-evt-1")
    const booking = await seedBooking()

    const eventBus = createEventBus()
    const received: Array<{ name: string; data: { contractId: string } }> = []
    eventBus.subscribe("contract.document.generated", (envelope) => {
      received.push(envelope as { name: string; data: { contractId: string } })
    })

    const outcome = await autoGenerateContractForBooking(
      db,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: null },
      { enabled: true, templateSlug: template.slug },
      { generator: makeGenerator(), eventBus },
    )
    expect(outcome.status).toBe("ok")

    await new Promise((r) => setTimeout(r, 10))
    expect(received).toHaveLength(1)
    expect(received[0]?.name).toBe("contract.document.generated")
    if (outcome.status === "ok") {
      expect(received[0]?.data.contractId).toBe(outcome.contractId)
    }
  })

  it("returns template_not_found when slug doesn't resolve", async () => {
    const booking = await seedBooking()
    const outcome = await autoGenerateContractForBooking(
      db,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: null },
      { enabled: true, templateSlug: "does-not-exist" },
      { generator: makeGenerator() },
    )
    expect(outcome.status).toBe("template_not_found")
    expect(await db.select().from(contracts)).toHaveLength(0)
  })

  it("returns template_version_missing when template exists but has no current version", async () => {
    const [template] = await db
      .insert(contractTemplates)
      .values({
        slug: "no-versions",
        name: "Empty Template",
        scope: "customer",
        language: "en",
        body: "",
        active: true,
      })
      .returning()
    const booking = await seedBooking()

    const outcome = await autoGenerateContractForBooking(
      db,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: null },
      { enabled: true, templateSlug: template!.slug },
      { generator: makeGenerator() },
    )
    expect(outcome.status).toBe("template_version_missing")
  })

  it("returns booking_not_found when the booking was deleted between confirm and handler fire", async () => {
    const { template } = await seedTemplate("cust-ghost-1")

    const outcome = await autoGenerateContractForBooking(
      db,
      { bookingId: "book_does_not_exist", bookingNumber: "BK-GHOST", actorId: null },
      { enabled: true, templateSlug: template.slug },
      { generator: makeGenerator() },
    )
    expect(outcome.status).toBe("booking_not_found")
    expect(await db.select().from(contracts)).toHaveLength(0)
  })

  it("uses resolveVariables to override defaults when supplied", async () => {
    const { template } = await seedTemplate("cust-override-1")
    const booking = await seedBooking()

    const bodies: string[] = []
    const outcome = await autoGenerateContractForBooking(
      db,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: null },
      {
        enabled: true,
        templateSlug: template.slug,
        resolveVariables: ({ defaults }) => ({
          ...defaults,
          leadTraveler: {
            id: "ovr",
            firstName: "Overridden",
            lastName: "Lead",
            email: null,
            phone: null,
          },
        }),
      },
      { generator: makeGenerator(bodies) },
    )
    expect(outcome.status).toBe("ok")
    expect(bodies[0]).toContain("Overridden Lead")
  })

  it("exposes settlement variables from invoices and completed payments", async () => {
    const { template, version } = await seedTemplate("cust-settlement-1")
    await db
      .update(contractTemplateVersions)
      .set({
        body: [
          "Paid {{ booking.paidAmountCents }}",
          "Balance {{ booking.balanceDueCents }}",
          "Latest {{ payment.latestCompleted.methodLabel }}",
          "Date {{ payment.latestCompleted.date }}",
        ].join(" | "),
      })
      .where(eq(contractTemplateVersions.id, version.id))

    const booking = await seedBooking({
      sellCurrency: "RON",
      sellAmountCents: 32000,
    })
    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber: `INV-${booking.bookingNumber}`,
        bookingId: booking.id,
        status: "paid",
        currency: "RON",
        subtotalCents: 32000,
        taxCents: 0,
        totalCents: 32000,
        paidCents: 32000,
        balanceDueCents: 0,
        issueDate: "2026-05-01",
        dueDate: "2026-05-10",
      })
      .returning()
    await db.insert(payments).values({
      invoiceId: invoice!.id,
      amountCents: 32000,
      currency: "RON",
      paymentMethod: "bank_transfer",
      status: "completed",
      paymentDate: "2026-05-04",
    })

    const bodies: string[] = []
    const outcome = await autoGenerateContractForBooking(
      db,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: null },
      { enabled: true, templateSlug: template.slug },
      { generator: makeGenerator(bodies) },
    )
    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const contract = await contractRecordsService.getContractById(db, outcome.contractId)
    const variables = contract?.variables as Record<string, unknown>
    const bookingVariables = variables.booking as Record<string, unknown>
    const paymentVariables = variables.payment as Record<string, unknown>
    const latestCompleted = paymentVariables.latestCompleted as Record<string, unknown>

    expect(bookingVariables.paidAmountCents).toBe(32000)
    expect(bookingVariables.balanceDueCents).toBe(0)
    expect(latestCompleted).toMatchObject({
      method: "bank_transfer",
      methodLabel: "Bank Transfer",
      date: "2026-05-04",
    })
    expect(paymentVariables.method).toBe("Bank Transfer")
    expect(paymentVariables.capturedAt).toBe("2026-05-04")
    expect(bodies[0]).toContain("Paid 32000 | Balance 0 | Latest Bank Transfer")
  })

  it("resolves a series by name and writes seriesId onto the contract", async () => {
    const { template } = await seedTemplate("cust-series-1")
    const booking = await seedBooking()
    const series = await contractSeriesService.createSeries(db, {
      name: "2026 Customer",
      prefix: "CS",
      separator: "-",
      padLength: 5,
      resetStrategy: "never",
      scope: "customer",
      active: true,
    })

    const outcome = await autoGenerateContractForBooking(
      db,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: null },
      { enabled: true, templateSlug: template.slug, seriesName: "2026 Customer" },
      { generator: makeGenerator() },
    )
    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const contract = await contractRecordsService.getContractById(db, outcome.contractId)
    expect(contract?.seriesId).toBe(series!.id)
    expect(contract?.contractNumber).toBeTruthy() // allocated from series
  })

  it("records trigger metadata on the created contract", async () => {
    const { template } = await seedTemplate("cust-meta-1")
    const booking = await seedBooking()

    const outcome = await autoGenerateContractForBooking(
      db,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: "usrp_meta" },
      { enabled: true, templateSlug: template.slug },
      { generator: makeGenerator() },
    )
    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const contract = await contractRecordsService.getContractById(db, outcome.contractId)
    const metadata = contract?.metadata as Record<string, unknown> | null
    expect(metadata?.autoGenerated).toBe(true)
    expect(metadata?.trigger).toBe("booking.confirmed")
    expect(metadata?.triggerActorId).toBe("usrp_meta")
  })
})
