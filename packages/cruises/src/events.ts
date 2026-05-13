/**
 * Cruise domain events.
 *
 * Emitted after successful local cruise mutations. Subscribers should treat
 * these payloads as invalidation triggers and re-read current cruise state
 * before updating catalog/search projections.
 */

import type { EventBus } from "@voyantjs/core"

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
