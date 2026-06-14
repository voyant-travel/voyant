/**
 * Catalog plane field policies for cruise cabin/deck facets.
 *
 * Cabin categories and decks are promoted child entities under catalog
 * architecture §6.2: they have an independent query surface and the booking
 * captures the selected cabin category. The root cruise search document also
 * receives denormalized facet arrays so storefront browse can answer
 * "show cruises with balcony cabins", "king bed", or "accessible shower"
 * without traversing the ship graph at read time.
 */

import { defineFieldPolicy, type FieldPolicyInput } from "@voyant-travel/catalog/contract"

const CUSTOMER_FACING = ["staff", "customer", "partner"] as const

const managedFacet = (path: string): FieldPolicyInput => ({
  path,
  class: "structural",
  merge: "source-only",
  drift: "low",
  reindex: "facet-affecting",
  snapshot: "on-book",
  query: "indexed-column",
  localized: false,
  visibility: [...CUSTOMER_FACING],
  editRole: "none",
  overrideFriction: "none",
  sourceFreshness: "sync",
})

const managedIndexed = (path: string): FieldPolicyInput => ({
  ...managedFacet(path),
  class: "managed",
  reindex: "entry",
})

const staffTimestamp = (path: string): FieldPolicyInput => ({
  ...managedFacet(path),
  class: "managed",
  reindex: "none",
  visibility: ["staff"],
  sourceFreshness: "static",
})

const merchandisableText = (path: string): FieldPolicyInput => ({
  path,
  class: "merchandisable",
  merge: "replace",
  drift: "low",
  reindex: "entry-locale",
  snapshot: "on-book",
  query: "indexed-column",
  localized: true,
  visibility: [...CUSTOMER_FACING],
  editRole: "marketing",
  overrideFriction: "none",
  sourceFreshness: "sync",
})

export const CRUISE_CABIN_FACETS_FIELD_POLICY: FieldPolicyInput[] = [
  managedFacet("cabinCategoryIds[]"),
  managedFacet("cabinCategoryCodes[]"),
  managedFacet("cabinGradeCodes[]"),
  managedFacet("cabinRoomTypes[]"),
  managedFacet("cabinFeatureCodes[]"),
  managedFacet("cabinBedConfigurations[]"),
  managedFacet("cabinAccessibilityFeatures[]"),
  managedFacet("cabinViewTypes[]"),
  managedFacet("deckIds[]"),
  managedFacet("deckNames[]"),
  managedFacet("deckLevels[]"),
]

export const CRUISE_CABIN_CATEGORY_FIELD_POLICY: FieldPolicyInput[] = [
  managedIndexed("id"),
  managedFacet("shipId"),
  managedFacet("code"),
  merchandisableText("name"),
  merchandisableText("description"),
  managedFacet("roomType"),
  managedFacet("minOccupancy"),
  managedFacet("maxOccupancy"),
  managedFacet("squareFeet"),
  managedFacet("wheelchairAccessible"),
  managedFacet("featureCodes[]"),
  managedFacet("bedConfigurations[]"),
  managedFacet("accessibilityFeatures[]"),
  managedFacet("viewType"),
  merchandisableText("amenities[]"),
  managedFacet("gradeCodes[]"),
  staffTimestamp("createdAt"),
  staffTimestamp("updatedAt"),
]

export const CRUISE_DECK_FIELD_POLICY: FieldPolicyInput[] = [
  managedIndexed("id"),
  managedFacet("shipId"),
  merchandisableText("name"),
  managedFacet("level"),
  staffTimestamp("createdAt"),
  staffTimestamp("updatedAt"),
]

export const cruiseCabinFacetsCatalogPolicy = defineFieldPolicy(CRUISE_CABIN_FACETS_FIELD_POLICY)
export const cruiseCabinCategoryCatalogPolicy = defineFieldPolicy(
  CRUISE_CABIN_CATEGORY_FIELD_POLICY,
)
export const cruiseDeckCatalogPolicy = defineFieldPolicy(CRUISE_DECK_FIELD_POLICY)
