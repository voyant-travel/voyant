"use client"

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import * as React from "react"

const TIMEZONES: readonly string[] = (() => {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[]
  }
  if (typeof intl.supportedValuesOf === "function") {
    try {
      return [...intl.supportedValuesOf("timeZone")].sort()
    } catch {
      // fall through
    }
  }
  return [
    "UTC",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Africa/Lagos",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Mexico_City",
    "America/New_York",
    "America/Sao_Paulo",
    "Asia/Bangkok",
    "Asia/Dubai",
    "Asia/Hong_Kong",
    "Asia/Jakarta",
    "Asia/Kolkata",
    "Asia/Manila",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Europe/Amsterdam",
    "Europe/Berlin",
    "Europe/Bucharest",
    "Europe/Istanbul",
    "Europe/Lisbon",
    "Europe/London",
    "Europe/Madrid",
    "Europe/Moscow",
    "Europe/Paris",
    "Europe/Rome",
    "Europe/Vienna",
    "Pacific/Auckland",
  ]
})()

export interface TimezoneComboboxProps {
  value: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
}

export function TimezoneCombobox({
  value,
  onChange,
  placeholder = "Search timezones…",
  emptyText = "No timezones found.",
  disabled,
}: TimezoneComboboxProps) {
  const [inputValue, setInputValue] = React.useState(value ?? "")
  React.useEffect(() => {
    setInputValue(value ?? "")
  }, [value])

  return (
    <Combobox
      items={TIMEZONES as string[]}
      value={value ?? null}
      inputValue={inputValue}
      autoHighlight
      disabled={disabled}
      itemToStringLabel={(item) => item as string}
      itemToStringValue={(item) => item as string}
      onInputValueChange={(next) => {
        setInputValue(next)
        if (!next) onChange(null)
      }}
      onValueChange={(next) => {
        const tz = (next as string | null) ?? null
        onChange(tz)
        setInputValue(tz ?? "")
      }}
    >
      <ComboboxInput placeholder={placeholder} showClear={Boolean(value)} />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(tz) => (
              <ComboboxItem key={tz as string} value={tz as string}>
                {tz as string}
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
