import type { Actor } from "@voyant-travel/core"

import type { RealtimeCapabilities } from "./types.js"

/**
 * Portal ownership scope for a customer session — supplied by the deployment
 * (which owns the CRM/bookings schemas), so this package stays decoupled from
 * those modules.
 */
export interface PortalScope {
  /** The CRM person id behind the portal session. */
  personId: string
  /** Booking ids the customer may subscribe to. */
  bookingIds: ReadonlyArray<string>
}

export interface RealtimeCapabilityContext {
  actor: Actor | undefined
  userId: string | undefined
  /** Resolved portal scope for customer/partner/supplier sessions. */
  portalScope?: PortalScope | null
}

const SUBSCRIBE = ["subscribe"] as const
const SUBSCRIBE_PRESENCE = ["subscribe", "presence"] as const

/**
 * Resolve the channel capabilities a session is entitled to, per the RFC's
 * channel conventions:
 *
 * | Channel                        | Audience                              |
 * | ------------------------------ | ------------------------------------- |
 * | `admin`                        | all admin users of the deployment     |
 * | `booking:{bookingId}`          | admins; the booking's customer        |
 * | `portal:customer:{personId}`   | that customer in the portal           |
 * | `notifications:user:{userId}`  | a specific staff user                 |
 *
 * Staff sessions get broad admin scope; portal sessions get only their own
 * person channel and the bookings they own. Browsers never see API keys — only
 * the short-lived scoped token minted from these capabilities.
 */
export function resolveRealtimeCapabilities(ctx: RealtimeCapabilityContext): RealtimeCapabilities {
  const capabilities: Record<string, ReadonlyArray<"subscribe" | "publish" | "presence">> = {}

  if (!ctx.userId || !ctx.actor) {
    return capabilities
  }

  if (ctx.actor === "staff") {
    capabilities.admin = SUBSCRIBE
    // Wildcard subscribe — admins may watch any booking detail screen.
    capabilities["booking:*"] = SUBSCRIBE
    capabilities[`notifications:user:${ctx.userId}`] = SUBSCRIBE_PRESENCE
    return capabilities
  }

  // Customer / partner / supplier (portal) sessions.
  capabilities[`notifications:user:${ctx.userId}`] = SUBSCRIBE
  if (ctx.portalScope) {
    capabilities[`portal:customer:${ctx.portalScope.personId}`] = SUBSCRIBE_PRESENCE
    for (const bookingId of ctx.portalScope.bookingIds) {
      capabilities[`booking:${bookingId}`] = SUBSCRIBE
    }
  }
  return capabilities
}
