import type {
  StorefrontDepartureListQuery,
  StorefrontProductExtensionsQuery,
  StorefrontPromotionalOfferListQuery,
} from "./schemas.js"

export type StorefrontDepartureFilters = StorefrontDepartureListQuery

export type StorefrontOfferFilters = StorefrontPromotionalOfferListQuery

export type StorefrontExtensionsFilters = StorefrontProductExtensionsQuery

export const storefrontQueryKeys = {
  all: ["voyant", "storefront"] as const,

  settings: () => [...storefrontQueryKeys.all, "settings"] as const,
  adminSettings: () => [...storefrontQueryKeys.all, "admin", "settings"] as const,
  departures: () => [...storefrontQueryKeys.all, "departures"] as const,
  departure: (departureId: string) =>
    [...storefrontQueryKeys.departures(), "detail", departureId] as const,
  productDepartures: (productId: string, filters: StorefrontDepartureFilters) =>
    [...storefrontQueryKeys.departures(), "product-list", productId, filters] as const,
  departureItinerary: (productId: string, departureId: string) =>
    [...storefrontQueryKeys.departure(departureId), "itinerary", productId] as const,
  departurePricePreview: (departureId: string) =>
    [...storefrontQueryKeys.departure(departureId), "price-preview"] as const,

  extensions: () => [...storefrontQueryKeys.all, "extensions"] as const,
  productExtensions: (productId: string, filters: StorefrontExtensionsFilters) =>
    [...storefrontQueryKeys.extensions(), productId, filters] as const,

  offers: () => [...storefrontQueryKeys.all, "offers"] as const,
  productOffers: (productId: string, filters: StorefrontOfferFilters) =>
    [...storefrontQueryKeys.offers(), "product-list", productId, filters] as const,
  offer: (slug: string, locale?: string) =>
    [...storefrontQueryKeys.offers(), "detail", slug, locale ?? null] as const,
} as const
