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
import { useEffect, useRef, useState } from "react"

export interface AsyncComboboxOption {
  value: string
  label: string
}

export interface AsyncComboboxProps {
  value: string | null | undefined
  onChange: (value: string | null) => void
  /** Resolve options for a query (debounced). */
  search: (query: string) => Promise<AsyncComboboxOption[]>
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

/**
 * A generic search-as-you-type combobox backed by an async resolver. Keeps a
 * label cache so a previously-selected value still renders a friendly label
 * (falls back to the raw value when unknown). Used for picking departures /
 * products / bookings by search rather than typing a raw id.
 */
export function AsyncCombobox({
  value,
  onChange,
  search,
  placeholder = "Search…",
  emptyText = "No results.",
  disabled,
  className,
}: AsyncComboboxProps) {
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<AsyncComboboxOption[]>([])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [inputValue, setInputValue] = useState("")

  // Latest search fn via ref so the debounce effect only re-runs on query.
  const searchRef = useRef(search)
  searchRef.current = search

  useEffect(() => {
    let active = true
    const handle = setTimeout(() => {
      searchRef
        .current(query)
        .then((results) => {
          if (!active) return
          setOptions(results)
          setLabels((prev) => {
            const next = { ...prev }
            for (const o of results) next[o.value] = o.label
            return next
          })
        })
        .catch(() => {
          if (active) setOptions([])
        })
    }, 200)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [query])

  // Reflect the selected value's label (or raw id) in the input.
  useEffect(() => {
    setInputValue(value ? (labels[value] ?? value) : "")
  }, [value, labels])

  return (
    <Combobox
      items={options.map((o) => o.value)}
      value={value ?? null}
      inputValue={inputValue}
      autoHighlight
      disabled={disabled}
      itemToStringValue={(v) => labels[v as string] ?? (v as string)}
      onInputValueChange={(next) => {
        setInputValue(next)
        setQuery(next)
        if (!next) onChange(null)
      }}
      onValueChange={(next) => {
        const v = (next as string | null) ?? null
        onChange(v)
        setInputValue(v ? (labels[v] ?? v) : "")
      }}
    >
      <ComboboxInput
        className={className ?? "w-full"}
        placeholder={placeholder}
        disabled={disabled}
        showClear={Boolean(value) && !disabled}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(v) => {
              const label = labels[v as string] ?? (v as string)
              return (
                <ComboboxItem key={v as string} value={v as string}>
                  <span className="truncate">{label}</span>
                </ComboboxItem>
              )
            }}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
