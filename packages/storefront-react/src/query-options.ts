"use client"

import { queryOptions } from "@tanstack/react-query"

import type { FetchWithValidationOptions } from "./client.js"
import {
  getAdminStorefrontSettings,
  getStorefrontDeparture,
  getStorefrontDepartureItinerary,
  getStorefrontOfferBySlug,
  getStorefrontSettings,
  listStorefrontProductDepartures,
  listStorefrontProductExtensions,
  listStorefrontProductOffers,
} from "./operations.js"
import {
  type StorefrontDepartureFilters,
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
) {
  return queryOptions({
    queryKey: storefrontQueryKeys.departureItinerary(productId, departureId),
    queryFn: () => getStorefrontDepartureItinerary(client, productId, departureId),
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
