"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import {
  type CatalogSurface,
  fetchCatalogSlots,
  fetchCruiseContent,
  fetchCruisePrice,
  fetchCruiseSailingPricing,
  fetchDepartureAirports,
  fetchPackageDetail,
  fetchPackageSearch,
  type NightsRange,
} from "../catalog-offers-client.js"
import { useVoyantCatalogContext } from "../provider.js"

interface BaseOfferHookOptions {
  /** `/v1/admin/...` (default) vs `/v1/public/...`. */
  surface?: CatalogSurface
  /** Disable the query (e.g. while inputs are empty). */
  enabled?: boolean
  /** TanStack Query stale time, milliseconds. */
  staleTime?: number
}

/**
 * Departure airports for a destination — probed before a full availability
 * search so the operator can pick where they fly from.
 */
export function useDepartureAirports(options: { countryCode: string } & BaseOfferHookOptions) {
  const { baseUrl, fetcher } = useVoyantCatalogContext()
  const { countryCode, surface = "admin", enabled = true, staleTime = 60_000 } = options
  return useQuery({
    queryKey: ["catalog-departure-airports", surface, countryCode],
    queryFn: ({ signal }) =>
      fetchDepartureAirports({ baseUrl, fetcher, surface }, { countryCode }, signal),
    enabled: enabled && !!countryCode,
    staleTime,
  })
}

/** Dynamic package search by destination/dates/occupancy → live offers. */
export function usePackageSearch(
  options: {
    countryCode: string
    departureDateFrom: string
    departureDateTo: string
    adults: number
    nights: NightsRange
  } & BaseOfferHookOptions,
) {
  const { baseUrl, fetcher } = useVoyantCatalogContext()
  const {
    countryCode,
    departureDateFrom,
    departureDateTo,
    adults,
    nights,
    surface = "admin",
    enabled = true,
    staleTime = 30_000,
  } = options
  return useQuery({
    queryKey: [
      "catalog-package-search",
      surface,
      countryCode,
      departureDateFrom,
      departureDateTo,
      adults,
      nights.min,
      nights.max,
    ],
    queryFn: ({ signal }) =>
      fetchPackageSearch(
        { baseUrl, fetcher, surface },
        { countryCode, departureDateFrom, departureDateTo, adults, nights },
        signal,
      ),
    enabled: enabled && !!countryCode,
    staleTime,
    placeholderData: keepPreviousData,
  })
}

/** Full product detail (source content + live dated offers). */
export function usePackageDetail(
  options: {
    productId: string
    departureDateFrom: string
    departureDateTo: string
    adults: number
    nights: NightsRange
    locale?: string
  } & BaseOfferHookOptions,
) {
  const { baseUrl, fetcher } = useVoyantCatalogContext()
  const {
    productId,
    departureDateFrom,
    departureDateTo,
    adults,
    nights,
    locale,
    surface = "admin",
    enabled = true,
    staleTime = 30_000,
  } = options
  return useQuery({
    queryKey: [
      "catalog-package-detail",
      surface,
      productId,
      departureDateFrom,
      departureDateTo,
      adults,
      nights.min,
      nights.max,
      locale,
    ],
    queryFn: ({ signal }) =>
      fetchPackageDetail(
        { baseUrl, fetcher, surface },
        { productId, departureDateFrom, departureDateTo, adults, nights, locale },
        signal,
      ),
    enabled: enabled && !!productId,
    staleTime,
  })
}

/** Cruise-level "from" price (Connect). */
export function useCruisePrice(options: { cruiseId: string } & BaseOfferHookOptions) {
  const { baseUrl, fetcher } = useVoyantCatalogContext()
  const { cruiseId, surface = "admin", enabled = true, staleTime = 60_000 } = options
  return useQuery({
    queryKey: ["catalog-cruise-price", surface, cruiseId],
    queryFn: ({ signal }) => fetchCruisePrice({ baseUrl, fetcher, surface }, { cruiseId }, signal),
    enabled: enabled && !!cruiseId,
    staleTime,
    retry: false,
  })
}

/** Live per-cabin pricing for one sailing (lazy — enable on row expand). */
export function useCruiseSailingPricing(
  options: { cruiseId: string; sailingRef: string } & BaseOfferHookOptions,
) {
  const { baseUrl, fetcher } = useVoyantCatalogContext()
  const { cruiseId, sailingRef, surface = "admin", enabled = true, staleTime = 0 } = options
  return useQuery({
    queryKey: ["catalog-cruise-sailing-pricing", surface, cruiseId, sailingRef],
    queryFn: ({ signal }) =>
      fetchCruiseSailingPricing({ baseUrl, fetcher, surface }, { cruiseId, sailingRef }, signal),
    enabled: enabled && !!cruiseId && !!sailingRef,
    staleTime,
  })
}

/** Rich cruise content (gallery/sailings/cabins/itinerary) from the source. */
export function useCruiseContent(
  options: { cruiseId: string; locale?: string } & BaseOfferHookOptions,
) {
  const { baseUrl, fetcher } = useVoyantCatalogContext()
  const { cruiseId, locale, surface = "admin", enabled = true, staleTime = 60_000 } = options
  return useQuery({
    queryKey: ["catalog-cruise-content", surface, cruiseId, locale],
    queryFn: ({ signal }) =>
      fetchCruiseContent({ baseUrl, fetcher, surface }, { cruiseId, locale }, signal),
    enabled: enabled && !!cruiseId,
    staleTime,
  })
}

/** Per-departure availability slots for an entity. */
export function useCatalogSlots(
  options: { entityModule: string; entityId: string } & BaseOfferHookOptions,
) {
  const { baseUrl, fetcher } = useVoyantCatalogContext()
  const { entityModule, entityId, surface = "admin", enabled = true, staleTime = 30_000 } = options
  return useQuery({
    queryKey: ["catalog-slots", surface, entityModule, entityId],
    queryFn: ({ signal }) =>
      fetchCatalogSlots({ baseUrl, fetcher, surface }, { entityModule, entityId }, signal),
    enabled: enabled && !!entityId,
    staleTime,
  })
}
