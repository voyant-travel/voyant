/**
 * Cruise cabin/deck projection extension.
 *
 * Joins a cruise's default ship to cabin categories, specific cabins, and
 * decks, then denormalizes machine-filterable cabin/deck facets onto the
 * cruise search document.
 */

import type { IndexerSlice } from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { asc, eq } from "drizzle-orm"

import { cruiseCabinCategories, cruiseCabins, cruiseDecks } from "./schema-cabins.js"
import { cruises } from "./schema-core.js"
import type { CruiseProjectionExtension } from "./service-catalog-plane.js"

export interface CruiseCabinFacetJoinRow {
  cabinCategoryId: string
  cabinCategoryCode: string
  roomType: string
  featureCodes: string[] | null
  bedConfigurations: string[] | null
  accessibilityFeatures: string[] | null
  viewType: string | null
  gradeCodes: string[] | null
  deckId: string | null
  deckName: string | null
  deckLevel: number | null
}

export function projectCruiseCabinFacetRows(
  rows: ReadonlyArray<CruiseCabinFacetJoinRow>,
): ReadonlyMap<string, unknown> {
  const cabinCategoryIds: string[] = []
  const cabinCategoryCodes: string[] = []
  const cabinGradeCodes: string[] = []
  const cabinRoomTypes: string[] = []
  const cabinFeatureCodes: string[] = []
  const cabinBedConfigurations: string[] = []
  const cabinAccessibilityFeatures: string[] = []
  const cabinViewTypes: string[] = []
  const deckIds: string[] = []
  const deckNames: string[] = []
  const deckLevels: number[] = []

  for (const row of rows) {
    pushUnique(cabinCategoryIds, row.cabinCategoryId)
    pushUnique(cabinCategoryCodes, row.cabinCategoryCode)
    pushUnique(cabinRoomTypes, row.roomType)
    for (const code of row.featureCodes ?? []) pushUnique(cabinFeatureCodes, code)
    for (const bed of row.bedConfigurations ?? []) pushUnique(cabinBedConfigurations, bed)
    for (const feature of row.accessibilityFeatures ?? []) {
      pushUnique(cabinAccessibilityFeatures, feature)
    }
    if (row.viewType) pushUnique(cabinViewTypes, row.viewType)
    for (const grade of row.gradeCodes ?? []) pushUnique(cabinGradeCodes, grade)
    if (row.deckId) pushUnique(deckIds, row.deckId)
    if (row.deckName) pushUnique(deckNames, row.deckName)
    if (row.deckLevel !== null) pushUnique(deckLevels, row.deckLevel)
  }

  return new Map<string, unknown>([
    ["cabinCategoryIds[]", cabinCategoryIds],
    ["cabinCategoryCodes[]", cabinCategoryCodes],
    ["cabinGradeCodes[]", cabinGradeCodes],
    ["cabinRoomTypes[]", cabinRoomTypes],
    ["cabinFeatureCodes[]", cabinFeatureCodes],
    ["cabinBedConfigurations[]", cabinBedConfigurations],
    ["cabinAccessibilityFeatures[]", cabinAccessibilityFeatures],
    ["cabinViewTypes[]", cabinViewTypes],
    ["deckIds[]", deckIds],
    ["deckNames[]", deckNames],
    ["deckLevels[]", deckLevels],
  ])
}

export function createCruiseCabinFacetProjectionExtension(): CruiseProjectionExtension {
  return {
    name: "cruises:cabin-facets",
    async project(db: AnyDrizzleDb, cruiseId: string, _slice: IndexerSlice) {
      const rows = await db
        .select({
          cabinCategoryId: cruiseCabinCategories.id,
          cabinCategoryCode: cruiseCabinCategories.code,
          roomType: cruiseCabinCategories.roomType,
          featureCodes: cruiseCabinCategories.featureCodes,
          bedConfigurations: cruiseCabinCategories.bedConfigurations,
          accessibilityFeatures: cruiseCabinCategories.accessibilityFeatures,
          viewType: cruiseCabinCategories.viewType,
          gradeCodes: cruiseCabinCategories.gradeCodes,
          deckId: cruiseDecks.id,
          deckName: cruiseDecks.name,
          deckLevel: cruiseDecks.level,
        })
        .from(cruises)
        .innerJoin(cruiseCabinCategories, eq(cruiseCabinCategories.shipId, cruises.defaultShipId))
        .leftJoin(cruiseCabins, eq(cruiseCabins.categoryId, cruiseCabinCategories.id))
        .leftJoin(cruiseDecks, eq(cruiseCabins.deckId, cruiseDecks.id))
        .where(eq(cruises.id, cruiseId))
        .orderBy(asc(cruiseCabinCategories.code), asc(cruiseDecks.level), asc(cruiseDecks.name))

      return projectCruiseCabinFacetRows(rows)
    },
  }
}

function pushUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value)
}
