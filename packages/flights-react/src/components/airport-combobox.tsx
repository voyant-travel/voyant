"use client"

import { Button } from "@voyant-travel/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@voyant-travel/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@voyant-travel/ui/components/popover"
import { cn } from "@voyant-travel/ui/lib/utils"
import { ChevronDown, MapPin } from "lucide-react"
import { useState } from "react"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import { type AirportDto, useAirportSearch } from "../index.js"

export interface AirportComboboxProps {
  /** Selected IATA code, or null when nothing is selected. */
  value: string | null
  onChange: (next: string | null, airport: AirportDto | null) => void
  /** Trigger placeholder when nothing is selected (e.g. "From", "To"). */
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Single-line typeahead airport picker. Trigger reads as one of:
 *   - placeholder (no selection)
 *   - "LHR · London" (selection in current result set)
 *   - "LHR" (selection but airport not in current result page)
 *
 * Backed by `useAirportSearch` (debounced server query).
 */
export function AirportCombobox({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: AirportComboboxProps) {
  const messages = useFlightsUiMessagesOrDefault().airportCombobox
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const search = useAirportSearch(input, { enabled: open, limit: 30 })
  const airports = search.data?.data ?? []
  const selected = value ? airports.find((a) => a.iataCode === value) : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("h-10 justify-between gap-2 px-3", className)}
          />
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          {value ? (
            <span className="truncate text-sm">
              <span className="font-mono font-medium">{value}</span>
              {selected && (
                <span className="ml-1.5 font-normal text-muted-foreground">{selected.city}</span>
              )}
            </span>
          ) : (
            <span className="truncate text-sm text-muted-foreground">
              {placeholder ?? messages.placeholder}
            </span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={input}
            onValueChange={setInput}
            placeholder={messages.searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{search.isLoading ? messages.searching : messages.empty}</CommandEmpty>
            <CommandGroup>
              {airports.map((a) => (
                <CommandItem
                  key={a.iataCode}
                  value={`${a.iataCode} ${a.city} ${a.name}`}
                  onSelect={() => {
                    onChange(a.iataCode, a)
                    setOpen(false)
                    setInput("")
                  }}
                >
                  <span className="mr-2 inline-flex w-10 justify-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium">
                    {a.iataCode}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">{a.city}</span>
                    <span className="truncate text-xs text-muted-foreground">{a.name}</span>
                  </div>
                  <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                    {a.country}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
