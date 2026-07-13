import {
  clientIpKey,
  enforceRateLimit,
  type RateLimitRequestContext,
} from "@voyant-travel/hono/middleware/rate-limit"

export function guestBookingLookupLimit(env: Readonly<Record<string, unknown>>): number {
  const raw =
    env.VOYANT_GUEST_BOOKING_LOOKUP_LIMIT_PER_MINUTE ?? env.GUEST_BOOKING_LOOKUP_LIMIT_PER_MINUTE
  const parsed = typeof raw === "string" ? Number(raw) : 10
  if (!Number.isFinite(parsed) || parsed <= 0) return 10
  return Math.min(Math.floor(parsed), 100)
}

export function enforceGuestBookingLookupRateLimit(
  context: RateLimitRequestContext,
  bookingCode: string,
  env: Readonly<Record<string, unknown>>,
): Promise<Response | null> {
  const lookupKey = bookingCode.trim().toLowerCase()
  return enforceRateLimit(context, {
    bucket: "guest-booking-lookup",
    max: guestBookingLookupLimit(env),
    windowSeconds: 60,
    clientKey: (request) => `${clientIpKey(request)}:${lookupKey}`,
  })
}
