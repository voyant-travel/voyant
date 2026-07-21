import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  ensureCheckoutFinalization,
  withCheckoutFinalizationLock,
} from "../../src/checkout/finalization-store.js"
import {
  checkoutFinalizationDeliveries,
  checkoutFinalizations,
} from "../../src/checkout/schema-finalizations.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("checkout finalization store", () => {
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
  })

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE checkout_finalization_deliveries, checkout_finalizations CASCADE`)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  it("serializes distinct payment-session deliveries on one booking authority row", async () => {
    const firstIdentity = { bookingId: "booking_overlap", paymentSessionId: "session_overlap_1" }
    const secondIdentity = { bookingId: "booking_overlap", paymentSessionId: "session_overlap_2" }
    await Promise.all([
      ensureCheckoutFinalization(db, firstIdentity),
      ensureCheckoutFinalization(db, secondIdentity),
    ])

    let releaseFirst = () => {}
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let firstEntered = () => {}
    const firstDidEnter = new Promise<void>((resolve) => {
      firstEntered = resolve
    })
    const order: string[] = []
    const first = withCheckoutFinalizationLock(db, firstIdentity, async () => {
      order.push("first-enter")
      firstEntered()
      await firstCanFinish
      order.push("first-exit")
    })
    await firstDidEnter

    const second = withCheckoutFinalizationLock(db, secondIdentity, async () => {
      order.push("second-enter")
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(order).toEqual(["first-enter"])

    releaseFirst()
    await Promise.all([first, second])
    expect(order).toEqual(["first-enter", "first-exit", "second-enter"])

    const authorityRows = await db
      .select()
      .from(checkoutFinalizations)
      .where(eq(checkoutFinalizations.bookingId, "booking_overlap"))
    const deliveryRows = await db
      .select()
      .from(checkoutFinalizationDeliveries)
      .where(eq(checkoutFinalizationDeliveries.bookingId, "booking_overlap"))
    expect(authorityRows).toHaveLength(1)
    expect(deliveryRows).toHaveLength(2)
  })
})
