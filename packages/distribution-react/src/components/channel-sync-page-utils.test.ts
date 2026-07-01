import { describe, expect, it } from "vitest"

import {
  channelPushAdminPaths,
  classifyRetryResult,
  joinUrl,
  unwrapData,
} from "./channel-sync-page-utils.js"

describe("channel sync admin paths", () => {
  it("matches the channel-push admin route contract", () => {
    expect(channelPushAdminPaths.links).toBe("/v1/admin/distribution/links")
    expect(channelPushAdminPaths.throttling).toBe("/v1/admin/distribution/throttling")
    expect(channelPushAdminPaths.deliveries).toBe("/v1/admin/distribution/deliveries")
    expect(channelPushAdminPaths.retry("booking 1")).toBe(
      "/v1/admin/distribution/retry/booking%201",
    )
    expect(channelPushAdminPaths.reconcile("bookings")).toBe(
      "/v1/admin/distribution/reconcile/bookings",
    )
  })

  it("joins configured base URLs with route paths", () => {
    expect(joinUrl("/api/", channelPushAdminPaths.links)).toBe("/api/v1/admin/distribution/links")
  })
})

describe("channel sync retry feedback helpers", () => {
  it("unwraps data envelopes returned by admin mutation routes", () => {
    expect(unwrapData({ data: { scanned: 2, triggered: 1 } })).toEqual({
      scanned: 2,
      triggered: 1,
    })
    expect(unwrapData({ scanned: 2, triggered: 1 })).toEqual({ scanned: 2, triggered: 1 })
  })

  it("classifies processed retry results", () => {
    expect(
      classifyRetryResult({
        ok: true,
        bookingId: "booking_1",
        attempted: 2,
        succeeded: 2,
        failed: 0,
        compensated: 0,
      }),
    ).toBe("processed")
  })

  it("classifies actionable no-work and configuration retry outcomes", () => {
    expect(
      classifyRetryResult({
        ok: true,
        bookingId: "booking_1",
        reason: "no_pending_links",
      }),
    ).toBe("no_pending_links")
    expect(
      classifyRetryResult({
        ok: true,
        bookingId: "booking_1",
        reason: "no_targets",
      }),
    ).toBe("no_targets")
    expect(
      classifyRetryResult({
        ok: true,
        bookingId: "booking_1",
        reason: "booking_missing",
      }),
    ).toBe("booking_missing")
    expect(
      classifyRetryResult({
        ok: true,
        bookingId: "booking_1",
        outcomes: [
          {
            channelId: "channel_1",
            bookingItemId: null,
            status: "failed",
            error: "no_adapter_registered",
          },
        ],
      }),
    ).toBe("no_adapter")
    expect(
      classifyRetryResult({
        ok: true,
        bookingId: "booking_1",
        outcomes: [
          {
            channelId: "channel_1",
            bookingItemId: null,
            status: "failed",
            error: "no_mapping",
          },
        ],
      }),
    ).toBe("no_mapping")
  })
})
