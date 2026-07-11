import type { EventEnvelope } from "@voyant-travel/core"
import { createContainer, createEventBus } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { describe, expect, it, vi } from "vitest"

import {
  COMMERCE_PROMOTION_REDEMPTION_SUBSCRIBER_ID,
  createPromotionRedemptionSubscriberRuntime,
} from "../../src/promotions/subscriber-runtime.js"

function captureHandler() {
  const eventBus = createEventBus()
  let handler: ((event: EventEnvelope) => Promise<void> | void) | undefined
  vi.spyOn(eventBus, "subscribe").mockImplementation((_eventType, registeredHandler) => {
    handler = registeredHandler as typeof handler
    return { unsubscribe: vi.fn() }
  })
  return { eventBus, getHandler: () => handler }
}

function bookingConfirmed(bookingId: string): EventEnvelope {
  return {
    name: "booking.confirmed",
    data: { bookingId },
    emittedAt: new Date().toISOString(),
    metadata: undefined,
  }
}

describe("commerce promotion-redemption subscriber runtime", () => {
  it("registers the package-owned descriptor and records every delivery", async () => {
    const db = { kind: "test-db" } as unknown as AnyDrizzleDb
    const bindings = { DATABASE_URL: "postgres://commerce" }
    const recordRedemptions = vi.fn(async () => ({
      quotesScanned: 1,
      offersFound: 1,
      rowsUpserted: 1,
    }))
    const withDb = vi.fn(async (_bindings, operation) => operation(db))
    const { eventBus, getHandler } = captureHandler()
    const descriptor = createPromotionRedemptionSubscriberRuntime({
      withDb,
      recordRedemptions,
    })

    await descriptor.register({ bindings, container: createContainer(), eventBus })

    expect({ id: descriptor.id, eventType: descriptor.eventType }).toEqual({
      id: COMMERCE_PROMOTION_REDEMPTION_SUBSCRIBER_ID,
      eventType: "booking.confirmed",
    })

    await getHandler()?.(bookingConfirmed("booking_1"))
    await getHandler()?.(bookingConfirmed("booking_1"))

    expect(withDb).toHaveBeenCalledTimes(2)
    expect(withDb).toHaveBeenNthCalledWith(1, bindings, expect.any(Function))
    expect(recordRedemptions).toHaveBeenCalledTimes(2)
    expect(recordRedemptions).toHaveBeenNthCalledWith(1, db, "booking_1")
  })

  it("warns and swallows recorder failures", async () => {
    const logger = { warn: vi.fn() }
    const recordRedemptions = vi.fn(async () => {
      throw new Error("database unavailable")
    })
    const { eventBus, getHandler } = captureHandler()
    const descriptor = createPromotionRedemptionSubscriberRuntime({
      withDb: async (_bindings, operation) => operation({} as AnyDrizzleDb),
      recordRedemptions,
      logger,
    })
    await descriptor.register({ bindings: {}, container: createContainer(), eventBus })

    await expect(getHandler()?.(bookingConfirmed("booking_2"))).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      "[catalog-bridge] promotion redemption recorder failed",
      {
        bookingId: "booking_2",
        error: "database unavailable",
      },
    )
  })
})
