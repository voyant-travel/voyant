/**
 * Projection extension that joins product → destinations and contributes
 * locale-aware destination fields (regions, countries, cities, slugs, ids)
 * onto the product search document.
 *
 * Wire via `createProductDocumentBuilder({ extensions: [destinationsExtension] })`.
 * Requires the registry to include `productDestinationsCatalogPolicy` —
 * otherwise the contributed fields are silently dropped by the indexer's
 * field-policy filter.
 *
 * Locale handling: `destination_translations` is keyed by `(destination_id,
 * language_tag)`. The projection looks up the slice's locale; missing
 * translations fall back to the destination's canonical `slug`. Operators
 * who want the locale lookup to fall back to a different language (e.g.
 * `fr-CA` → `fr` → `en`) should pre-populate the translation row;
 * multi-tier fallback isn't built into the joins.
 *
 * Today's destinations table has no coordinate columns — geopoints come
 * from `product_locations` and will ship as a separate projection
 * extension once that policy lands.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, eq, inArray } from "drizzle-orm"

import { destinations, destinationTranslations, productDestinations } from "./schema-taxonomy.js"
import type { ProductProjectionExtension } from "./service-catalog-plane.js"

interface DestinationJoinRow {
  destinationId: string
  destinationType: string
  slug: string
  canonicalPlaceId: string | null
  translatedName: string | null
}

async function joinProductDestinations(
  db: AnyDrizzleDb,
  productId: string,
  languageTag: string,
): Promise<DestinationJoinRow[]> {
  // Sub-query the linked destination ids first so the locale lookup is
  // single-shot. Drizzle's join builder doesn't compose left joins on
  // composite predicates cleanly across all dialects, so two queries +
  // an in-memory merge keeps the contract obvious.
  const links = await db
    .select({
      destinationId: productDestinations.destinationId,
      destinationType: destinations.destinationType,
      slug: destinations.slug,
      canonicalPlaceId: destinations.canonicalPlaceId,
      active: destinations.active,
    })
    .from(productDestinations)
    .innerJoin(destinations, eq(productDestinations.destinationId, destinations.id))
    .where(eq(productDestinations.productId, productId))

  const activeLinks = links.filter((row) => row.active)
  if (activeLinks.length === 0) return []

  const destinationIds = activeLinks.map((row) => row.destinationId)
  const translations = await db
    .select({
      destinationId: destinationTranslations.destinationId,
      name: destinationTranslations.name,
    })
    .from(destinationTranslations)
    .where(
      and(
        inArray(destinationTranslations.destinationId, destinationIds),
        eq(destinationTranslations.languageTag, languageTag),
      ),
    )

  const nameByDestinationId = new Map<string, string>()
  for (const row of translations) {
    nameByDestinationId.set(row.destinationId, row.name)
  }

  return activeLinks.map((row) => ({
    destinationId: row.destinationId,
    destinationType: row.destinationType,
    slug: row.slug,
    canonicalPlaceId: row.canonicalPlaceId ?? null,
    translatedName: nameByDestinationId.get(row.destinationId) ?? null,
  }))
}

/** Bucket destinations by `destinationType` and return locale-aware names. */
function bucketByType(rows: ReadonlyArray<DestinationJoinRow>): {
  regions: string[]
  countries: string[]
  cities: string[]
  ports: string[]
  waterways: string[]
  slugs: string[]
  ids: string[]
  canonicalPlaceIds: string[]
} {
  const regions: string[] = []
  const countries: string[] = []
  const cities: string[] = []
  const ports: string[] = []
  const waterways: string[] = []
  const slugs: string[] = []
  const ids: string[] = []
  const canonicalPlaceIds: string[] = []

  for (const row of rows) {
    const label = row.translatedName ?? row.slug
    switch (row.destinationType) {
      case "region":
        regions.push(label)
        break
      case "country":
        countries.push(label)
        break
      case "city":
        cities.push(label)
        break
      case "port":
        ports.push(label)
        break
      case "river":
      case "sea":
      case "ocean":
      case "canal":
      case "lake":
        waterways.push(label)
        break
      // "destination" (the catch-all default) doesn't bucket into any of
      // the typed lists. Its slug + id still land in the doc so storefronts
      // can filter generically.
    }
    slugs.push(row.slug)
    ids.push(row.destinationId)
    if (row.canonicalPlaceId) {
      canonicalPlaceIds.push(row.canonicalPlaceId)
    }
  }

  return { regions, countries, cities, ports, waterways, slugs, ids, canonicalPlaceIds }
}

/**
 * Construct the destinations projection extension.
 *
 * Returns a `ProductProjectionExtension` ready to pass to
 * `createProductDocumentBuilder`.
 */
export function createProductDestinationsProjectionExtension(): ProductProjectionExtension {
  return {
    name: "products:destinations",
    async project(db, productId, slice) {
      const rows = await joinProductDestinations(db, productId, slice.locale)
      if (rows.length === 0) {
        return new Map<string, unknown>([
          ["regions[]", []],
          ["countries[]", []],
          ["cities[]", []],
          ["ports[]", []],
          ["waterways[]", []],
          ["destinationSlugs[]", []],
          ["destinationIds[]", []],
          ["destinationCanonicalPlaceIds[]", []],
        ])
      }

      const { regions, countries, cities, ports, waterways, slugs, ids, canonicalPlaceIds } =
        bucketByType(rows)
      return new Map<string, unknown>([
        ["regions[]", regions],
        ["countries[]", countries],
        ["cities[]", cities],
        ["ports[]", ports],
        ["waterways[]", waterways],
        ["destinationSlugs[]", slugs],
        ["destinationIds[]", ids],
        ["destinationCanonicalPlaceIds[]", canonicalPlaceIds],
      ])
    },
  }
}
