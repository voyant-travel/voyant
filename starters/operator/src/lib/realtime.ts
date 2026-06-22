import type { RealtimeProvider, RealtimeRoutes } from "@voyant-travel/realtime"
import { createVoyantCloudRealtimeProvider } from "@voyant-travel/realtime/providers/voyant-cloud"

import { getCloudClient } from "./voyant-cloud"

/**
 * Resolve the realtime transport for this deployment — the Voyant Cloud
 * provider backed by the shared cloud client (mirrors
 * `resolveNotificationProviders`). The SDK's `client.realtime` namespace
 * satisfies the provider's structural contract directly, so no cast is needed.
 */
export function resolveRealtimeProviders(
  env: Record<string, unknown>,
): ReadonlyArray<RealtimeProvider> {
  return [createVoyantCloudRealtimeProvider({ client: getCloudClient(env) })]
}

/**
 * Maps domain events to realtime channels. The payload is an invalidation hint
 * (`{ event, entity, id }`), so connected admin/portal screens refetch over the
 * existing authenticated HTTP path rather than receiving entity data on the
 * wire. Deployments extend/override this map freely.
 */
export const operatorRealtimeBridgeRoutes: RealtimeRoutes = {
  "booking.confirmed": (e) => {
    const { bookingId } = e as { bookingId: string }
    return {
      channels: ["admin", `booking:${bookingId}`],
      hint: { entity: "booking", id: bookingId },
    }
  },
  "booking.cancelled": (e) => {
    const { bookingId } = e as { bookingId: string }
    return {
      channels: ["admin", `booking:${bookingId}`],
      hint: { entity: "booking", id: bookingId },
    }
  },
  "booking.fully-paid": (e) => {
    const { bookingId } = e as { bookingId: string }
    return {
      channels: ["admin", `booking:${bookingId}`],
      hint: { entity: "payment", id: bookingId },
    }
  },
  "payment.completed": (e) => {
    const { bookingId, paymentSessionId } = e as {
      bookingId?: string | null
      paymentSessionId: string
    }
    return { channels: ["admin"], hint: { entity: "payment", id: bookingId ?? paymentSessionId } }
  },
  "availability.slot.changed": (e) => {
    const { productId } = e as { productId: string }
    return {
      channels: ["admin", `product:${productId}`],
      hint: { entity: "availability", id: productId },
    }
  },
}
