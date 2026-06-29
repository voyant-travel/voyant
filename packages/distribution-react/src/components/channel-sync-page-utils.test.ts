import { describe, expect, it } from "vitest"

import { channelPushAdminPaths, joinUrl } from "./channel-sync-page-utils.js"

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
