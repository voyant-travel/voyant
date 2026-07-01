import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createChannelPushAdminRoutes } from "../../src/channel-push/admin-routes.js"
import { triggerBookingPushForBookingWithResult } from "../../src/channel-push/subscriber.js"

const mocks = vi.hoisted(() => {
  let bookingRows: Array<{ id: string }> = [{ id: "book_1" }]
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => bookingRows),
        })),
      })),
    })),
  }
  return {
    db,
    get bookingRows() {
      return bookingRows
    },
    set bookingRows(rows: Array<{ id: string }>) {
      bookingRows = rows
    },
    processBookingPush: vi.fn(),
    resolveBookingPushTargets: vi.fn(),
    upsertPendingBookingLinks: vi.fn(),
  }
})

vi.mock("../../src/channel-push/types.js", () => ({
  defaultLogger: {},
  getChannelPushDepsOrThrow: vi.fn(() => ({ db: mocks.db, registry: {} })),
}))

vi.mock("../../src/channel-push/booking-push.js", () => ({
  processBookingPush: mocks.processBookingPush,
  resolveAllotmentTargetsForSlot: vi.fn(),
  resolveBookingPushTargets: mocks.resolveBookingPushTargets,
  resolveContentPushTargets: vi.fn(),
  upsertAvailabilityIntent: vi.fn(),
  upsertContentIntent: vi.fn(),
  upsertPendingBookingLinks: mocks.upsertPendingBookingLinks,
}))

describe("channel-push retry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.bookingRows = [{ id: "book_1" }]
    mocks.resolveBookingPushTargets.mockResolvedValue([])
    mocks.upsertPendingBookingLinks.mockResolvedValue(0)
    mocks.processBookingPush.mockResolvedValue({
      bookingId: "book_1",
      attempted: 0,
      succeeded: 0,
      failed: 0,
      compensated: 0,
      outcomes: [],
      reason: "no_pending_links",
    })
  })

  it("drains existing pending links even when no fresh target resolves", async () => {
    mocks.processBookingPush.mockResolvedValue({
      bookingId: "book_1",
      attempted: 1,
      succeeded: 1,
      failed: 0,
      compensated: 0,
      outcomes: [{ channelId: "chan_1", bookingItemId: "item_1", status: "ok" }],
    })

    const result = await triggerBookingPushForBookingWithResult("book_1")

    expect(mocks.upsertPendingBookingLinks).not.toHaveBeenCalled()
    expect(mocks.processBookingPush).toHaveBeenCalledWith(
      { bookingId: "book_1" },
      expect.anything(),
    )
    expect(result).toMatchObject({ attempted: 1, targetCount: 0, insertedLinks: 0 })
  })

  it("reports no-work retry results with ok false", async () => {
    const app = new Hono()
    app.route("/", createChannelPushAdminRoutes())

    const res = await app.request("/retry/book_1", { method: "POST" })

    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({
      ok: false,
      bookingId: "book_1",
      attempted: 0,
      reason: "no_targets",
    })
  })

  it("reports missing bookings with ok false", async () => {
    mocks.bookingRows = []
    mocks.processBookingPush.mockResolvedValue({
      bookingId: "book_missing",
      attempted: 0,
      succeeded: 0,
      failed: 0,
      compensated: 0,
      outcomes: [],
      reason: "no_pending_links",
    })
    const app = new Hono()
    app.route("/", createChannelPushAdminRoutes())

    const res = await app.request("/retry/book_missing", { method: "POST" })

    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({
      ok: false,
      bookingId: "book_missing",
      attempted: 0,
      reason: "booking_missing",
    })
  })
})
