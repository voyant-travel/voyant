/**
 * Availability domain events.
 *
 * Emitted (after commit) by any path that mutates effective slot
 * remaining-pax: bookings (confirm / cancel / expire / modify-pax),
 * direct operator edits to a slot, and scheduled refresh recomputations.
 *
 * Subscribers MUST treat the payload as a trigger, not the source of
 * truth — re-read the slot row before acting on it. This is how the
 * channel-push availability flow stays correct under supersession (the
 * intent table collapses concurrent events for the same slot to one
 * row, and the worker reads the *current* slot state when processing).
 *
 * Per docs/architecture/channel-push-architecture.md §5.1.
 */

/** Stable string identifier for the event. */
export const AVAILABILITY_SLOT_CHANGED_EVENT = "availability.slot.changed" as const

/**
 * Origin of the change. Diagnostic only — channels don't behave
 * differently on this field, but it's preserved end-to-end so logs and
 * dashboards can attribute drift to a cause.
 */
export type AvailabilitySlotChangeSource =
  | "booking"
  | "cancel"
  | "expire"
  | "modify"
  | "manual"
  | "refresh"
  | "created"
  | "deleted"

export interface AvailabilitySlotChangedEvent {
  slotId: string
  productId: string
  optionId: string | null
  startsAt: Date | string
  /** New remaining-pax value AFTER the change. `null` when slot is unlimited. */
  remainingPax: number | null
  /** Whether the slot is unlimited — channels often need to know this explicitly. */
  unlimited: boolean
  source: AvailabilitySlotChangeSource
}
