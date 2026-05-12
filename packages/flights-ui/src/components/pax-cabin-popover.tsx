"use client"

import type { CabinClass, PassengerCounts } from "@voyantjs/flights/contract/types"
import { Button } from "@voyantjs/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Minus, Plus, Users } from "lucide-react"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"

export interface PaxCabinPopoverProps {
  passengers: PassengerCounts
  cabin: CabinClass
  onChange: (next: { passengers: PassengerCounts; cabin: CabinClass }) => void
  className?: string
}

const CABIN_LABEL: Record<CabinClass, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business",
  first: "First",
}

/**
 * Compact pax + cabin selector — single trigger button summarizing
 * "2 adults · Economy" that opens a popover with steppers for each pax
 * type and a cabin select. Mirrors the Google Flights / Skyscanner
 * pattern; keeps the search form on one row.
 */
export function PaxCabinPopover({ passengers, cabin, onChange, className }: PaxCabinPopoverProps) {
  useFlightsUiMessagesOrDefault()
  const total = passengers.adults + (passengers.children ?? 0) + (passengers.infants ?? 0)
  const summary = `${total} ${total === 1 ? "passenger" : "passengers"} · ${CABIN_LABEL[cabin]}`

  const setCount = (key: keyof PassengerCounts, value: number) => {
    onChange({
      passengers: {
        ...passengers,
        [key]: Math.max(key === "adults" ? 1 : 0, value),
      },
      cabin,
    })
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="lg" className={className} />}
      >
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{summary}</span>
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="flex flex-col gap-3">
          <PaxStepper
            label="Adults"
            sublabel="12+"
            value={passengers.adults}
            min={1}
            onChange={(v) => setCount("adults", v)}
          />
          <PaxStepper
            label="Children"
            sublabel="2-11"
            value={passengers.children ?? 0}
            min={0}
            onChange={(v) => setCount("children", v)}
          />
          <PaxStepper
            label="Infants"
            sublabel="under 2"
            value={passengers.infants ?? 0}
            min={0}
            onChange={(v) => setCount("infants", v)}
          />
          <div className="mt-1 flex flex-col gap-1.5 border-t pt-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Cabin
            </span>
            <Select
              value={cabin}
              onValueChange={(v: string | null) => {
                if (v) onChange({ passengers, cabin: v as CabinClass })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CABIN_LABEL) as CabinClass[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CABIN_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PaxStepper({
  label,
  sublabel,
  value,
  min,
  onChange,
}: {
  label: string
  sublabel: string
  value: number
  min: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[11px] text-muted-foreground">{sublabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-6 text-center text-sm font-medium tabular-nums">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
