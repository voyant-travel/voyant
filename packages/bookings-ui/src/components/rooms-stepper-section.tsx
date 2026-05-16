"use client"

import { useQueries } from "@tanstack/react-query"
import { useSlotUnitAvailability } from "@voyantjs/availability-react"
import {
  getOptionUnitsQueryOptions,
  type OptionUnitRecord,
  type ProductOptionRecord,
  useProductOptions,
  useVoyantProductsContext,
} from "@voyantjs/products-react"
import { Button, Label } from "@voyantjs/ui/components"
import { Minus, Plus } from "lucide-react"
import * as React from "react"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

/** Quantity per option_unit id; omitted ids are treated as 0. */
export interface RoomsStepperValue {
  quantities: Record<string, number>
}

export const emptyRoomsStepperValue: RoomsStepperValue = { quantities: {} }

export interface RoomsStepperUnit {
  optionId: string | null
  optionUnitId: string
  unitName: string
  occupancyMax: number | null
  initial: number | null
  reserved: number
  remaining: number | null
}

export interface RoomsStepperSectionProps {
  value: RoomsStepperValue
  onChange: (value: RoomsStepperValue) => void
  /** Product whose options become selectable room quantity rows. */
  productId?: string
  /**
   * Departure the operator picked. Departure-specific availability wins
   * when present; otherwise the section falls back to option-level units.
   */
  slotId?: string
  /**
   * Product option whose units should be shown before a departure is picked.
   * Departure-specific availability wins when `slotId` is present.
   */
  optionId?: string | null
  enabled?: boolean
  onUnitsChange?: (units: RoomsStepperUnit[]) => void
  labels?: {
    heading?: string
    noOption?: string
    noSlot?: string
    noUnits?: string
    remaining?: string
    unlimited?: string
  }
}

/**
 * Rooms / per-unit stepper for booking-create flows. Drives
 * `GET /v1/availability/slots/:id/unit-availability` from #235 when a
 * departure is selected, and product option-level units before departure
 * selection, so operators can build "2 double rooms and 1 single" drafts.
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
  productId,
  slotId,
  optionId,
  enabled = true,
  onUnitsChange,
  labels,
}: RoomsStepperSectionProps) {
  const productsClient = useVoyantProductsContext()
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.roomsStepperSection.labels, ...labels }
  const availability = useSlotUnitAvailability({ slotId, enabled: enabled && Boolean(slotId) })

  const optionsQuery = useProductOptions({
    productId,
    status: "active",
    limit: 100,
    enabled: enabled && !slotId && Boolean(productId),
  })
  const productOptions = React.useMemo(() => {
    const options = optionsQuery.data?.data ?? []
    if (!optionId) return options
    const selected = options.find((option) => option.id === optionId)
    const rest = options.filter((option) => option.id !== optionId)
    return selected ? [selected, ...rest] : options
  }, [optionsQuery.data?.data, optionId])
  const optionUnitQueries = useQueries({
    queries: productOptions.map((option) => ({
      ...getOptionUnitsQueryOptions(productsClient, {
        optionId: option.id,
        limit: 100,
      }),
      enabled: enabled && !slotId && Boolean(productId),
    })),
  })
  const optionUnitRows = React.useMemo(() => {
    const rows: RoomsStepperUnit[] = []
    productOptions.forEach((option, index) => {
      const units = optionUnitQueries[index]?.data?.data ?? []
      rows.push(...units.map((unit) => optionUnitToStepperUnit(option, unit, units.length)))
    })
    return rows
  }, [productOptions, optionUnitQueries])
  const availabilityUnitRows = React.useMemo(
    () =>
      (availability.data?.data ?? []).map((unit) => ({
        ...unit,
        optionId: optionId ?? null,
      })),
    [availability.data?.data, optionId],
  )
  const units = slotId ? availabilityUnitRows : optionUnitRows

  React.useEffect(() => {
    onUnitsChange?.(units)
  }, [onUnitsChange, units])

  if (!slotId && !productId && !optionId) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Label>{merged.heading}</Label>
        <p className="text-xs text-muted-foreground">{merged.noOption}</p>
      </div>
    )
  }

  const loaded = slotId
    ? availability.isSuccess
    : optionsQuery.isSuccess && optionUnitQueries.every((query) => query.isSuccess)
  if (loaded && units.length === 0) {
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
                  aria-label={`${merged.decreaseUnitPrefix} ${unit.unitName}`}
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
                  aria-label={`${merged.increaseUnitPrefix} ${unit.unitName}`}
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

function optionUnitToStepperUnit(
  option: ProductOptionRecord,
  unit: OptionUnitRecord,
  unitCount: number,
): RoomsStepperUnit {
  return {
    optionId: option.id,
    optionUnitId: unit.id,
    unitName: unitCount === 1 ? option.name : `${option.name} - ${unit.name}`,
    occupancyMax: unit.occupancyMax,
    initial: null,
    reserved: 0,
    remaining: unit.maxQuantity ?? null,
  }
}
