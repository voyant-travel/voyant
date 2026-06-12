"use client"

import { useRef, useState } from "react"

import {
  emptyOptionUnitsStepperValue,
  OptionUnitsStepperSection,
  type OptionUnitsStepperUnit,
  type OptionUnitsStepperValue,
} from "../components/option-units-stepper-section.js"
import type { JourneyOptionSelection, UnitsPickerProps } from "../journey/index.js"

/**
 * Admin rooms/units picker for the booking journey's `"option-units"`
 * sub-step. Wraps the shared `OptionUnitsStepperSection` (which loads the
 * product's option units + per-slot availability) and mirrors the picked
 * quantities into the journey draft's `configure.optionSelections`.
 *
 * Wired into `<BookingJourneyHost />` via the `renderUnitsPicker` slot.
 */
export function JourneyUnitsPicker({
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
  // Loaded unit metadata is kept in a ref, NOT state: it's only read when
  // the operator changes a quantity, never rendered. Using state here would
  // make `onUnitsChange` (which fires as units load) re-render → the stepper
  // re-emits → setDraft → re-quote → re-render … an infinite loop.
  const unitsRef = useRef<ReadonlyArray<OptionUnitsStepperUnit>>([])

  const emit = (quantities: Record<string, number>): void => {
    const next: JourneyOptionSelection[] = []
    for (const unit of unitsRef.current) {
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
        emit(nextValue.quantities)
      }}
      productId={productId}
      slotId={slotId ?? undefined}
      optionId={optionId}
      // The journey nests rooms under the chosen option — show only that
      // option's units (New having no rooms correctly shows none).
      restrictToOption
      enabled
      // Record loaded units without triggering a render (see unitsRef note).
      onUnitsChange={(loadedUnits) => {
        unitsRef.current = loadedUnits
      }}
    />
  )
}
