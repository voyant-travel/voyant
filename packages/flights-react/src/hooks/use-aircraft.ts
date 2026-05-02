"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFlightsContext } from "../provider.js"
import { getAircraftQueryOptions } from "../query-options.js"

/**
 * Fetches the aircraft reference list. Mostly used to hydrate the IATA
 * aircraft type code on segments (e.g. `738` → "Boeing 737-800") in the
 * detail sheet.
 */
export function useAircraft(options: { enabled?: boolean } = {}) {
  const client = useVoyantFlightsContext()
  const { enabled = true } = options
  return useQuery({
    ...getAircraftQueryOptions(client),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
