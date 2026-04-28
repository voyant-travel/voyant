"use client"

import { currencies } from "@voyantjs/utils/currencies"
import * as React from "react"

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./combobox"

type CurrencyRecord = (typeof currencies)[keyof typeof currencies]
type CurrencyCode = keyof typeof currencies

const ALL_CURRENCIES: CurrencyRecord[] = Object.values(currencies)

function triggerLabel(record: CurrencyRecord | undefined): string {
  if (!record) return ""
  return `${record.code} (${record.symbol})`
}

function matchesSearch(record: CurrencyRecord, q: string): boolean {
  const needle = q.toLowerCase()
  return (
    record.code.toLowerCase().includes(needle) ||
    record.name.toLowerCase().includes(needle) ||
    record.symbol.toLowerCase().includes(needle)
  )
}

export interface CurrencyComboboxProps {
  value: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Currency picker backed by the canonical `currencies` list from
 * `@voyantjs/utils`. Trigger displays `CODE (symbol)`; items display
 * `CODE — Name (symbol)`. Searchable across code, name, and symbol.
 */
export function CurrencyCombobox({
  value,
  onChange,
  placeholder = "Select currency…",
  disabled,
  className,
}: CurrencyComboboxProps) {
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = search.trim()
    if (!q) return ALL_CURRENCIES
    return ALL_CURRENCIES.filter((c) => matchesSearch(c, q))
  }, [search])

  const selected = value ? currencies[value as CurrencyCode] : undefined
  const selectedLabel = triggerLabel(selected)
  const [inputValue, setInputValue] = React.useState(selectedLabel)

  // Keep the input in sync when the selected value changes from the outside.
  React.useEffect(() => {
    setInputValue(selectedLabel)
  }, [selectedLabel])

  return (
    <Combobox
      items={filtered.map((c) => c.code)}
      value={value ?? null}
      inputValue={inputValue}
      autoHighlight
      disabled={disabled}
      itemToStringValue={(code) => triggerLabel(currencies[code as CurrencyCode])}
      onInputValueChange={(next) => {
        setInputValue(next)
        setSearch(next)
        if (!next) onChange(null)
      }}
      onValueChange={(next) => {
        const code = (next as string | null) ?? null
        onChange(code)
        setInputValue(code ? triggerLabel(currencies[code as CurrencyCode]) : "")
      }}
    >
      <ComboboxInput
        className={className ?? "w-full"}
        placeholder={placeholder}
        showClear={Boolean(value)}
      />
      <ComboboxContent>
        <ComboboxEmpty>No currencies found.</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(code) => {
              const record = currencies[code as CurrencyCode]
              if (!record) return null
              return (
                <ComboboxItem key={record.code} value={record.code}>
                  <span className="truncate">
                    <span className="font-medium">{record.code}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {record.name} ({record.symbol})
                    </span>
                  </span>
                </ComboboxItem>
              )
            }}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
