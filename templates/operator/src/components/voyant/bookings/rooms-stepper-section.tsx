"use client"

import { useSlotUnitAvailability } from "@voyantjs/availability-react"
import { Button, Label } from "@voyantjs/ui/components"
import { Minus, Plus } from "lucide-react"

/** Quantity per option_unit id; omitted ids are treated as 0. */
export interface RoomsStepperValue {
  quantities: Record<string, number>
}

export const emptyRoomsStepperValue: RoomsStepperValue = { quantities: {} }

export interface RoomsStepperSectionProps {
  value: RoomsStepperValue
  onChange: (value: RoomsStepperValue) => void
  /**
   * Departure the operator picked. Section renders nothing until a slot is
   * chosen — per-unit availability is a property of the slot, not the
   * product, so there's nothing to show before then.
   */
  slotId?: string
  enabled?: boolean
  labels?: {
    heading?: string
    noSlot?: string
    noUnits?: string
    remaining?: string
    unlimited?: string
  }
}

const DEFAULT_LABELS = {
  heading: "Rooms",
  noSlot: "Pick a departure first to see available rooms.",
  noUnits: "This departure has no per-unit availability configured.",
  remaining: "left",
  unlimited: "unlimited",
} as const

/**
 * Rooms / per-unit stepper for booking-create flows. Drives
 * `GET /v1/availability/slots/:id/unit-availability` from #235 so the
 * operator sees authoritative "3 doubles available" numbers instead of
 * client-side math against a sampled booking list.
 *
 * The section only tracks **intent** (how many of each unit the operator
 * wants to book). Actual hold/reservation happens when the parent submits
 * the booking — capacity drops the moment the reservation transaction
 * commits; the next refetch of `useSlotUnitAvailability` reflects it.
 *
 * ### Stepper bounds
 *
 * - Minimum is 0 (operator can deselect).
 * - Maximum is the unit's `remaining` count from the server. Unlimited
 *   pools (`remaining === null`) have no upper bound.
 * - The server is the truth: entering `3 doubles` when only 2 remain just
 *   disables the "+" button — we don't let the UI submit a request that
 *   would 409 at insert time.
 */
export function RoomsStepperSection({
  value,
  onChange,
  slotId,
  enabled = true,
  labels,
}: RoomsStepperSectionProps) {
  const merged = { ...DEFAULT_LABELS, ...labels }
  const availability = useSlotUnitAvailability({ slotId, enabled: enabled && Boolean(slotId) })
  const units = availability.data?.data ?? []

  if (!slotId) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Label>{merged.heading}</Label>
        <p className="text-xs text-muted-foreground">{merged.noSlot}</p>
      </div>
    )
  }

  if (availability.isSuccess && units.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Label>{merged.heading}</Label>
        <p className="text-xs text-muted-foreground">{merged.noUnits}</p>
      </div>
    )
  }

  const setQuantity = (unitId: string, qty: number) => {
    const next = { ...value.quantities }
    if (qty <= 0) {
      delete next[unitId]
    } else {
      next[unitId] = qty
    }
    onChange({ quantities: next })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <Label>{merged.heading}</Label>
      <div className="flex flex-col gap-2">
        {units.map((unit) => {
          const qty = value.quantities[unit.optionUnitId] ?? 0
          const remainingLabel =
            unit.remaining === null ? merged.unlimited : `${unit.remaining} ${merged.remaining}`
          const atMax = unit.remaining !== null && qty >= unit.remaining

          return (
            <div
              key={unit.optionUnitId}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <div className="flex-1">
                <div className="text-sm font-medium">{unit.unitName}</div>
                <div className="text-xs text-muted-foreground">{remainingLabel}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setQuantity(unit.optionUnitId, Math.max(0, qty - 1))}
                  disabled={qty <= 0}
                  aria-label={`Decrease ${unit.unitName}`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-[1.5rem] text-center text-sm tabular-nums">{qty}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setQuantity(unit.optionUnitId, qty + 1)}
                  disabled={atMax}
                  aria-label={`Increase ${unit.unitName}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
