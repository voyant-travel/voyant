// agent-quality: file-size exception -- owner: finance; adapter initiation,
// callback identity, and callback race coverage share the same Postgres
// payment-session settlement harness.
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

  it("persists the processor identity returned by a managed initiation", async () => {
    const { session } = await seedInvoiceSession(db, 7000)
    const adapter = stubAdapter("processing", {
      processorIdentity: {
        providerId: "netopia",
        connectionId: "payment_connection_123",
      },
    })
    const starter = createPaymentAdapterCardPaymentStarter(adapter)

    await starter({ env: {} } as Context, {
      db,
      sessionId: session.id,
      billing: { email: "managed@example.com", firstName: "Managed" },
    })

    await expect(refreshedSession(session.id)).resolves.toMatchObject({
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
      providerSessionId: "processor_session_processing",
      providerPaymentId: "processor_payment_processing",
    })
  })

  it("passes provider-neutral redirect and shipping fields to adapter initiation", async () => {
    const { session } = await seedInvoiceSession(db, 7000)
    const adapter = stubAdapter("processing")
    const starter = createPaymentAdapterCardPaymentStarter(adapter)

    await starter({ env: {} } as Context, {
      db,
      sessionId: session.id,
      billing: { email: "neutral@example.com", firstName: "Neutral" },
      returnUrl: "https://checkout.example.com/return",
      cancelUrl: "https://checkout.example.com/cancel",
      shipping: { method: "courier" },
      metadata: { source: "test" },
    })

    expect(adapter.initiate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        returnUrl: "https://checkout.example.com/return",
        cancelUrl: "https://checkout.example.com/cancel",
        shipping: { method: "courier" },
        metadata: expect.objectContaining({ source: "test" }),
      }),
    )
  })

  it("rejects a verified callback whose processor identity mismatches the stored session", async () => {
    const { session } = await seedInvoiceSession(db, 7000, {
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
    })

    await expect(
      applyPaymentAdapterCallbackEvent(db, {
        eventId: "evt_identity_mismatch",
        paymentSessionId: session.id,
        nextState: "paid",
        occurredAt: "2026-07-17T00:00:00.000Z",
        processorIdentity: {
          providerId: "stripe",
          connectionId: "payment_connection_123",
        },
        idempotencyKey: "callback-identity-mismatch",
      }),
    ).rejects.toThrow(/processor identity/i)

    await expect(rowCount(paymentAuthorizations)).resolves.toBe(0)
    await expect(rowCount(paymentCaptures)).resolves.toBe(0)
    await expect(rowCount(payments)).resolves.toBe(0)
  })

  it("requires a callback processor identity once the session connection is pinned", async () => {
    const { session } = await seedInvoiceSession(db, 7000, {
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
    })

    await expect(
      applyPaymentAdapterCallbackEvent(db, {
        eventId: "evt_missing_identity",
        paymentSessionId: session.id,
        nextState: "failed",
        occurredAt: "2026-07-17T00:00:00.000Z",
        idempotencyKey: "callback-missing-identity",
      }),
    ).rejects.toThrow(/processor identity is required/i)

    await expect(refreshedSession(session.id)).resolves.toMatchObject({
      status: "pending",
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
    })
  })

  it("adopts a legacy managed provider to the verified processor identity once", async () => {
    const { session } = await seedInvoiceSession(db, 7000, {
      provider: "managed",
    })

    await applyPaymentAdapterCallbackEvent(db, {
      eventId: "evt_managed_adoption",
      paymentSessionId: session.id,
      nextState: "processing",
      occurredAt: "2026-07-17T00:00:00.000Z",
      processorIdentity: {
        providerId: "netopia",
        connectionId: "payment_connection_123",
      },
      idempotencyKey: "callback-managed-adoption",
    })

    await expect(refreshedSession(session.id)).resolves.toMatchObject({
      status: "processing",
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
    })
  })

  it("rejects reverse managed provider identity mismatches", async () => {
    const { session } = await seedInvoiceSession(db, 7000, {
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
    })

    await expect(
      applyPaymentAdapterCallbackEvent(db, {
        eventId: "evt_reverse_managed",
        paymentSessionId: session.id,
        nextState: "processing",
        occurredAt: "2026-07-17T00:00:00.000Z",
        processorIdentity: {
          providerId: "managed",
          connectionId: "payment_connection_123",
        },
        idempotencyKey: "callback-reverse-managed",
      }),
    ).rejects.toThrow(/processor identity/i)

    await expect(refreshedSession(session.id)).resolves.toMatchObject({
      status: "pending",
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
    })
  })

  it("merges initiation and callback provider payload and metadata details", async () => {
    const { session } = await seedInvoiceSession(db, 9000, {
      providerPayload: { created: true },
      metadata: { createdBy: "test" },
    })
    const adapter = stubAdapter("processing", {
      raw: { hostedCheckoutId: "checkout_123" },
    })
    const starter = createPaymentAdapterCardPaymentStarter(adapter)

    await starter({ env: {} } as Context, {
      db,
      sessionId: session.id,
      billing: { email: "merge@example.com", firstName: "Merge" },
    })

    await applyPaymentAdapterCallbackEvent(db, {
      eventId: "evt_merge_paid",
      paymentSessionId: session.id,
      nextState: "paid",
      occurredAt: "2026-07-17T00:00:00.000Z",
      processorSessionId: "processor_session_processing",
      processorPaymentId: "processor_payment_processing",
      idempotencyKey: "callback-merge-paid",
      raw: { ipnId: "ipn_123" },
    })

    await expect(refreshedSession(session.id)).resolves.toMatchObject({
      providerPayload: {
        created: true,
        initiation: { hostedCheckoutId: "checkout_123" },
        callback: { ipnId: "ipn_123" },
      },
      metadata: {
        createdBy: "test",
        paymentAdapterInitiationIdempotencyKey: `payment:${session.id}`,
        paymentAdapterEventId: "evt_merge_paid",
        paymentAdapterOccurredAt: "2026-07-17T00:00:00.000Z",
      },
    })
  })

  it("applies concurrent duplicate paid callbacks exactly once", async () => {
    const { invoice, session } = await seedInvoiceSession(db, 11000, {
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
    })
    const eventBus = createEventBus()
    const events: Record<string, unknown[]> = {
      "invoice.payment.recorded": [],
      "invoice.settled": [],
      "payment.completed": [],
    }
    for (const eventName of Object.keys(events)) {
      eventBus.subscribe(eventName, (event) => events[eventName]?.push(event))
    }
    const callback = {
      eventId: "evt_duplicate_parallel",
      paymentSessionId: session.id,
      nextState: "paid" as const,
      occurredAt: "2026-07-17T00:00:00.000Z",
      processorIdentity: {
        providerId: "netopia",
        connectionId: "payment_connection_123",
      },
      processorSessionId: "processor_session_parallel",
      processorPaymentId: "processor_payment_parallel",
      idempotencyKey: "callback-duplicate-parallel",
      raw: { ipnId: "ipn_parallel" },
    }

    await Promise.all([
      applyPaymentAdapterCallbackEvent(db, callback, { eventBus }),
      applyPaymentAdapterCallbackEvent(db, callback, { eventBus }),
    ])

    await expect(rowCount(paymentAuthorizations)).resolves.toBe(1)
    await expect(rowCount(paymentCaptures)).resolves.toBe(1)
    await expect(rowCount(payments)).resolves.toBe(1)
    await expect(refreshedInvoice(invoice.id)).resolves.toMatchObject({
      status: "paid",
      paidCents: 11000,
      balanceDueCents: 0,
    })
    expect(events["invoice.payment.recorded"]).toHaveLength(1)
    expect(events["invoice.settled"]).toHaveLength(1)
    expect(events["payment.completed"]).toHaveLength(1)
  })

  it("does not let a late failed callback downgrade a paid session", async () => {
    const { invoice, session } = await seedInvoiceSession(db, 13000, {
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
    })

    await applyPaymentAdapterCallbackEvent(db, {
      eventId: "evt_paid_before_failure",
      paymentSessionId: session.id,
      nextState: "paid",
      occurredAt: "2026-07-17T00:00:00.000Z",
      processorIdentity: {
        providerId: "netopia",
        connectionId: "payment_connection_123",
      },
      processorSessionId: "processor_session_late_failure",
      processorPaymentId: "processor_payment_late_failure",
      idempotencyKey: "callback-paid-before-failure",
    })

    await applyPaymentAdapterCallbackEvent(db, {
      eventId: "evt_late_failure",
      paymentSessionId: session.id,
      nextState: "failed",
      occurredAt: "2026-07-17T00:00:01.000Z",
      processorIdentity: {
        providerId: "netopia",
        connectionId: "payment_connection_123",
      },
      idempotencyKey: "callback-late-failure",
    })

    await expect(rowCount(paymentAuthorizations)).resolves.toBe(1)
    await expect(rowCount(paymentCaptures)).resolves.toBe(1)
    await expect(rowCount(payments)).resolves.toBe(1)
    await expect(refreshedInvoice(invoice.id)).resolves.toMatchObject({
      status: "paid",
      paidCents: 13000,
      balanceDueCents: 0,
    })
    await expect(refreshedSession(session.id)).resolves.toMatchObject({
      status: "paid",
      failureCode: null,
      failureMessage: null,
    })
  })

  it("serializes genuinely concurrent failed and paid callbacks so paid wins", async () => {
    const { invoice, session } = await seedInvoiceSession(db, 14000, {
      provider: "netopia",
      providerConnectionId: "payment_connection_123",
    })

    await withConcurrentDbClients(async (firstDb, secondDb) => {
      await Promise.all([
        applyPaymentAdapterCallbackEvent(firstDb, {
          eventId: "evt_concurrent_paid",
          paymentSessionId: session.id,
          nextState: "paid",
          occurredAt: "2026-07-17T00:00:00.000Z",
          processorIdentity: {
            providerId: "netopia",
            connectionId: "payment_connection_123",
          },
          processorSessionId: "processor_session_concurrent_paid",
          processorPaymentId: "processor_payment_concurrent_paid",
          idempotencyKey: "callback-concurrent-paid",
        }),
        applyPaymentAdapterCallbackEvent(secondDb, {
          eventId: "evt_concurrent_failed",
          paymentSessionId: session.id,
          nextState: "failed",
          occurredAt: "2026-07-17T00:00:00.000Z",
          processorIdentity: {
            providerId: "netopia",
            connectionId: "payment_connection_123",
          },
          idempotencyKey: "callback-concurrent-failed",
        }),
      ])
    })

    await expect(rowCount(paymentAuthorizations)).resolves.toBe(1)
    await expect(rowCount(paymentCaptures)).resolves.toBe(1)
    await expect(rowCount(payments)).resolves.toBe(1)
    await expect(refreshedInvoice(invoice.id)).resolves.toMatchObject({
      status: "paid",
      paidCents: 14000,
      balanceDueCents: 0,
    })
    await expect(refreshedSession(session.id)).resolves.toMatchObject({
      status: "paid",
      failureCode: null,
      failureMessage: null,
    })
  })

  it("serializes concurrent managed provider adoption attempts", async () => {
    const { session } = await seedInvoiceSession(db, 7000, {
      provider: "managed",
    })

    const attempts = await withConcurrentDbClients((firstDb, secondDb) =>
      Promise.allSettled([
        applyPaymentAdapterCallbackEvent(firstDb, {
          eventId: "evt_adopt_netopia",
          paymentSessionId: session.id,
          nextState: "processing",
          occurredAt: "2026-07-17T00:00:00.000Z",
          processorIdentity: {
            providerId: "netopia",
            connectionId: "payment_connection_netopia",
          },
          idempotencyKey: "callback-adopt-netopia",
        }),
        applyPaymentAdapterCallbackEvent(secondDb, {
          eventId: "evt_adopt_stripe",
          paymentSessionId: session.id,
          nextState: "processing",
          occurredAt: "2026-07-17T00:00:00.000Z",
          processorIdentity: {
            providerId: "stripe",
            connectionId: "payment_connection_stripe",
          },
          idempotencyKey: "callback-adopt-stripe",
        }),
      ]),
    )

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1)
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1)
    await expect(refreshedSession(session.id)).resolves.toMatchObject({
      status: "processing",
      providerConnectionId: expect.stringMatching(/^payment_connection_(netopia|stripe)$/),
    })
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

  async function seedInvoiceSession(
    db: PostgresJsDatabase,
    amountCents: number,
    sessionOverrides: Partial<typeof paymentSessions.$inferInsert> = {},
  ) {
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
      ...sessionOverrides,
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

async function withConcurrentDbClients<T>(
  run: (firstDb: PostgresJsDatabase, secondDb: PostgresJsDatabase) => Promise<T>,
) {
  const { createDbClient } = await import("@voyant-travel/db")
  const databaseUrl = process.env.TEST_DATABASE_URL
  if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for concurrent DB clients.")
  const firstDb = createDbClient(databaseUrl, {
    adapter: "node",
    nodeMaxConnections: 1,
    timeouts: { statementMs: false, queryMs: false, connectMs: false },
  }) as PostgresJsDatabaseWithClient
  const secondDb = createDbClient(databaseUrl, {
    adapter: "node",
    nodeMaxConnections: 1,
    timeouts: { statementMs: false, queryMs: false, connectMs: false },
  }) as PostgresJsDatabaseWithClient
  try {
    return await run(firstDb, secondDb)
  } finally {
    await Promise.all([
      firstDb.$client?.end?.({ timeout: 0 }),
      secondDb.$client?.end?.({ timeout: 0 }),
    ])
  }
}

type PostgresJsDatabaseWithClient = PostgresJsDatabase & {
  $client?: {
    end?: (options?: { timeout?: number | null }) => Promise<unknown>
  }
}

function stubAdapter(
  nextState: Extract<PaymentSessionState, "authorized" | "paid" | "processing">,
  options: Partial<Awaited<ReturnType<PaymentAdapter["initiate"]>>> = {},
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
      ...options,
    })),
    verifyCallback: vi.fn(async () => ({ verified: false, reason: "malformed" })),
    health: vi.fn(async () => ({
      status: "ok",
      checkedAt: "2026-07-17T00:00:00.000Z",
    })),
  }
}
