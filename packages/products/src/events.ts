/**
 * Product domain events.
 *
 * Emitted by the products module on lifecycle and content changes.
 * `product.content.changed` is the load-bearing channel-push signal —
 * fired when ANY content axis (description, itinerary, media, options,
 * components, days) changes.
 *
 * Per docs/architecture/channel-push-architecture.md §6.
 */

import type { EventBus } from "@voyantjs/core"

/** Stable event identifier. */
export const PRODUCT_CONTENT_CHANGED_EVENT = "product.content.changed" as const

export interface ProductContentChangedEvent {
  /** Product id whose content changed. */
  id: string
  /**
   * The content axis that changed, when known. Diagnostic only — channel
   * push hashes the full current content at push time so this field is
   * not load-bearing for correctness.
   */
  axis?:
    | "product"
    | "component"
    | "itinerary"
    | "option"
    | "day"
    | "media"
    | "feature"
    | "faq"
    | "location"
    | "destination"
    | "category"
    | "tag"
    | "translation"
}

/**
 * Helper for route handlers / services to fire `product.content.changed`
 * with a stable shape. Fire-and-forget per the EventBus contract; the
 * caller does not await this if it's already on a hot path.
 *
 * v1 wiring: every product service/route mutation that touches a
 * content-affecting field should call this helper. The top-level PATCH
 * route already calls it (alongside the legacy `product.updated`); child
 * routes can be wired incrementally. Until full coverage exists, the
 * channel-push reconciler (§13) catches missed events by hashing
 * current content per (product, channel).
 */
export async function emitProductContentChanged(
  eventBus: EventBus | undefined,
  payload: ProductContentChangedEvent,
): Promise<void> {
  if (!eventBus) return
  await eventBus.emit(PRODUCT_CONTENT_CHANGED_EVENT, payload, {
    category: "domain",
    source: "service",
  })
}
