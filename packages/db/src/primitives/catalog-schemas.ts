import { z } from "zod"

import {
  DEPARTURE_STATUSES,
  OWNER_KINDS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  PUBLICATION_ENTITY_TYPES,
  SOURCE_KINDS,
} from "./catalog.js"

// -----------------------------------------------------------------------------
// Enum Schemas
// -----------------------------------------------------------------------------

export const productTypeSchema = z.enum(PRODUCT_TYPES)
export type ProductTypeSchema = z.infer<typeof productTypeSchema>

export const productStatusSchema = z.enum(PRODUCT_STATUSES)
export type ProductStatusSchema = z.infer<typeof productStatusSchema>

export const departureStatusSchema = z.enum(DEPARTURE_STATUSES)
export type DepartureStatusSchema = z.infer<typeof departureStatusSchema>

export const sourceKindSchema = z.enum(SOURCE_KINDS)
export type SourceKindSchema = z.infer<typeof sourceKindSchema>

export const ownerKindSchema = z.enum(OWNER_KINDS)
export type OwnerKindSchema = z.infer<typeof ownerKindSchema>

export const publicationEntityTypeSchema = z.enum(PUBLICATION_ENTITY_TYPES)
export type PublicationEntityTypeSchema = z.infer<typeof publicationEntityTypeSchema>

// -----------------------------------------------------------------------------
// Core Field Schemas (shared between db-main and db-marketplace)
// -----------------------------------------------------------------------------

/**
 * Core product fields schema - shared validation for common product columns.
 * Used by both catalog.products and marketplace.publication_products.
 */
export const productCoreFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(300, "Title must be 300 characters or less"),
  description: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  currency: z.string().length(3, "Currency must be a 3-letter ISO code").nullable().optional(),
  location: z.record(z.string(), z.unknown()).nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  attributes: z.record(z.string(), z.unknown()).optional().default({}),
})

export type ProductCoreFields = z.infer<typeof productCoreFieldsSchema>

/**
 * Timestamp fields schema with optional nullability.
 */
export const timestampsSchema = z.object({
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
})

export const timestampsRequiredSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Timestamps = z.infer<typeof timestampsSchema>
export type TimestampsRequired = z.infer<typeof timestampsRequiredSchema>

/**
 * Core departure fields schema - shared validation for common departure columns.
 * Used by both catalog.departures and marketplace.publication_departures.
 */
export const departureCoreFieldsSchema = z.object({
  startAt: z.date(),
  endAt: z.date().nullable().optional(),
  capacity: z.number().int().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional().default({}),
})

export type DepartureCoreFields = z.infer<typeof departureCoreFieldsSchema>

/**
 * Core itinerary fields schema - shared validation for common itinerary columns.
 * Used by both catalog.itineraries and marketplace.publication_itineraries.
 */
export const itineraryCoreFieldsSchema = z.object({
  name: z.string().min(1, "Name is required"),
})

export type ItineraryCoreFields = z.infer<typeof itineraryCoreFieldsSchema>

/**
 * Core ship fields schema - shared validation for common ship columns.
 * Used by both cruise.ships and marketplace.publication_ships.
 */
export const shipCoreFieldsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  yearBuilt: z.number().int().min(1800).max(2100).nullable().optional(),
  yearRefurbished: z.number().int().min(1800).max(2100).nullable().optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  crewSize: z.number().int().min(1).nullable().optional(),
  amenities: z.any().nullable().optional(),
})

export type ShipCoreFields = z.infer<typeof shipCoreFieldsSchema>
