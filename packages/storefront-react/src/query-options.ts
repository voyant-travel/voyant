"use client"

import { queryOptions } from "@tanstack/react-query"

import type { FetchWithValidationOptions } from "./client.js"
import {
  getAdminStorefrontSettings,
  getStorefrontDeparture,
  getStorefrontDepartureItinerary,
  getStorefrontOfferBySlug,
  getStorefrontSettings,
  listStorefrontMarkets,
  listStorefrontProductDepartures,
  listStorefrontProductExtensions,
  listStorefrontProductOffers,
} from "./operations.js"
import {
  type StorefrontDepartureFilters,
  type StorefrontDepartureItineraryFilters,
  type StorefrontExtensionsFilters,
  type StorefrontOfferFilters,
  storefrontQueryKeys,
} from "./query-keys.js"

export function getStorefrontSettingsQueryOptions(client: FetchWithValidationOptions) {
  return queryOptions({
    queryKey: storefrontQueryKeys.settings(),
    queryFn: () => getStorefrontSettings(client),
  })
}

export function getStorefrontMarketsQueryOptions(client: FetchWithValidationOptions) {
  return queryOptions({
    queryKey: storefrontQueryKeys.markets(),
    queryFn: () => listStorefrontMarkets(client),
    // Markets change rarely and the endpoint is edge-cached (s-maxage=300);
    // hold results for five minutes to avoid re-fetching on every mount.
    staleTime: 5 * 60_000,
  })
}

export function getAdminStorefrontSettingsQueryOptions(client: FetchWithValidationOptions) {
  return queryOptions({
    queryKey: storefrontQueryKeys.adminSettings(),
    queryFn: () => getAdminStorefrontSettings(client),
  })
}

export function getStorefrontDepartureQueryOptions(
  client: FetchWithValidationOptions,
  departureId: string,
) {
  return queryOptions({
    queryKey: storefrontQueryKeys.departure(departureId),
    queryFn: () => getStorefrontDeparture(client, departureId),
  })
}

export function getStorefrontProductDeparturesQueryOptions(
  client: FetchWithValidationOptions,
  productId: string,
  filters: StorefrontDepartureFilters = {},
) {
  return queryOptions({
    queryKey: storefrontQueryKeys.productDepartures(productId, filters),
    queryFn: () => listStorefrontProductDepartures(client, productId, filters),
  })
}

export function getStorefrontDepartureItineraryQueryOptions(
  client: FetchWithValidationOptions,
  productId: string,
  departureId: string,
  filters: StorefrontDepartureItineraryFilters = {},
) {
  return queryOptions({
    queryKey: storefrontQueryKeys.departureItinerary(productId, departureId, filters),
    queryFn: () => getStorefrontDepartureItinerary(client, productId, departureId, filters),
  })
}

export function getStorefrontProductExtensionsQueryOptions(
  client: FetchWithValidationOptions,
  productId: string,
  filters: StorefrontExtensionsFilters = {},
) {
  return queryOptions({
    queryKey: storefrontQueryKeys.productExtensions(productId, filters),
    queryFn: () => listStorefrontProductExtensions(client, productId, filters),
  })
}

export function getStorefrontProductOffersQueryOptions(
  client: FetchWithValidationOptions,
  productId: string,
  filters: StorefrontOfferFilters = {},
) {
  return queryOptions({
    queryKey: storefrontQueryKeys.productOffers(productId, filters),
    queryFn: () => listStorefrontProductOffers(client, productId, filters),
  })
}

export function getStorefrontOfferQueryOptions(
  client: FetchWithValidationOptions,
  slug: string,
  locale?: string,
) {
  return queryOptions({
    queryKey: storefrontQueryKeys.offer(slug, locale),
    queryFn: () => getStorefrontOfferBySlug(client, slug, locale ? { locale } : undefined),
  })
}

export type {
  StorefrontDepartureFilters,
  StorefrontExtensionsFilters,
  StorefrontOfferFilters,
} from "./query-keys.js"
