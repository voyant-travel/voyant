import type { RateLimitStore } from "@voyant-travel/hono"
import { describe, expect, it, vi } from "vitest"

import { enforceGuestBookingLookupRateLimit } from "../../src/guest-booking-rate-limit.js"

describe("guest booking lookup rate limit", () => {
  it("uses the selected atomic store with client and booking dimensions", async () => {
    const store: RateLimitStore = {
      limit: vi.fn(async () => ({ allowed: false, remaining: 0, retryAfterSeconds: 30 })),
    }
    const response = await enforceGuestBookingLookupRateLimit(
      {
        env: { RATE_LIMIT_STORE: store },
        req: {
          method: "POST",
          url: "https://operator.test/api/v1/public/bookings/lookup",
          header: (name) => (name === "x-real-ip" ? "203.0.113.42" : undefined),
        },
        header: vi.fn(),
      },
      "  ABC-123  ",
      { VOYANT_GUEST_BOOKING_LOOKUP_LIMIT_PER_MINUTE: "7" },
    )

    expect(store.limit).toHaveBeenCalledWith("lim:guest-booking-lookup:203.0.113.42:abc-123", {
      max: 7,
      windowSeconds: 60,
    })
    expect(response?.status).toBe(429)
    expect(response?.headers.get("retry-after")).toBe("30")
  })
})
