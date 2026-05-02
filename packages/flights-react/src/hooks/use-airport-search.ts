"use client"

import { useEffect, useState } from "react"

import { useAirports } from "./use-airports.js"

export interface UseAirportSearchOptions {
  /** Debounce on keystrokes, milliseconds. Default 200. */
  debounceMs?: number
  /** Maximum results returned by the server. Default 25. */
  limit?: number
  /** Disable network entirely (e.g. while combobox is closed). */
  enabled?: boolean
}

/**
 * Debounced airport-search hook for combobox typeaheads. Tracks the
 * raw input separately from the debounced server query so users can
 * type freely without N round-trips. The query short-circuits when
 * `enabled` is false or the debounced value is empty AND limit isn't
 * set (callers that want a default open list should pass `limit`).
 */
export function useAirportSearch(input: string, options: UseAirportSearchOptions = {}) {
  const { debounceMs = 200, limit = 25, enabled = true } = options
  const [debounced, setDebounced] = useState(input)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), debounceMs)
    return () => clearTimeout(t)
  }, [input, debounceMs])

  return useAirports({
    q: debounced.trim() || undefined,
    limit,
    enabled,
  })
}
