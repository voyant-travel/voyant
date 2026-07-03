/**
 * Owned-cruise content builder.
 *
 * Projects rows authored in the cruises module into the shared
 * `CruiseContent` detail shape used by sourced cruise content, so the public
 * content route can serve owned `cru_*` ids through the same storefront path.
 */

import type { ContentLocaleMatchKind } from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { asc, eq, inArray } from "drizzle-orm"

import { type CruiseContent, cruiseContentSchema, validateCruiseContent } from "./content-shape.js"
import { cruiseCabinCategories, cruiseDecks, cruiseShips } from "./schema-cabins.js"
import { cruiseInclusions, cruiseMedia } from "./schema-content.js"
import { cruiseSailings, cruises } from "./schema-core.js"
import { cruiseDays, cruiseSailingDays } from "./schema-itinerary.js"
import { cruisePrices } from "./schema-pricing.js"

export interface BuildOwnedCruiseContentOptions {
  preferredLocales: ReadonlyArray<string>
}

export interface BuildOwnedCruiseContentResult {
  content: CruiseContent
  servedLocale: string
  matchKind: ContentLocaleMatchKind
}

export async function buildOwnedCruiseContent(
  db: AnyDrizzleDb,
  entityId: string,
  options: BuildOwnedCruiseContentOptions,
): Promise<BuildOwnedCruiseContentResult | null> {
  const cruiseRow = (await db.select().from(cruises).where(eq(cruises.id, entityId)).limit(1))[0]
  if (!cruiseRow) return null

  const [sailingRows, mediaRows, inclusionRows, itineraryRows] = await Promise.all([
    db
      .select()
      .from(cruiseSailings)
      .where(eq(cruiseSailings.cruiseId, entityId))
      .orderBy(asc(cruiseSailings.departureDate), asc(cruiseSailings.id)),
    db
      .select()
      .from(cruiseMedia)
      .where(eq(cruiseMedia.cruiseId, entityId))
      .orderBy(asc(cruiseMedia.sortOrder), asc(cruiseMedia.createdAt)),
    db
      .select()
      .from(cruiseInclusions)
      .where(eq(cruiseInclusions.cruiseId, entityId))
      .orderBy(asc(cruiseInclusions.sortOrder), asc(cruiseInclusions.label)),
    db
      .select()
      .from(cruiseDays)
      .where(eq(cruiseDays.cruiseId, entityId))
      .orderBy(asc(cruiseDays.dayNumber)),
  ])

  const selectedShipId =
    cruiseRow.defaultShipId ?? sailingRows.find((s) => s.shipId)?.shipId ?? null
  const [shipRow, deckRows, cabinRows] = selectedShipId
    ? await Promise.all([
        db.select().from(cruiseShips).where(eq(cruiseShips.id, selectedShipId)).limit(1),
        db
          .select()
          .from(cruiseDecks)
          .where(eq(cruiseDecks.shipId, selectedShipId))
          .orderBy(asc(cruiseDecks.level), asc(cruiseDecks.name)),
        db
          .select()
          .from(cruiseCabinCategories)
          .where(eq(cruiseCabinCategories.shipId, selectedShipId))
          .orderBy(asc(cruiseCabinCategories.code), asc(cruiseCabinCategories.name)),
      ])
    : [[], [], []]

  const sailingIds = sailingRows.map((s) => s.id)
  const [sailingDayRows, priceRows] =
    sailingIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(cruiseSailingDays)
            .where(inArray(cruiseSailingDays.sailingId, sailingIds))
            .orderBy(asc(cruiseSailingDays.sailingId), asc(cruiseSailingDays.dayNumber)),
          db
            .select()
            .from(cruisePrices)
            .where(inArray(cruisePrices.sailingId, sailingIds))
            .orderBy(asc(cruisePrices.sailingId), asc(cruisePrices.pricePerPerson)),
        ])
      : [[], []]

  const coverMedia = mediaRows.find((m) => m.isCover && m.mediaType === "image")
  const firstImage = mediaRows.find((m) => m.mediaType === "image")
  const ship = shipRow[0] ?? null
  const sailingDaysBySailing = groupBy(sailingDayRows, (row) => row.sailingId)
  const pricesBySailing = groupBy(priceRows, (row) => row.sailingId)

  const content: CruiseContent = cruiseContentSchema.parse({
    cruise: {
      id: cruiseRow.id,
      name: cruiseRow.name,
      status: cruiseRow.status,
      description: cruiseRow.shortDescription ?? cruiseRow.description ?? null,
      cruise_type: cruiseRow.cruiseType,
      hero_image_url: coverMedia?.url ?? firstImage?.url ?? cruiseRow.heroImageUrl ?? null,
      highlights: Array.isArray(cruiseRow.highlights) ? cruiseRow.highlights : [],
      cruise_line: cruiseRow.lineSupplierId ?? null,
      duration_nights: cruiseRow.nights,
      embarkation_port: portLabel(
        cruiseRow.embarkPortCanonicalPlaceId,
        cruiseRow.embarkPortFacilityId,
      ),
      disembarkation_port: portLabel(
        cruiseRow.disembarkPortCanonicalPlaceId,
        cruiseRow.disembarkPortFacilityId,
      ),
    },
    ship: ship
      ? {
          id: ship.id,
          name: ship.name,
          ship_type: ship.shipType,
          description: ship.description ?? null,
          deck_plan_url: ship.deckPlanUrl ?? null,
          deck_plans: deckRows.map((deck) => ({
            name: deck.name,
            level: deck.level ?? null,
            image_url: deck.planImageUrl ?? null,
          })),
          capacity: ship.capacityGuests ?? null,
          decks: ship.deckCount ?? null,
          year_built: ship.yearBuilt ?? null,
          gallery: Array.isArray(ship.gallery) ? ship.gallery : [],
        }
      : null,
    sailings: sailingRows.map((sailing) => {
      const lowest = lowestAvailablePrice(pricesBySailing.get(sailing.id) ?? [])
      const itinerary = sailingDaysBySailing.get(sailing.id)
      const stops = itinerary && itinerary.length > 0 ? itinerary : itineraryRows
      return {
        id: sailing.id,
        source_ref: sailing.externalRefs?.externalId ?? null,
        start_date: dateToIso(sailing.departureDate),
        end_date: dateToIso(sailing.returnDate),
        duration_nights: durationNights(sailing.departureDate, sailing.returnDate),
        status: sailing.salesStatus ?? null,
        embarkation_port: portLabel(
          sailing.embarkPortCanonicalPlaceId,
          sailing.embarkPortFacilityId,
        ),
        disembarkation_port: portLabel(
          sailing.disembarkPortCanonicalPlaceId,
          sailing.disembarkPortFacilityId,
        ),
        itinerary_stops: stops.map((stop) =>
          itineraryStopFrom(stop, dateForSailingDay(sailing.departureDate, stop.dayNumber)),
        ),
        lowest_price_cents: lowest?.cents ?? null,
        currency: lowest?.currency ?? null,
      }
    }),
    cabin_categories: cabinRows.map((cat) => ({
      id: cat.id,
      code: cat.code,
      name: cat.name,
      description: cat.description ?? null,
      type: cat.roomType,
      capacity_min: cat.minOccupancy,
      capacity_max: cat.maxOccupancy,
      images: Array.isArray(cat.images) ? cat.images : [],
      floorplan_images: Array.isArray(cat.floorplanImages) ? cat.floorplanImages : [],
      square_feet: cat.squareFeet ?? null,
      grade_codes: Array.isArray(cat.gradeCodes) ? cat.gradeCodes : [],
      wheelchair_accessible: cat.wheelchairAccessible,
      inclusions: Array.isArray(cat.amenities) ? cat.amenities : [],
      feature_codes: Array.isArray(cat.featureCodes) ? cat.featureCodes : [],
      bed_configurations: Array.isArray(cat.bedConfigurations) ? cat.bedConfigurations : [],
      accessibility_features: Array.isArray(cat.accessibilityFeatures)
        ? cat.accessibilityFeatures
        : [],
      view_type: cat.viewType ?? null,
    })),
    itinerary_stops: itineraryRows.map((stop) => itineraryStopFrom(stop)),
    policies: buildPolicies(cruiseRow, sailingRows, cabinRows, inclusionRows),
  })

  const validation = validateCruiseContent(content)
  if (!validation.valid) {
    throw new Error(`owned cruise ${entityId} projection failed validation: ${validation.reason}`)
  }

  return {
    content,
    servedLocale: sourceLocaleFor(),
    matchKind: options.preferredLocales.includes(sourceLocaleFor()) ? "exact" : "any",
  }
}

function itineraryStopFrom(
  stop: typeof cruiseDays.$inferSelect | typeof cruiseSailingDays.$inferSelect,
  date?: string | null,
): CruiseContent["itinerary_stops"][number] {
  return {
    day_number: stop.dayNumber,
    date: date ?? null,
    port_name: stop.title ?? portLabel(stop.portCanonicalPlaceId, stop.portFacilityId) ?? "",
    arrival_time: stop.arrivalTime ?? null,
    departure_time: stop.departureTime ?? null,
    description: stop.description ?? null,
    is_at_sea: stop.isSeaDay ?? false,
  }
}

function buildPolicies(
  cruiseRow: typeof cruises.$inferSelect,
  sailingRows: ReadonlyArray<typeof cruiseSailings.$inferSelect>,
  cabinRows: ReadonlyArray<typeof cruiseCabinCategories.$inferSelect>,
  inclusionRows: ReadonlyArray<typeof cruiseInclusions.$inferSelect>,
): CruiseContent["policies"] {
  const policies: CruiseContent["policies"] = []
  if (cruiseRow.inclusionsHtml) {
    policies.push({ kind: "supplier_notes", body: cruiseRow.inclusionsHtml })
  }
  if (cruiseRow.exclusionsHtml) {
    policies.push({ kind: "supplier_notes", body: cruiseRow.exclusionsHtml })
  }
  for (const inclusion of inclusionRows) {
    policies.push({
      kind: "supplier_notes",
      body: inclusion.description
        ? `${inclusion.label}\n\n${inclusion.description}`
        : inclusion.label,
    })
  }
  addPaymentPolicy(policies, "cruise", cruiseRow.id, cruiseRow.customerPaymentPolicy)
  for (const sailing of sailingRows) {
    addPaymentPolicy(policies, "sailing", sailing.id, sailing.customerPaymentPolicy)
  }
  for (const cabin of cabinRows) {
    addPaymentPolicy(policies, "cabin_category", cabin.id, cabin.customerPaymentPolicy)
  }
  return policies
}

function addPaymentPolicy(
  policies: CruiseContent["policies"],
  scope: string,
  id: string,
  policy: unknown,
): void {
  if (!policy || typeof policy !== "object") return
  policies.push({
    kind: "payment",
    body: `${scope} payment policy`,
    rules: { scope, id, policy },
  })
}

function lowestAvailablePrice(
  rows: ReadonlyArray<typeof cruisePrices.$inferSelect>,
): { cents: number; currency: string } | null {
  let best: { cents: number; currency: string } | null = null
  for (const row of rows) {
    if (row.availability !== "available") continue
    const cents = moneyStringToCents(row.pricePerPerson)
    if (cents === null || !row.currency) continue
    if (!best || cents < best.cents) best = { cents, currency: row.currency }
  }
  return best
}

function moneyStringToCents(value: string | null | undefined): number | null {
  if (!value) return null
  const major = Number.parseFloat(value)
  if (!Number.isFinite(major)) return null
  return Math.round(major * 100)
}

function durationNights(startValue: string | Date, endValue: string | Date): number | null {
  const start = dateOnly(startValue)
  const end = dateOnly(endValue)
  if (!start || !end) return null
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return days >= 0 ? days : null
}

function dateForSailingDay(startValue: string | Date, dayNumber: number): string | null {
  const start = dateOnly(startValue)
  if (!start || dayNumber <= 0) return null
  start.setUTCDate(start.getUTCDate() + dayNumber - 1)
  return start.toISOString().slice(0, 10)
}

function dateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const raw = typeof value === "string" ? value : value.toISOString().slice(0, 10)
  const parsed = new Date(`${raw}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function dateToIso(value: string | Date): string {
  if (typeof value === "string") return value
  return value.toISOString().slice(0, 10)
}

function portLabel(
  canonicalPlaceId: string | null | undefined,
  facilityId: string | null | undefined,
): string | null {
  return canonicalPlaceId ?? facilityId ?? null
}

function sourceLocaleFor(): string {
  return "und"
}

function groupBy<T>(rows: ReadonlyArray<T>, keyFor: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyFor(row)
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(row)
    } else {
      grouped.set(key, [row])
    }
  }
  return grouped
}
