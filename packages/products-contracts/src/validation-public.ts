import { z } from "zod"

import {
  booleanQueryParam,
  destinationTypeSchema,
  languageTagSchema,
  productBookingModeSchema,
  productCapabilitySchema,
  productCapacityModeSchema,
  productFeatureTypeSchema,
  productLocationTypeSchema,
  productMediaTypeSchema,
  productVisibilitySchema,
} from "./validation-shared.js"

export const publicCatalogProductListQuerySchema = z.object({
  search: z.string().optional(),
  languageTag: languageTagSchema.optional(),
  bookingMode: productBookingModeSchema.optional(),
  capacityMode: productCapacityModeSchema.optional(),
  productTypeId: z.string().optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  destinationId: z.string().optional(),
  destinationSlug: z.string().trim().min(1).optional(),
  locationTitle: z.string().trim().min(1).optional(),
  locationCity: z.string().trim().min(1).optional(),
  locationCountryCode: z.string().trim().min(2).max(3).optional(),
  locationType: productLocationTypeSchema.optional(),
  featured: booleanQueryParam.optional(),
  sort: z.enum(["name", "createdAt", "startDate", "price"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
})

export const publicCatalogCategoryListQuerySchema = z.object({
  search: z.string().optional(),
  parentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const publicCatalogTagListQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const publicCatalogDestinationListQuerySchema = z.object({
  search: z.string().optional(),
  parentId: z.string().optional(),
  active: booleanQueryParam.optional(),
  languageTag: languageTagSchema.optional(),
  destinationType: destinationTypeSchema.optional(),
  canonicalPlaceId: z.string().trim().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const publicCatalogProductLookupBySlugQuerySchema = z.object({
  languageTag: languageTagSchema.optional(),
  /**
   * Comma-separated list of extra sections to fold into the detail document.
   * Currently only `itinerary` — the product's default day-by-day plan
   * (issue voyant#2910). Opt-in so callers that don't render it don't pay the
   * join; itinerary and non-itinerary documents cache independently.
   */
  include: z.string().optional(),
})

export const publicCatalogProductCategorySchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
})

export const publicCatalogProductTagSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const publicCatalogProductTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
})

export const publicCatalogProductMediaSchema = z.object({
  id: z.string(),
  mediaType: productMediaTypeSchema,
  name: z.string(),
  url: z.string(),
  mimeType: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  isCover: z.boolean(),
  isOpenGraph: z.boolean(),
  isBrochure: z.boolean(),
  isBrochureCurrent: z.boolean(),
  brochureVersion: z.number().int().nullable(),
})

export const publicCatalogProductFeatureSchema = z.object({
  id: z.string(),
  featureType: productFeatureTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
})

export const publicCatalogProductFaqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  sortOrder: z.number().int(),
})

export const publicCatalogProductLocationSchema = z.object({
  id: z.string(),
  locationType: productLocationTypeSchema,
  title: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  sortOrder: z.number().int(),
})

export const publicCatalogDestinationSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  slug: z.string(),
  canonicalPlaceId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  destinationType: destinationTypeSchema,
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  sortOrder: z.number().int(),
})

export const publicCatalogProductSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  inclusionsHtml: z.string().nullable(),
  exclusionsHtml: z.string().nullable(),
  termsHtml: z.string().nullable(),
  contentLanguageTag: z.string().nullable(),
  slug: z.string().nullable(),
  shortDescription: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  bookingMode: productBookingModeSchema,
  capacityMode: productCapacityModeSchema,
  visibility: productVisibilitySchema,
  sellCurrency: z.string(),
  sellAmountCents: z.number().int().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  pax: z.number().int().nullable(),
  contractTemplateId: z.string().nullable(),
  productType: publicCatalogProductTypeSchema.nullable(),
  categories: z.array(publicCatalogProductCategorySchema),
  tags: z.array(publicCatalogProductTagSchema),
  capabilities: z.array(productCapabilitySchema),
  destinations: z.array(publicCatalogDestinationSchema),
  locations: z.array(publicCatalogProductLocationSchema),
  coverMedia: publicCatalogProductMediaSchema.nullable(),
  isFeatured: z.boolean(),
})

export const publicCatalogItineraryDayServiceSchema = z.object({
  id: z.string(),
  serviceType: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int().nullable(),
})

export const publicCatalogItineraryDaySchema = z.object({
  id: z.string(),
  dayNumber: z.number().int(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  services: z.array(publicCatalogItineraryDayServiceSchema),
})

/**
 * The product's folded default itinerary (issue voyant#2910). Present on the
 * detail document only when requested via `?include=itinerary`; departure
 * overrides stay on the departure itinerary endpoint.
 */
export const publicCatalogItinerarySchema = z.object({
  id: z.string(),
  name: z.string(),
  days: z.array(publicCatalogItineraryDaySchema),
})

export const publicCatalogProductDetailSchema = publicCatalogProductSummarySchema.extend({
  brochure: publicCatalogProductMediaSchema.nullable(),
  openGraphImage: publicCatalogProductMediaSchema.nullable(),
  media: z.array(publicCatalogProductMediaSchema),
  features: z.array(publicCatalogProductFeatureSchema),
  faqs: z.array(publicCatalogProductFaqSchema),
  itinerary: publicCatalogItinerarySchema.nullable().optional(),
})

export const publicCatalogProductListResponseSchema = z.object({
  data: z.array(publicCatalogProductSummarySchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export const publicCatalogCategoryListResponseSchema = z.object({
  data: z.array(publicCatalogProductCategorySchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export const publicCatalogTagListResponseSchema = z.object({
  data: z.array(publicCatalogProductTagSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export const publicCatalogDestinationListResponseSchema = z.object({
  data: z.array(publicCatalogDestinationSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export type PublicCatalogProductListQuery = z.infer<typeof publicCatalogProductListQuerySchema>
export type PublicCatalogCategoryListQuery = z.infer<typeof publicCatalogCategoryListQuerySchema>
export type PublicCatalogTagListQuery = z.infer<typeof publicCatalogTagListQuerySchema>
export type PublicCatalogDestinationListQuery = z.infer<
  typeof publicCatalogDestinationListQuerySchema
>
export type PublicCatalogProductLookupBySlugQuery = z.infer<
  typeof publicCatalogProductLookupBySlugQuerySchema
>
