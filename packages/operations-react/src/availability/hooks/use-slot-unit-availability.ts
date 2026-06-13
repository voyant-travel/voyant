"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantAvailabilityContext } from "../provider.js"
import { getSlotUnitAvailabilityQueryOptions } from "../query-options.js"

export interface UseSlotUnitAvailabilityOptions {
  slotId: string | null | undefined
  enabled?: boolean
}

/**
 * Per-option-unit availability for a slot. Returns one row per `option_unit`
 * on the slot's option, with `initial` (from `option_units.max_quantity`),
 * `reserved` (sum of active bookings' item quantity for this slot + unit),
 * and `remaining = initial - reserved` (or `null` when the pool is
 * unlimited).
 *
 * Active booking statuses counted: draft, on_hold, confirmed, in_progress,
 * completed. cancelled + expired are excluded.
 */
export function useSlotUnitAvailability({
  slotId,
  enabled = true,
}: UseSlotUnitAvailabilityOptions) {
  const client = useVoyantAvailabilityContext()
  return useQuery({
    ...getSlotUnitAvailabilityQueryOptions(client, slotId),
    enabled: enabled && Boolean(slotId),
  })
}
