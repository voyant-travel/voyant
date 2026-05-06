"use client"

import type { FlightOffer } from "@voyantjs/flights/contract/types"
import { Button } from "@voyantjs/ui/components/button"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@voyantjs/ui/components/command"
import { Input } from "@voyantjs/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import { PlusCircle, X } from "lucide-react"
import type { ReactNode } from "react"

import { AirlineLogo } from "./airline-logo.js"

export interface FlightFiltersValue {
  /** Selected carrier IATA codes (empty = no carrier filter). */
  carriers: string[]
  /** Max stops on any single itinerary. `null` = no cap. */
  maxStops: number | null
  /** Inclusive price ceiling (in offer's currency). `null` = no cap. */
  maxPrice: number | null
}

export const EMPTY_FLIGHT_FILTERS: FlightFiltersValue = {
  carriers: [],
  maxStops: null,
  maxPrice: null,
}

export interface FlightFiltersBarProps {
  value: FlightFiltersValue
  onChange: (next: FlightFiltersValue) => void
  /** Live offer set — used to derive carrier facet buckets and the price/stops range. */
  offers: FlightOffer[]
  carrierName?: (iataCode: string) => string | undefined
}

export function FlightFiltersBar({ value, onChange, offers, carrierName }: FlightFiltersBarProps) {
  const carrierBuckets = deriveCarrierBuckets(offers)
  const stopsBuckets = deriveStopsBuckets(offers)
  const hasSelections =
    value.carriers.length > 0 || value.maxStops != null || value.maxPrice != null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CarrierFilter
        buckets={carrierBuckets}
        selected={value.carriers}
        carrierName={carrierName}
        onToggle={(code) =>
          onChange({
            ...value,
            carriers: value.carriers.includes(code)
              ? value.carriers.filter((c) => c !== code)
              : [...value.carriers, code],
          })
        }
        onClear={() => onChange({ ...value, carriers: [] })}
      />

      <StopsFilter
        buckets={stopsBuckets}
        selected={value.maxStops}
        onSelect={(maxStops) => onChange({ ...value, maxStops })}
      />

      <PriceFilter
        value={value.maxPrice}
        onChange={(maxPrice) => onChange({ ...value, maxPrice })}
      />

      {hasSelections && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => onChange(EMPTY_FLIGHT_FILTERS)}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear all
        </Button>
      )}
    </div>
  )
}

/**
 * Shared inline trigger contents for the three filter popovers. Renders
 * inside `<PopoverTrigger render={<Button .../>}>` as the button's
 * children — base-ui merges its onClick / aria-expanded onto the Button
 * directly. (Wrapping these in a separate component breaks the click flow
 * because base-ui's prop-merge can't see through a custom wrapper.)
 */
function TriggerContents({
  label,
  count,
  preview,
}: {
  label: string
  count?: number
  preview?: ReactNode
}) {
  return (
    <>
      <PlusCircle className="h-3.5 w-3.5" />
      <span>{label}</span>
      {preview}
      {count != null && count > 0 && (
        <span className="-mr-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium tabular-nums text-primary-foreground">
          {count}
        </span>
      )}
    </>
  )
}

const TRIGGER_CLASS = "h-8 gap-2 border-dashed"

// ─────────────────────────────────────────────────────────────────────────────
// Carriers
// ─────────────────────────────────────────────────────────────────────────────

interface CarrierBucket {
  iataCode: string
  count: number
}

function CarrierFilter({
  buckets,
  selected,
  carrierName,
  onToggle,
  onClear,
}: {
  buckets: CarrierBucket[]
  selected: string[]
  carrierName?: (iataCode: string) => string | undefined
  onToggle: (iataCode: string) => void
  onClear: () => void
}) {
  if (buckets.length === 0) return null
  const selectedSet = new Set(selected)
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className={TRIGGER_CLASS} />}>
        <TriggerContents label="Airlines" count={selected.length} />
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Filter airlines…" />
          <CommandList>
            <CommandEmpty>No airlines.</CommandEmpty>
            <CommandGroup>
              {buckets.map((b) => {
                const isSelected = selectedSet.has(b.iataCode)
                return (
                  <CommandItem key={b.iataCode} onSelect={() => onToggle(b.iataCode)}>
                    <Checkbox
                      checked={isSelected}
                      tabIndex={-1}
                      aria-hidden
                      className="mr-2 pointer-events-none"
                    />
                    <AirlineLogo
                      iataCode={b.iataCode}
                      name={carrierName?.(b.iataCode)}
                      size={20}
                      className="mr-2"
                    />
                    <span className="flex-1 truncate">
                      {carrierName?.(b.iataCode) ?? b.iataCode}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{b.count}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={onClear}
                    className="justify-center text-center text-muted-foreground"
                  >
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function deriveCarrierBuckets(offers: FlightOffer[]): CarrierBucket[] {
  const counts = new Map<string, number>()
  for (const offer of offers) {
    const carriers = new Set<string>()
    for (const itin of offer.itineraries) {
      for (const seg of itin.segments) {
        carriers.add(seg.carrierCode)
      }
    }
    for (const c of carriers) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([iataCode, count]) => ({ iataCode, count }))
    .sort((a, b) => b.count - a.count)
}

// ─────────────────────────────────────────────────────────────────────────────
// Stops
// ─────────────────────────────────────────────────────────────────────────────

interface StopsBucket {
  stops: number
  count: number
}

function StopsFilter({
  buckets,
  selected,
  onSelect,
}: {
  buckets: StopsBucket[]
  selected: number | null
  onSelect: (maxStops: number | null) => void
}) {
  if (buckets.length === 0) return null
  const preview =
    selected != null ? (
      <span className="text-muted-foreground">
        {selected === 0 ? "· Nonstop" : `· ≤ ${selected}`}
      </span>
    ) : null
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className={TRIGGER_CLASS} />}>
        <TriggerContents label="Stops" preview={preview} />
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {buckets.map((b) => {
                const isSelected = selected === b.stops
                return (
                  <CommandItem key={b.stops} onSelect={() => onSelect(b.stops)}>
                    <Checkbox
                      checked={isSelected}
                      tabIndex={-1}
                      aria-hidden
                      className="mr-2 pointer-events-none"
                    />
                    <span className="flex-1">
                      {b.stops === 0 ? "Nonstop" : `Up to ${b.stops} stop${b.stops > 1 ? "s" : ""}`}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{b.count}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected != null && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onSelect(null)}
                    className="justify-center text-center text-muted-foreground"
                  >
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function deriveStopsBuckets(offers: FlightOffer[]): StopsBucket[] {
  const counts = new Map<number, number>()
  for (const offer of offers) {
    const maxStops = Math.max(0, ...offer.itineraries.map((i) => i.segments.length - 1))
    counts.set(maxStops, (counts.get(maxStops) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([stops, count]) => ({ stops, count }))
    .sort((a, b) => a.stops - b.stops)
}

// ─────────────────────────────────────────────────────────────────────────────
// Price
// ─────────────────────────────────────────────────────────────────────────────

function PriceFilter({
  value,
  onChange,
}: {
  value: number | null
  onChange: (max: number | null) => void
}) {
  const preview = value != null ? <span className="text-muted-foreground">· ≤ {value}</span> : null
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className={TRIGGER_CLASS} />}>
        <TriggerContents label="Price" preview={preview} />
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3" align="start">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Maximum price</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="No cap"
            defaultValue={value ?? ""}
            className="h-8"
            onBlur={(e) => {
              const n = Number(e.target.value)
              onChange(Number.isFinite(n) && n > 0 ? n : null)
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            disabled={value == null}
            className="self-start"
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
