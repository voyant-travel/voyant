import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { CruiseAdapter, SourceRef } from "./adapters/index.js"
import { cruiseCabinCategories, cruiseDecks, cruiseShips } from "./schema-cabins.js"
import { type Cruise, cruiseSailings, cruises } from "./schema-core.js"
import { cruiseSailingDays } from "./schema-itinerary.js"
import { cruisesService } from "./service.js"

/**
 * One-way conversion of an external cruise into a local cruise.
 *
 * Fetches the cruise + ship + cabin categories + sailings (with itineraries)
 * from the adapter and inserts them as local rows in one transaction. After
 * detach the operator owns the data and can edit it freely; the upstream
 * link is severed (future calls to the original external key still work
 * upstream-side, but the local DB has its own snapshot).
 *
 * Returns the newly-created local cruise row.
 */
export async function detachExternalCruise(
  db: PostgresJsDatabase,
  adapter: CruiseAdapter,
  sourceRef: SourceRef,
  options: { slugSuffix?: string } = {},
): Promise<Cruise> {
  const externalCruise = await adapter.fetchCruise(sourceRef)
  if (!externalCruise) {
    throw new Error(`Adapter '${adapter.name}' returned no cruise for ref ${sourceRef.externalId}`)
  }

  return db.transaction(async (tx) => {
    let localShipId: string | null = null

    // 1. Snapshot ship + decks + cabin categories if the cruise references a ship.
    if (externalCruise.defaultShipRef) {
      const externalShip = await adapter.fetchShip(externalCruise.defaultShipRef)
      if (externalShip) {
        const slug = await ensureUniqueShipSlug(tx, externalShip.slug, options.slugSuffix)
        const [shipRow] = await tx
          .insert(cruiseShips)
          .values({
            slug,
            name: externalShip.name,
            shipType: externalShip.shipType,
            capacityGuests: externalShip.capacityGuests ?? null,
            capacityCrew: externalShip.capacityCrew ?? null,
            cabinCount: externalShip.cabinCount ?? null,
            deckCount: externalShip.deckCount ?? null,
            lengthMeters: externalShip.lengthMeters ?? null,
            cruisingSpeedKnots: externalShip.cruisingSpeedKnots ?? null,
            yearBuilt: externalShip.yearBuilt ?? null,
            yearRefurbished: externalShip.yearRefurbished ?? null,
            imo: externalShip.imo ?? null,
            description: externalShip.description ?? null,
            deckPlanUrl: externalShip.deckPlanUrl ?? null,
            gallery: externalShip.gallery ?? [],
            amenities: (externalShip.amenities ?? {}) as Record<string, unknown>,
            externalRefs: { [adapter.name]: externalShip.sourceRef.externalId },
            isActive: true,
          })
          .returning()
        if (!shipRow) throw new Error("Failed to insert detached ship")
        localShipId = shipRow.id

        if (externalShip.decks) {
          for (const deck of externalShip.decks) {
            await tx.insert(cruiseDecks).values({
              shipId: shipRow.id,
              name: deck.name,
              level: deck.level ?? null,
              planImageUrl: deck.planImageUrl ?? null,
            })
          }
        }

        if (externalShip.categories) {
          for (const cat of externalShip.categories) {
            await tx.insert(cruiseCabinCategories).values({
              shipId: shipRow.id,
              code: cat.code,
              name: cat.name,
              roomType: cat.roomType,
              description: cat.description ?? null,
              minOccupancy: cat.minOccupancy,
              maxOccupancy: cat.maxOccupancy,
              squareFeet: cat.squareFeet ?? null,
              wheelchairAccessible: cat.wheelchairAccessible ?? false,
              amenities: cat.amenities ?? [],
              featureCodes: cat.featureCodes ?? [],
              bedConfigurations: cat.bedConfigurations ?? [],
              accessibilityFeatures: cat.accessibilityFeatures ?? [],
              viewType: cat.viewType ?? null,
              images: cat.images ?? [],
              floorplanImages: cat.floorplanImages ?? [],
              gradeCodes: cat.gradeCodes ?? [],
              externalRefs: { [adapter.name]: cat.sourceRef.externalId },
            })
          }
        }
      }
    }

    // 2. Insert the cruise row.
    const slug = await ensureUniqueCruiseSlug(tx, externalCruise.slug, options.slugSuffix)
    const [cruiseRow] = await tx
      .insert(cruises)
      .values({
        slug,
        name: externalCruise.name,
        cruiseType: externalCruise.cruiseType,
        defaultShipId: localShipId,
        nights: externalCruise.nights,
        embarkPortCanonicalPlaceId: externalCruise.embarkPortCanonicalPlaceId ?? null,
        disembarkPortCanonicalPlaceId: externalCruise.disembarkPortCanonicalPlaceId ?? null,
        description: externalCruise.description ?? null,
        shortDescription: externalCruise.shortDescription ?? null,
        highlights: externalCruise.highlights ?? [],
        inclusionsHtml: externalCruise.inclusionsHtml ?? null,
        exclusionsHtml: externalCruise.exclusionsHtml ?? null,
        regions: externalCruise.regions ?? [],
        themes: externalCruise.themes ?? [],
        heroImageUrl: externalCruise.heroImageUrl ?? null,
        mapImageUrl: externalCruise.mapImageUrl ?? null,
        status: externalCruise.status ?? "draft",
        externalRefs: { [`${adapter.name}-detach-source`]: externalCruise.sourceRef.externalId },
      })
      .returning()
    if (!cruiseRow) throw new Error("Failed to insert detached cruise")

    // 3. Snapshot sailings with their itinerary day overrides. v1 falls back to
    //    the default ship for every sailing when an external sailing references
    //    a different ship — multi-ship sailing detach can be added later.
    if (localShipId) {
      const sailings = await adapter.listSailingsForCruise(externalCruise.sourceRef)
      for (const sailing of sailings) {
        const [sailingRow] = await tx
          .insert(cruiseSailings)
          .values({
            cruiseId: cruiseRow.id,
            shipId: localShipId,
            departureDate: sailing.departureDate,
            returnDate: sailing.returnDate,
            embarkPortFacilityId: null,
            embarkPortCanonicalPlaceId: sailing.embarkPortCanonicalPlaceId ?? null,
            disembarkPortFacilityId: null,
            disembarkPortCanonicalPlaceId: sailing.disembarkPortCanonicalPlaceId ?? null,
            direction: sailing.direction ?? null,
            availabilityNote: sailing.availabilityNote ?? null,
            isCharter: sailing.isCharter ?? false,
            salesStatus: sailing.salesStatus ?? "open",
            externalRefs: { [`${adapter.name}-detach-source`]: sailing.sourceRef.externalId },
            lastSyncedAt: new Date(),
          })
          .returning()
        if (!sailingRow) throw new Error("Failed to insert detached sailing")

        const days = await adapter.fetchSailingItinerary(sailing.sourceRef)
        for (const day of days) {
          await tx.insert(cruiseSailingDays).values({
            sailingId: sailingRow.id,
            dayNumber: day.dayNumber,
            title: day.title ?? null,
            description: day.description ?? null,
            portFacilityId: null,
            portCanonicalPlaceId: day.portCanonicalPlaceId ?? null,
            arrivalTime: day.arrivalTime ?? null,
            departureTime: day.departureTime ?? null,
            isOvernight: day.isOvernight ?? null,
            isSeaDay: day.isSeaDay ?? null,
            isExpeditionLanding: day.isExpeditionLanding ?? null,
            isSkipped: false,
            meals: day.meals ?? null,
          })
        }
      }
    }

    // 4. Recompute aggregates so the new cruise reports correct cached fields.
    await cruisesService.recomputeCruiseAggregates(tx, cruiseRow.id)

    const [refreshed] = await tx.select().from(cruises).where(eq(cruises.id, cruiseRow.id)).limit(1)
    return refreshed ?? cruiseRow
  })
}

async function ensureUniqueCruiseSlug(
  tx: PostgresJsDatabase,
  baseSlug: string,
  suffix?: string,
): Promise<string> {
  const candidate = suffix ? `${baseSlug}-${suffix}` : baseSlug
  const [exists] = await tx
    .select({ id: cruises.id })
    .from(cruises)
    .where(eq(cruises.slug, candidate))
    .limit(1)
  if (!exists) return candidate
  return `${candidate}-${Math.random().toString(36).slice(2, 6)}`
}

async function ensureUniqueShipSlug(
  tx: PostgresJsDatabase,
  baseSlug: string,
  suffix?: string,
): Promise<string> {
  const candidate = suffix ? `${baseSlug}-${suffix}` : baseSlug
  const [exists] = await tx
    .select({ id: cruiseShips.id })
    .from(cruiseShips)
    .where(eq(cruiseShips.slug, candidate))
    .limit(1)
  if (!exists) return candidate
  return `${candidate}-${Math.random().toString(36).slice(2, 6)}`
}
