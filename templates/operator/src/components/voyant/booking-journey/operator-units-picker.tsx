"use client"

import {
  emptyOptionUnitsStepperValue,
  OptionUnitsStepperSection,
  type OptionUnitsStepperUnit,
  type OptionUnitsStepperValue,
} from "@voyantjs/bookings-ui"
import type { JourneyOptionSelection, UnitsPickerProps } from "@voyantjs/bookings-ui/journey"
import { useState } from "react"

/**
 * Operator rooms/units picker for the booking journey's `"option-units"`
 * sub-step. Wraps the shared `OptionUnitsStepperSection` (which loads the
 * product's option units + per-slot availability) and mirrors the picked
 * quantities into the journey draft's `configure.optionSelections`.
 *
 * Wired into `<OperatorBookingJourney />` via the `renderUnitsPicker` slot.
 */
export function OperatorUnitsPicker({
  productId,
  optionId,
  slotId,
  selections,
  onChange,
}: UnitsPickerProps): React.ReactElement {
  // Seed the stepper from any selections already on the draft (refresh /
  // step revisit). Local state mirrors the departure picker's approach.
  const [value, setValue] = useState<OptionUnitsStepperValue>(() => {
    const quantities: Record<string, number> = {}
    for (const selection of selections) {
      if (selection.optionUnitId) quantities[selection.optionUnitId] = selection.quantity
    }
    return Object.keys(quantities).length > 0 ? { quantities } : emptyOptionUnitsStepperValue
  })
  // The loaded unit metadata (optionId + name per unit) needed to rebuild
  // `optionSelections` from the quantity map.
  const [units, setUnits] = useState<OptionUnitsStepperUnit[]>([])

  const emit = (
    quantities: Record<string, number>,
    unitList: ReadonlyArray<OptionUnitsStepperUnit>,
  ): void => {
    const next: JourneyOptionSelection[] = []
    for (const unit of unitList) {
      const quantity = quantities[unit.optionUnitId] ?? 0
      if (quantity <= 0) continue
      const unitOptionId = unit.optionId ?? optionId
      if (!unitOptionId) continue
      next.push({
        optionId: unitOptionId,
        optionUnitId: unit.optionUnitId,
        optionUnitName: unit.unitName,
        quantity,
      })
    }
    onChange(next)
  }

  return (
    <OptionUnitsStepperSection
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue)
        emit(nextValue.quantities, units)
      }}
      productId={productId}
      slotId={slotId ?? undefined}
      optionId={optionId}
      enabled
      onUnitsChange={(loadedUnits) => {
        setUnits(loadedUnits)
        // Backfill option/name metadata once units load (quantities may
        // have been seeded from the draft before the list arrived).
        emit(value.quantities, loadedUnits)
      }}
    />
  )
}
