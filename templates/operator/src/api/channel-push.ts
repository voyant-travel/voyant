/**
 * Channel-push runtime wiring.
 *
 * Subscribes to the three source events (`booking.confirmed`,
 * `availability.slot.changed`, `product.content.changed`) and drains
 * the resulting durable-intent rows inline. The Cloudflare Workers
 * deployment is single-process per request, so we don't need the
 * separate workflow runtime — the inline drain runs within the same
 * isolate that emitted the event.
 *
 * The adapter registry is the same singleton the booking engine uses
 * (`getBookingEngineRegistry`), so a deployment with `CATALOG_DEMO_API_URL`
 * set automatically pushes back to the demo upstream's
 * `/push-booking|/push-availability|/push-content` endpoints. Real
 * channels register their adapters in `booking-engine-runtime.ts`
 * alongside the demo.
 *
 * Per docs/architecture/channel-push-architecture.md §10 (Phase D-G).
 */

import {
  processAvailabilityPushIntents,
  processBookingPush,
  processContentPushIntents,
  resolveAllotmentTargetsForSlot,
  resolveBookingPushTargets,
  resolveContentPushTargets,
  upsertAvailabilityIntent,
  upsertContentIntent,
  upsertPendingBookingLinks,
} from "@voyantjs/distribution/channel-push"
import type { HonoBundle } from "@voyantjs/hono/plugin"

import { type BookingEngineEnv, getBookingEngineRegistry } from "./lib/booking-engine-runtime"
import { getDbFromHyperdrive } from "./lib/db"

interface BookingConfirmedPayload {
  bookingId: string
  bookingNumber?: string
  actorId?: string | null
}

interface AvailabilitySlotChangedPayload {
  slotId: string
  productId: string
  optionId: string | null
  startsAt: Date | string
  remainingPax: number | null
  unlimited: boolean
  source: string
}

interface ProductContentChangedPayload {
  id: string
  axis?: string
}

export const channelPushBundle: HonoBundle = {
  name: "channel-push",
  bootstrap: ({ bindings, eventBus }) => {
    const env = bindings as CloudflareBindings & BookingEngineEnv
    const registry = getBookingEngineRegistry(env)

    function buildDeps() {
      return {
        db: getDbFromHyperdrive(env),
        registry,
      }
    }

    eventBus.subscribe<BookingConfirmedPayload>("booking.confirmed", async ({ data }) => {
      try {
        const deps = buildDeps()
        const targets = await resolveBookingPushTargets(deps.db, data.bookingId)
        if (targets.length === 0) return
        await upsertPendingBookingLinks(deps.db, data.bookingId, targets)
        await processBookingPush({ bookingId: data.bookingId }, deps)
      } catch (err) {
        console.error("[channel-push] booking.confirmed failed", {
          bookingId: data.bookingId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })

    eventBus.subscribe<AvailabilitySlotChangedPayload>(
      "availability.slot.changed",
      async ({ data }) => {
        try {
          const deps = buildDeps()
          const targets = await resolveAllotmentTargetsForSlot(deps.db, {
            slotId: data.slotId,
            productId: data.productId,
            optionId: data.optionId,
          })
          if (targets.length === 0) return

          const startsAt = data.startsAt instanceof Date ? data.startsAt : new Date(data.startsAt)
          for (const target of targets) {
            await upsertAvailabilityIntent(deps.db, {
              channelId: target.channelId,
              sourceConnectionId: target.sourceConnectionId,
              slotId: data.slotId,
              productId: data.productId,
              optionId: data.optionId,
              startsAt,
            })
          }

          // Drain per-channel inline — the inline path keeps latency
          // bounded for dev / single-isolate deployments. Production
          // deployments with the workflow runtime wired skip this and
          // let the scheduled `channel.availability.push` workflow drain.
          for (const target of targets) {
            await processAvailabilityPushIntents({ channelId: target.channelId, limit: 50 }, deps)
          }
        } catch (err) {
          console.error("[channel-push] availability.slot.changed failed", {
            slotId: data.slotId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      },
    )

    eventBus.subscribe<ProductContentChangedPayload>(
      "product.content.changed",
      async ({ data }) => {
        try {
          const deps = buildDeps()
          const targets = await resolveContentPushTargets(deps.db, data.id)
          if (targets.length === 0) return

          for (const target of targets) {
            await upsertContentIntent(deps.db, {
              channelId: target.channelId,
              sourceConnectionId: target.sourceConnectionId,
              productId: data.id,
            })
          }

          for (const target of targets) {
            await processContentPushIntents({ channelId: target.channelId, limit: 50 }, deps)
          }
        } catch (err) {
          console.error("[channel-push] product.content.changed failed", {
            productId: data.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      },
    )
  },
}
