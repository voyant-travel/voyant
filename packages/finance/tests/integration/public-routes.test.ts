import { issueCheckoutCapability } from "@voyantjs/bookings/checkout-capability"
import { bookings } from "@voyantjs/bookings/schema"
import { handleApiError } from "@voyantjs/hono"
import { eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { publicFinanceRoutes } from "../../src/routes-public.js"
import {
  bookingGuarantees,
  bookingPaymentSchedules,
  invoiceRenditions,
  invoices,
  paymentInstruments,
  paymentSessions,
  payments,
} from "../../src/schema.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const ORIGINAL_TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const ORIGINAL_CHECKOUT_CAPABILITY_SECRET = process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let seq = 0
function nextBookingNumber() {
  seq += 1
  return `BK-PUBLIC-${String(seq).padStart(5, "0")}`
}

function nextInvoiceNumber() {
  seq += 1
  return `INV-PUBLIC-${String(seq).padStart(5, "0")}`
}

function getIsolatedFinanceTestDbUrl(url: string | undefined) {
  if (!url) return url

  try {
    const parsed = new URL(url)
    if (parsed.hostname === "127.0.0.1" && parsed.pathname === "/voyant_test") {
      parsed.pathname = "/voyant_finance_test"
      return parsed.toString()
    }
  } catch {
    return url
  }

  return url
}

async function cleanupFinanceTestData(
  // biome-ignore lint/suspicious/noExplicitAny: test db typing
  db: any,
) {
  const tableNames = [
    "payment_sessions",
    "supplier_payments",
    "payments",
    "payment_captures",
    "payment_authorizations",
    "payment_instruments",
    "booking_guarantees",
    "booking_payment_schedules",
    "booking_item_commissions",
    "booking_item_tax_lines",
    "finance_notes",
    "invoice_external_refs",
    "invoice_renditions",
    "invoice_templates",
    "invoice_number_series",
    "credit_note_line_items",
    "credit_notes",
    "invoice_line_items",
    "invoices",
    "tax_regimes",
    "booking_items",
    "bookings",
  ]

  const existingTables = (await db.execute<{ tablename: string }>(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (${sql.join(
        tableNames.map((name) => sql`${name}`),
        sql`, `,
      )})
  `)) as Array<{ tablename: string }>

  if (existingTables.length === 0) {
    return
  }

  const names = existingTables.map((row) => `"${row.tablename}"`).join(", ")
  await db.execute(sql.raw(`TRUNCATE ${names} CASCADE`))
}

describe.skipIf(!DB_AVAILABLE)("Public finance routes", () => {
  let app: Hono
  let db: ReturnType<typeof import("@voyantjs/db/test-utils").createTestDb>

  beforeAll(async () => {
    process.env.TEST_DATABASE_URL = getIsolatedFinanceTestDbUrl(process.env.TEST_DATABASE_URL)
    process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET = "public-finance-route-test-secret-32"
    const { createTestDb } = await import("@voyantjs/db/test-utils")

    db = createTestDb()
    await cleanupFinanceTestData(db)

    app = new Hono()
    app.onError(handleApiError)
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "public-finance-test-user")
      await next()
    })
    app.route("/", publicFinanceRoutes)
  })

  beforeEach(async () => {
    await cleanupFinanceTestData(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    process.env.TEST_DATABASE_URL = ORIGINAL_TEST_DATABASE_URL
    process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET = ORIGINAL_CHECKOUT_CAPABILITY_SECRET
    await closeTestDb()
  })

  async function capabilityHeaders(bookingId: string): Promise<HeadersInit> {
    const capability = await issueCheckoutCapability(bookingId, {
      VOYANT_CHECKOUT_CAPABILITY_SECRET: process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET,
    })

    return { "X-Voyant-Checkout-Capability": capability.token }
  }

  async function seedBooking(overrides: Partial<typeof bookings.$inferInsert> = {}) {
    const [row] = await db
      .insert(bookings)
      .values({
        bookingNumber: nextBookingNumber(),
        sellCurrency: "USD",
        sellAmountCents: 100000,
        costAmountCents: 60000,
        marginPercent: 40,
        startDate: "2025-06-01",
        ...overrides,
      })
      .returning()

    return row
  }

  async function seedInvoice(
    bookingId: string,
    overrides: Partial<typeof invoices.$inferInsert> = {},
  ) {
    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber: nextInvoiceNumber(),
        bookingId,
        currency: "USD",
        issueDate: "2025-06-01",
        dueDate: "2025-07-01",
        subtotalCents: 100000,
        taxCents: 10000,
        totalCents: overrides.totalCents ?? 110000,
        paidCents: overrides.paidCents ?? 0,
        balanceDueCents: overrides.balanceDueCents ?? 110000,
        ...overrides,
      })
      .returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })

    return invoice
  }

  it("lists public payment options for a booking", async () => {
    const booking = await seedBooking()

    await db.insert(bookingPaymentSchedules).values([
      {
        bookingId: booking.id,
        scheduleType: "deposit",
        status: "due",
        dueDate: "2025-05-01",
        currency: "USD",
        amountCents: 25000,
      },
      {
        bookingId: booking.id,
        scheduleType: "balance",
        status: "pending",
        dueDate: "2025-05-20",
        currency: "USD",
        amountCents: 75000,
      },
    ])

    await db.insert(bookingGuarantees).values({
      bookingId: booking.id,
      guaranteeType: "deposit",
      status: "pending",
      currency: "USD",
      amountCents: 25000,
      provider: "netopia",
      referenceNumber: "G-1",
    })

    await db.insert(paymentInstruments).values([
      {
        ownerType: "client",
        instrumentType: "credit_card",
        status: "active",
        label: "Visa ending 4242",
        provider: "netopia",
        brand: "visa",
        last4: "4242",
        billingEmail: "traveler@example.com",
        metadata: { default: true },
      },
      {
        ownerType: "client",
        instrumentType: "credit_card",
        status: "inactive",
        label: "Old card",
        provider: "netopia",
        brand: "visa",
        last4: "1111",
        billingEmail: "traveler@example.com",
        metadata: {},
      },
    ])

    const res = await app.request(`/bookings/${booking.id}/payment-options`, {
      headers: await capabilityHeaders(booking.id),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.accounts).toHaveLength(1)
    expect(body.data.accounts[0]?.isDefault).toBe(true)
    expect(body.data.schedules).toHaveLength(2)
    expect(body.data.guarantees).toHaveLength(1)
    expect(body.data.recommendedTarget).toEqual({
      targetType: "booking_payment_schedule",
      targetId: body.data.schedules[0].id,
    })
  })

  it("lists booking-scoped public finance documents and prefers ready renditions", async () => {
    const booking = await seedBooking()
    const invoice = await seedInvoice(booking.id, { totalCents: 50000, balanceDueCents: 50000 })
    const proforma = await seedInvoice(booking.id, {
      totalCents: 25000,
      balanceDueCents: 25000,
      paidCents: 0,
      invoiceType: "proforma",
    })

    await db.insert(invoiceRenditions).values([
      {
        invoiceId: invoice.id,
        format: "pdf",
        status: "failed",
        errorMessage: "renderer timeout",
        metadata: { url: "https://example.com/failed.pdf" },
      },
      {
        invoiceId: invoice.id,
        format: "pdf",
        status: "ready",
        generatedAt: new Date("2025-06-02T12:00:00.000Z"),
        fileSize: 1024,
        checksum: "sha256:ready",
        metadata: { url: "https://example.com/invoice-ready.pdf" },
      },
    ])

    const res = await app.request(`/bookings/${booking.id}/documents`, {
      headers: await capabilityHeaders(booking.id),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.bookingId).toBe(booking.id)
    expect(body.data.documents).toHaveLength(2)

    const invoiceDocument = body.data.documents.find(
      (document: { invoiceId: string }) => document.invoiceId === invoice.id,
    )
    expect(invoiceDocument).toMatchObject({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: "invoice",
      documentStatus: "ready",
      format: "pdf",
      downloadUrl: "https://example.com/invoice-ready.pdf",
      checksum: "sha256:ready",
    })

    const proformaDocument = body.data.documents.find(
      (document: { invoiceId: string }) => document.invoiceId === proforma.id,
    )
    expect(proformaDocument).toMatchObject({
      invoiceId: proforma.id,
      invoiceType: "proforma",
      documentStatus: "missing",
      downloadUrl: null,
    })
  })

  it("looks up a public finance document by payment or invoice reference", async () => {
    const booking = await seedBooking()
    const invoice = await seedInvoice(booking.id, {
      invoiceNumber: "PF-REF-1001",
      invoiceType: "proforma",
      totalCents: 64000,
      balanceDueCents: 64000,
    })

    await db.insert(invoiceRenditions).values({
      invoiceId: invoice.id,
      format: "pdf",
      status: "ready",
      generatedAt: new Date("2025-06-04T08:00:00.000Z"),
      metadata: { url: "https://example.com/proforma-by-reference.pdf" },
    })

    await db.insert(payments).values({
      invoiceId: invoice.id,
      amountCents: 64000,
      currency: "USD",
      paymentMethod: "bank_transfer",
      status: "pending",
      paymentDate: "2025-06-04",
      referenceNumber: "PAY-REF-1001",
    })

    const paymentReferenceRes = await app.request(
      "/documents/by-reference?reference=PAY-REF-1001",
      {
        headers: await capabilityHeaders(booking.id),
      },
    )

    expect(paymentReferenceRes.status).toBe(200)
    expect((await paymentReferenceRes.json()).data).toMatchObject({
      bookingId: booking.id,
      invoiceId: invoice.id,
      invoiceNumber: "PF-REF-1001",
      invoiceType: "proforma",
      documentStatus: "ready",
      downloadUrl: "https://example.com/proforma-by-reference.pdf",
    })

    const invoiceReferenceRes = await app.request("/documents/by-reference?reference=PF-REF-1001", {
      headers: await capabilityHeaders(booking.id),
    })

    expect(invoiceReferenceRes.status).toBe(200)
    expect((await invoiceReferenceRes.json()).data).toMatchObject({
      bookingId: booking.id,
      invoiceId: invoice.id,
      invoiceNumber: "PF-REF-1001",
    })

    const bookingScopedRes = await app.request(
      `/bookings/${booking.id}/documents/by-reference?reference=PAY-REF-1001`,
      {
        headers: await capabilityHeaders(booking.id),
      },
    )

    expect(bookingScopedRes.status).toBe(200)
    expect((await bookingScopedRes.json()).data).toMatchObject({
      bookingId: booking.id,
      invoiceId: invoice.id,
      invoiceNumber: "PF-REF-1001",
      documentStatus: "ready",
    })
  })

  it("requires document type when an invoice reference matches multiple document types", async () => {
    const booking = await seedBooking()
    const invoiceNumber = "PF-SHARED-0127"
    const invoice = await seedInvoice(booking.id, {
      invoiceNumber,
      invoiceType: "invoice",
    })
    const proforma = await seedInvoice(booking.id, {
      invoiceNumber,
      invoiceType: "proforma",
    })

    const ambiguousPublicRes = await app.request(
      `/documents/by-reference?reference=${invoiceNumber}`,
      {
        headers: await capabilityHeaders(booking.id),
      },
    )
    expect(ambiguousPublicRes.status).toBe(404)

    const ambiguousBookingRes = await app.request(
      `/bookings/${booking.id}/documents/by-reference?reference=${invoiceNumber}`,
      {
        headers: await capabilityHeaders(booking.id),
      },
    )
    expect(ambiguousBookingRes.status).toBe(404)

    const invoiceRes = await app.request(
      `/bookings/${booking.id}/documents/by-reference?reference=${invoiceNumber}&invoiceType=invoice`,
      {
        headers: await capabilityHeaders(booking.id),
      },
    )
    expect(invoiceRes.status).toBe(200)
    expect((await invoiceRes.json()).data).toMatchObject({
      invoiceId: invoice.id,
      invoiceNumber,
      invoiceType: "invoice",
    })

    const proformaRes = await app.request(
      `/documents/by-reference?reference=${invoiceNumber}&invoiceType=proforma`,
      {
        headers: await capabilityHeaders(booking.id),
      },
    )
    expect(proformaRes.status).toBe(200)
    expect((await proformaRes.json()).data).toMatchObject({
      invoiceId: proforma.id,
      invoiceNumber,
      invoiceType: "proforma",
    })
  })

  it("rejects booking-scoped finance document lookup without matching access", async () => {
    const booking = await seedBooking()
    const otherBooking = await seedBooking()
    const invoice = await seedInvoice(booking.id, {
      invoiceNumber: "PF-SCOPED-1001",
      invoiceType: "proforma",
    })
    const otherInvoice = await seedInvoice(otherBooking.id, {
      invoiceNumber: "PF-SCOPED-2002",
      invoiceType: "proforma",
    })

    await db.insert(invoiceRenditions).values([
      {
        invoiceId: invoice.id,
        format: "pdf",
        status: "ready",
        metadata: { url: "https://example.com/scoped-1001.pdf" },
      },
      {
        invoiceId: otherInvoice.id,
        format: "pdf",
        status: "ready",
        metadata: { url: "https://example.com/scoped-2002.pdf" },
      },
    ])

    const missingCapabilityRes = await app.request(
      `/bookings/${booking.id}/documents/by-reference?reference=PF-SCOPED-1001`,
    )
    expect(missingCapabilityRes.status).toBe(401)

    const mismatchedCapabilityRes = await app.request(
      `/bookings/${booking.id}/documents/by-reference?reference=PF-SCOPED-1001`,
      {
        headers: await capabilityHeaders(otherBooking.id),
      },
    )
    expect(mismatchedCapabilityRes.status).toBe(401)

    const mismatchedReferenceRes = await app.request(
      `/bookings/${booking.id}/documents/by-reference?reference=PF-SCOPED-2002`,
      {
        headers: await capabilityHeaders(booking.id),
      },
    )
    expect(mismatchedReferenceRes.status).toBe(404)
  })

  it("lists booking-scoped public finance payments with invoice context", async () => {
    const booking = await seedBooking()
    const invoice = await seedInvoice(booking.id, {
      invoiceType: "invoice",
      totalCents: 50000,
      paidCents: 30000,
      balanceDueCents: 20000,
    })

    await db.insert(payments).values([
      {
        invoiceId: invoice.id,
        amountCents: 10000,
        currency: "USD",
        paymentMethod: "credit_card",
        status: "completed",
        paymentDate: "2025-06-03",
        referenceNumber: "PAY-1001",
      },
      {
        invoiceId: invoice.id,
        amountCents: 20000,
        currency: "USD",
        paymentMethod: "bank_transfer",
        status: "pending",
        paymentDate: "2025-06-05",
        referenceNumber: "PAY-1002",
      },
    ])

    const res = await app.request(`/bookings/${booking.id}/payments`, {
      headers: await capabilityHeaders(booking.id),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.bookingId).toBe(booking.id)
    expect(body.data.payments).toEqual([
      expect.objectContaining({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: "invoice",
        paymentMethod: "bank_transfer",
        status: "pending",
        amountCents: 20000,
        referenceNumber: "PAY-1002",
      }),
      expect.objectContaining({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: "invoice",
        paymentMethod: "credit_card",
        status: "completed",
        amountCents: 10000,
        referenceNumber: "PAY-1001",
      }),
    ])
  })

  it("starts and reads a public payment session for a booking schedule", async () => {
    const booking = await seedBooking()
    const [schedule] = await db
      .insert(bookingPaymentSchedules)
      .values({
        bookingId: booking.id,
        scheduleType: "deposit",
        status: "due",
        dueDate: "2025-05-01",
        currency: "EUR",
        amountCents: 18000,
      })
      .returning()

    const createRes = await app.request(
      `/bookings/${booking.id}/payment-schedules/${schedule.id}/payment-session`,
      {
        method: "POST",
        headers: { ...json({}).headers, ...(await capabilityHeaders(booking.id)) },
        body: JSON.stringify({
          provider: "netopia",
          payerEmail: "traveler@example.com",
          payerName: "Ana Popescu",
          clientReference: "public-schedule-1",
          returnUrl: "https://example.com/return",
        }),
      },
    )

    expect(createRes.status).toBe(201)
    const created = (await createRes.json()).data
    expect(created.targetType).toBe("booking_payment_schedule")
    expect(created.bookingPaymentScheduleId).toBe(schedule.id)
    expect(created.currency).toBe("EUR")
    expect(created.amountCents).toBe(18000)
    expect(created.payerEmail).toBe("traveler@example.com")

    const getRes = await app.request(`/payment-sessions/${created.id}`, {
      headers: await capabilityHeaders(booking.id),
    })
    expect(getRes.status).toBe(200)
    const stored = (await getRes.json()).data
    expect(stored.id).toBe(created.id)
    expect(stored.clientReference).toBe("public-schedule-1")

    const [sessionRow] = await db
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, created.id))
    expect(sessionRow?.bookingId).toBe(booking.id)
  })

  it("starts a public payment session from an invoice balance", async () => {
    const booking = await seedBooking()
    const invoice = await seedInvoice(booking.id, {
      totalCents: 125000,
      paidCents: 25000,
      balanceDueCents: 100000,
    })

    const res = await app.request(`/invoices/${invoice.id}/payment-session`, {
      method: "POST",
      headers: { ...json({}).headers, ...(await capabilityHeaders(booking.id)) },
      body: JSON.stringify({
        provider: "netopia",
        payerEmail: "traveler@example.com",
        returnUrl: "https://example.com/return",
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.targetType).toBe("invoice")
    expect(body.data.invoiceId).toBe(invoice.id)
    expect(body.data.amountCents).toBe(100000)
    expect(body.data.provider).toBe("netopia")
  })

  it("validates an active voucher instrument for public checkout", async () => {
    const booking = await seedBooking()

    const [voucher] = await db
      .insert(paymentInstruments)
      .values({
        ownerType: "internal",
        instrumentType: "voucher",
        status: "active",
        label: "Spring voucher",
        provider: "manual",
        externalToken: "SPRING-2026",
        metadata: {
          code: "SPRING-2026",
          currency: "EUR",
          amountCents: 30000,
          remainingAmountCents: 18000,
          bookingIds: [booking.id],
          expiresAt: "2026-12-31T23:59:59.000Z",
        },
      })
      .returning()

    const res = await app.request("/vouchers/validate", {
      method: "POST",
      headers: { ...json({}).headers, ...(await capabilityHeaders(booking.id)) },
      body: JSON.stringify({
        code: "spring-2026",
        bookingId: booking.id,
        currency: "EUR",
        amountCents: 10000,
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.valid).toBe(true)
    expect(body.data.reason).toBeNull()
    expect(body.data.voucher.id).toBe(voucher.id)
    expect(body.data.voucher.remainingAmountCents).toBe(18000)
  })

  it("reports insufficient balance for an otherwise valid voucher", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "internal",
      instrumentType: "voucher",
      status: "active",
      label: "Low balance voucher",
      provider: "manual",
      externalToken: "LOW-10",
      metadata: {
        code: "LOW-10",
        currency: "EUR",
        remainingAmountCents: 1000,
      },
    })

    const res = await app.request("/vouchers/validate", {
      method: "POST",
      ...json({
        code: "LOW-10",
        currency: "EUR",
        amountCents: 2000,
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.valid).toBe(false)
    expect(body.data.reason).toBe("insufficient_balance")
  })

  it("rejects booking-scoped public payment reads without a checkout capability", async () => {
    const booking = await seedBooking()
    const res = await app.request(`/bookings/${booking.id}/payment-options`)

    expect(res.status).toBe(401)
  })

  it("rejects a voucher when booking scope does not match", async () => {
    const booking = await seedBooking()
    const otherBooking = await seedBooking()

    await db.insert(paymentInstruments).values({
      ownerType: "internal",
      instrumentType: "voucher",
      status: "active",
      label: "Scoped voucher",
      provider: "manual",
      directBillReference: "SCOPED-1",
      metadata: {
        code: "SCOPED-1",
        bookingId: booking.id,
        currency: "USD",
        remainingAmountCents: 5000,
      },
    })

    const res = await app.request("/vouchers/validate", {
      method: "POST",
      headers: { ...json({}).headers, ...(await capabilityHeaders(otherBooking.id)) },
      body: JSON.stringify({
        code: "SCOPED-1",
        bookingId: otherBooking.id,
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.valid).toBe(false)
    expect(body.data.reason).toBe("booking_mismatch")
  })
})
