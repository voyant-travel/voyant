/**
 * Cruise domain events.
 *
 * Emitted after successful local cruise mutations. Subscribers should treat
 * these payloads as invalidation triggers and re-read current cruise state
 * before updating catalog/search projections.
 */

import {
  CATALOG_EVENTS,
  type EntityOverlayChangedPayload,
  emitCatalogEvent,
} from "@voyant-travel/catalog"
import type { EventBus } from "@voyant-travel/core"

/** Stable string identifier for local cruise creation. */
export const CRUISE_CREATED_EVENT = "cruise.created" as const

/** Stable string identifier for local cruise updates. */
export const CRUISE_UPDATED_EVENT = "cruise.updated" as const

/** Stable string identifier for local cruise deletion/archive. */
export const CRUISE_DELETED_EVENT = "cruise.deleted" as const

export type CruiseLifecycleEventName =
  | typeof CRUISE_CREATED_EVENT
  | typeof CRUISE_UPDATED_EVENT
  | typeof CRUISE_DELETED_EVENT

export interface CruiseLifecycleEvent {
  /** Cruise id whose lifecycle changed. */
  id: string
}

export async function emitCruiseLifecycleEvent(
  eventBus: EventBus | undefined,
  event: CruiseLifecycleEventName,
  payload: CruiseLifecycleEvent,
): Promise<void> {
  if (!eventBus) return
  await eventBus.emit(event, payload, {
    category: "domain",
    source: "service",
  })
}

/** Emit the canonical index/read-model invalidation after a durable overlay mutation. */
export async function emitCruiseShipOverlayChanged(
  eventBus: EventBus | undefined,
  payload: EntityOverlayChangedPayload,
): Promise<void> {
  if (!eventBus) return
  await emitCatalogEvent(eventBus, CATALOG_EVENTS.ENTITY_OVERLAY_CHANGED, payload)
}
