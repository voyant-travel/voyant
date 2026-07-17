import { createEventBus } from "@voyant-travel/core"
import {
  PAYMENT_ADAPTER_CONTRACT_VERSION,
  type PaymentAdapter,
  type PaymentSessionState,
} from "@voyant-travel/payments"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { createPaymentAdapterCardPaymentStarter } from "../../src/card-payment.js"
import { applyPaymentAdapterCallbackEvent } from "../../src/payment-adapter-events.js"
import {
  invoices,
  paymentAuthorizations,
  paymentCaptures,
  paymentSessions,
  payments,
} from "../../src/schema.js"
import { financeService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let seq = 0
function next(prefix: string) {
  seq += 1
  return `${prefix}-${String(seq).padStart(5, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("payment adapter initiation", () => {
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  it("routes a synchronously paid initiation through completion once", async () => {
    const { invoice, session } = await seedInvoiceSession(db, 12000)
    const eventBus = createEventBus()
    const events: Record<string, unknown[]> = {
      "invoice.payment.recorded": [],
      "invoice.settled": [],
      "payment.completed": [],
    }
    for (const eventName of Object.keys(events)) {
      eventBus.subscribe(eventName, (event) => events[eventName]?.push(event))
    }

    const adapter = stubAdapter("paid")
    const starter = createPaymentAdapterCardPaymentStarter(adapter, {
      resolveRuntime: () => ({ eventBus }),
    })

    await starter({ env: {} } as Context, {
      db,
      sessionId: session.id,
      billing: { email: "paid@example.com", firstName: "Paid" },
    })

    await expect(rowCount(paymentAuthorizations)).resolves.toBe(1)
    await expect(rowCount(paymentCaptures)).resolves.toBe(1)
    await expect(rowCount(payments)).resolves.toBe(1)
    await expect(refreshedInvoice(invoice.id)).resolves.toMatchObject({
      status: "paid",
      paidCents: 12000,
      balanceDueCents: 0,
    })
    expect(events["invoice.payment.recorded"]).toHaveLength(1)
    expect(events["invoice.settled"]).toHaveLength(1)
    expect(events["payment.completed"]).toHaveLength(1)

    await applyPaymentAdapterCallbackEvent(
      db,
      {
        eventId: "evt_duplicate_paid",
        paymentSessionId: session.id,
        nextState: "paid",
        occurredAt: "2026-07-17T00:00:00.000Z",
        processorSessionId: "processor_session_paid",
        processorPaymentId: "processor_payment_paid",
        idempotencyKey: "callback-paid",
      },
      { eventBus },
    )

    await expect(rowCount(paymentAuthorizations)).resolves.toBe(1)
    await expect(rowCount(paymentCaptures)).resolves.toBe(1)
    await expect(rowCount(payments)).resolves.toBe(1)
    expect(events["invoice.payment.recorded"]).toHaveLength(1)
    expect(events["invoice.settled"]).toHaveLength(1)
    expect(events["payment.completed"]).toHaveLength(1)
  })

  it("routes a synchronously authorized initiation through completion once", async () => {
    const { session } = await seedInvoiceSession(db, 8000)
    const adapter = stubAdapter("authorized")
    const starter = createPaymentAdapterCardPaymentStarter(adapter)

    await starter({ env: {} } as Context, {
      db,
      sessionId: session.id,
      billing: { email: "auth@example.com", firstName: "Authorized" },
    })

    await expect(rowCount(paymentAuthorizations)).resolves.toBe(1)
    await expect(rowCount(paymentCaptures)).resolves.toBe(0)
    await expect(rowCount(payments)).resolves.toBe(0)
    await expect(refreshedSession(session.id)).resolves.toMatchObject({ status: "authorized" })

    await applyPaymentAdapterCallbackEvent(db, {
      eventId: "evt_duplicate_authorized",
      paymentSessionId: session.id,
      nextState: "authorized",
      occurredAt: "2026-07-17T00:00:00.000Z",
      processorSessionId: "processor_session_authorized",
      processorPaymentId: "processor_payment_authorized",
      idempotencyKey: "callback-authorized",
    })

    await expect(rowCount(paymentAuthorizations)).resolves.toBe(1)
    await expect(rowCount(paymentCaptures)).resolves.toBe(0)
    await expect(rowCount(payments)).resolves.toBe(0)
  })

  async function seedInvoiceSession(db: PostgresJsDatabase, amountCents: number) {
    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber: next("INV"),
        bookingId: next("book"),
        invoiceType: "invoice",
        status: "issued",
        currency: "EUR",
        issueDate: "2026-07-17",
        dueDate: "2026-07-24",
        subtotalCents: amountCents,
        taxCents: 0,
        totalCents: amountCents,
        paidCents: 0,
        balanceDueCents: amountCents,
      })
      .returning()
    if (!invoice) throw new Error("Invoice seed failed.")

    const session = await financeService.createPaymentSession(db, {
      invoiceId: invoice.id,
      amountCents,
      currency: invoice.currency,
      status: "pending",
      paymentMethod: "credit_card",
      notes: "Adapter initiation test",
      targetType: "invoice",
      targetId: invoice.id,
    })
    if (!session) throw new Error("Payment session seed failed.")
    return { invoice, session }
  }

  async function rowCount(
    table: typeof paymentAuthorizations | typeof paymentCaptures | typeof payments,
  ) {
    return (await db.select().from(table)).length
  }

  async function refreshedInvoice(id: string) {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1)
    return row
  }

  async function refreshedSession(id: string) {
    const [row] = await db.select().from(paymentSessions).where(eq(paymentSessions.id, id)).limit(1)
    return row
  }
})

function stubAdapter(
  nextState: Extract<PaymentSessionState, "authorized" | "paid">,
): PaymentAdapter {
  return {
    id: "test-adapter",
    label: "Test Adapter",
    contractVersion: PAYMENT_ADAPTER_CONTRACT_VERSION,
    mode: "test",
    capabilities: {
      hostedCheckout: true,
      redirectCheckout: true,
      authorize: false,
      capture: false,
      void: false,
      refund: false,
      status: false,
      callbackSignatureVerification: true,
      idempotencyKeys: true,
      retrySafeInitiation: true,
    },
    initiate: vi.fn(async (_context, input) => ({
      nextState,
      idempotencyKey: input.idempotencyKey,
      processorSessionId: `processor_session_${nextState}`,
      processorPaymentId: `processor_payment_${nextState}`,
    })),
    verifyCallback: vi.fn(async () => ({ verified: false, reason: "malformed" })),
    health: vi.fn(async () => ({
      status: "ok",
      checkedAt: "2026-07-17T00:00:00.000Z",
    })),
  }
}
