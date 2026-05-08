"use client"

import * as React from "react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./combobox.js"

export interface AsyncComboboxProps<T> {
  /** Currently selected value (id), or null when nothing is selected. */
  value: string | null
  /** Fired when the user picks a different option (or clears it). */
  onChange: (value: string | null) => void
  /** Items currently available to choose from — typically driven by `onSearchChange`. */
  items: readonly T[]
  /** Stable id getter for an item. */
  getKey: (item: T) => string
  /** Display label for an item (used in the list and as the input label of a selected item). */
  getLabel: (item: T) => string
  /** Optional secondary label rendered as muted text inside the row (e.g. SKU). */
  getSecondary?: (item: T) => string | undefined
  /**
   * Optional currently-selected item. Use this when the upstream `items` list is
   * search-filtered and may not contain the picked one — passing it here keeps
   * the input text stable instead of falling back to the raw key.
   */
  selectedItem?: T | null
  /** Called as the user types — wire it to your data fetcher (debouncing is your call). */
  onSearchChange?: (search: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  /** When true, render an "X" clear affordance once a value is selected. */
  clearable?: boolean
}

/**
 * Async-friendly combobox: typeahead that hands the search string back to the
 * caller so they can refetch a remote list. Items the user has seen are cached
 * locally so labels keep resolving even after the upstream list filters them
 * out (typical when typing narrows the search).
 */
export function AsyncCombobox<T>({
  value,
  onChange,
  items,
  getKey,
  getLabel,
  getSecondary,
  selectedItem,
  onSearchChange,
  placeholder,
  emptyText = "No results.",
  disabled,
  className,
  triggerClassName,
  clearable = true,
}: AsyncComboboxProps<T>) {
  // Cache every item we've ever seen so we can resolve a label for the
  // currently-selected key even after the upstream `items` list has filtered
  // it out (e.g. user picked "Eiffel" then started typing "Notre" — items
  // refetched without Eiffel, but we still need its label in the input).
  const cacheRef = React.useRef(new Map<string, T>())
  React.useEffect(() => {
    for (const item of items) cacheRef.current.set(getKey(item), item)
    if (selectedItem) cacheRef.current.set(getKey(selectedItem), selectedItem)
  }, [items, getKey, selectedItem])

  const resolveLabel = React.useCallback(
    (key: string | null | undefined) => {
      if (!key) return ""
      const fromItems = items.find((item) => getKey(item) === key)
      if (fromItems) return getLabel(fromItems)
      if (selectedItem && getKey(selectedItem) === key) return getLabel(selectedItem)
      const cached = cacheRef.current.get(key)
      return cached ? getLabel(cached) : ""
    },
    [items, getKey, getLabel, selectedItem],
  )

  const selectedLabel = resolveLabel(value)

  // The input text mirrors `selectedLabel` whenever a value is set; it's free
  // for typeahead input only when the field is empty.
  const [inputValue, setInputValue] = React.useState(selectedLabel)
  const lastSelectedLabelRef = React.useRef(selectedLabel)
  React.useEffect(() => {
    if (selectedLabel !== lastSelectedLabelRef.current) {
      setInputValue(selectedLabel)
      lastSelectedLabelRef.current = selectedLabel
    }
  }, [selectedLabel])

  const itemKeys = React.useMemo(() => items.map(getKey), [items, getKey])

  // base-ui uses this to:
  //   1. filter the list as the user types
  //   2. populate the input value when the user picks an item
  // Falling back to the cache (or "") avoids the case where it returned the
  // raw key as the input text.
  const itemToStringLabel = React.useCallback(
    (key: unknown) => resolveLabel(typeof key === "string" ? key : null) || (key as string),
    [resolveLabel],
  )

  return (
    <Combobox
      items={itemKeys}
      value={value}
      inputValue={inputValue}
      autoHighlight
      disabled={disabled}
      itemToStringLabel={itemToStringLabel}
      itemToStringValue={(key) => key as string}
      onInputValueChange={(next) => {
        setInputValue(next)
        onSearchChange?.(next)
        if (!next && value) onChange(null)
      }}
      onValueChange={(next) => {
        const key = (next as string | null) ?? null
        onChange(key)
        setInputValue(resolveLabel(key))
      }}
    >
      <ComboboxInput
        placeholder={placeholder}
        showClear={clearable && !!value}
        className={triggerClassName}
      />
      <ComboboxContent className={className}>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {items.map((item) => {
            const key = getKey(item)
            const secondary = getSecondary?.(item)
            return (
              <ComboboxItem key={key} value={key}>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">{getLabel(item)}</span>
                  {secondary && (
                    <span className="shrink-0 text-xs text-muted-foreground">{secondary}</span>
                  )}
                </div>
              </ComboboxItem>
            )
          })}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
