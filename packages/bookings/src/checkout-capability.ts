import {
  createPublicCapabilityToken,
  extractPublicCapabilityToken,
  serializePublicCapabilityCookie,
  UnauthorizedApiError,
  verifyPublicCapabilityToken,
} from "@voyantjs/hono"
import type { Context } from "hono"

export const CHECKOUT_CAPABILITY_COOKIE = "voyant_checkout_session"
export const CHECKOUT_CAPABILITY_HEADER = "X-Voyant-Checkout-Capability"
export const CHECKOUT_CAPABILITY_SCOPE = "booking-checkout-session"

export const checkoutCapabilityActions = [
  "session:read",
  "session:update",
  "session:reprice",
  "session:finalize",
  "payment:read",
  "payment:start",
] as const

export type CheckoutCapabilityAction = (typeof checkoutCapabilityActions)[number]

const DEFAULT_TTL_SECONDS = 30 * 60
const MAX_TTL_SECONDS = 2 * 60 * 60

export function resolveCheckoutCapabilitySecret(env: Record<string, string | undefined>) {
  return (
    env.VOYANT_CHECKOUT_CAPABILITY_SECRET ??
    env.CHECKOUT_CAPABILITY_SECRET ??
    env.SESSION_CLAIMS_SECRET ??
    env.BETTER_AUTH_SECRET ??
    ""
  )
}

export function resolveCheckoutCapabilityTtlSeconds(env: Record<string, string | undefined>) {
  const raw = env.VOYANT_CHECKOUT_CAPABILITY_TTL_SECONDS ?? env.CHECKOUT_CAPABILITY_TTL_SECONDS
  const parsed = raw ? Number(raw) : DEFAULT_TTL_SECONDS
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TTL_SECONDS
  }

  return Math.min(Math.floor(parsed), MAX_TTL_SECONDS)
}

export async function issueCheckoutCapability(
  bookingId: string,
  env: Record<string, string | undefined>,
) {
  return createPublicCapabilityToken({
    secret: resolveCheckoutCapabilitySecret(env),
    scope: CHECKOUT_CAPABILITY_SCOPE,
    subjectId: bookingId,
    actions: [...checkoutCapabilityActions],
    ttlSeconds: resolveCheckoutCapabilityTtlSeconds(env),
  })
}

export async function requireCheckoutCapability(
  c: Context,
  bookingId: string,
  action: CheckoutCapabilityAction,
  env: Record<string, string | undefined>,
) {
  const token = extractPublicCapabilityToken(c, {
    headerName: CHECKOUT_CAPABILITY_HEADER,
    cookieName: CHECKOUT_CAPABILITY_COOKIE,
  })

  if (!token) {
    throw new UnauthorizedApiError("Missing checkout session capability")
  }

  return verifyPublicCapabilityToken(token, {
    secret: resolveCheckoutCapabilitySecret(env),
    scope: CHECKOUT_CAPABILITY_SCOPE,
    subjectId: bookingId,
    action,
  })
}

export function checkoutCapabilityCookie(token: string, expiresAt: Date) {
  return serializePublicCapabilityCookie({
    name: CHECKOUT_CAPABILITY_COOKIE,
    token,
    expiresAt,
    path: "/v1/public",
  })
}
