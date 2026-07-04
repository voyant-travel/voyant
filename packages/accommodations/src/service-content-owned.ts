import type { ContentLocaleMatchKind } from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  facilities,
  facilityAddressProjections,
  facilityFeatures,
  properties,
} from "@voyant-travel/operations"
import { and, asc, eq, inArray } from "drizzle-orm"
import {
  type AccommodationContent,
  accommodationContentSchema,
  type BoardBasis,
  validateAccommodationContent,
} from "./content-shape.js"
import { isCustomerRoomTypeBookable } from "./customer-bookability.js"
import {
  mealPlans,
  ratePlanRoomTypes,
  ratePlans,
  roomTypeBedConfigs,
  roomTypes,
} from "./schema-inventory.js"

export interface BuildOwnedAccommodationContentOptions {
  preferredLocales: ReadonlyArray<string>
}

export interface BuildOwnedAccommodationContentResult {
  content: AccommodationContent
  servedLocale: string
  matchKind: ContentLocaleMatchKind
}

export async function buildOwnedAccommodationContent(
  db: AnyDrizzleDb,
  entityId: string,
  options: BuildOwnedAccommodationContentOptions,
): Promise<BuildOwnedAccommodationContentResult | null> {
  // biome-ignore lint/suspicious/noExplicitAny: AnyDrizzleDb widens drizzle's row inference. -- owner: accommodations; existing suppression is intentional pending typed cleanup.
  const roomRow: any = (
    await db.select().from(roomTypes).where(eq(roomTypes.id, entityId)).limit(1)
  )[0]
  if (!roomRow) return null
  if (!(await isCustomerRoomTypeBookable(db, roomRow))) return null

  // biome-ignore lint/suspicious/noExplicitAny: AnyDrizzleDb widens drizzle's row inference. -- owner: accommodations; existing suppression is intentional pending typed cleanup.
  const propertyRow: any = (
    await db.select().from(properties).where(eq(properties.id, roomRow.propertyId)).limit(1)
  )[0]
  if (!propertyRow) return null

  const ownedRows = await Promise.all([
    db.select().from(facilities).where(eq(facilities.id, propertyRow.facilityId)).limit(1),
    db
      .select()
      .from(facilityAddressProjections)
      .where(eq(facilityAddressProjections.facilityId, propertyRow.facilityId))
      .limit(1),
    db
      .select()
      .from(facilityFeatures)
      .where(eq(facilityFeatures.facilityId, propertyRow.facilityId))
      .orderBy(asc(facilityFeatures.sortOrder), asc(facilityFeatures.name)),
    db
      .select()
      .from(roomTypes)
      .where(and(eq(roomTypes.propertyId, propertyRow.id), eq(roomTypes.active, true)))
      .orderBy(asc(roomTypes.sortOrder), asc(roomTypes.name)),
    db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.propertyId, propertyRow.id), eq(mealPlans.active, true)))
      .orderBy(asc(mealPlans.sortOrder), asc(mealPlans.name)),
    db
      .select()
      .from(ratePlans)
      .where(and(eq(ratePlans.propertyId, propertyRow.id), eq(ratePlans.active, true)))
      .orderBy(asc(ratePlans.sortOrder), asc(ratePlans.name)),
  ])
  const facilityRows = ownedRows[0] as Array<typeof facilities.$inferSelect>
  const addressRows = ownedRows[1] as Array<typeof facilityAddressProjections.$inferSelect>
  const featureRows = ownedRows[2] as Array<typeof facilityFeatures.$inferSelect>
  const roomRows = ownedRows[3] as Array<typeof roomTypes.$inferSelect>
  const mealPlanRows = ownedRows[4] as Array<typeof mealPlans.$inferSelect>
  const ratePlanRows = ownedRows[5] as Array<typeof ratePlans.$inferSelect>

  const roomIds = roomRows.map((row: typeof roomTypes.$inferSelect) => row.id)
  const ratePlanIds = ratePlanRows.map((row: typeof ratePlans.$inferSelect) => row.id)
  const [bedRows, ratePlanRoomRows] = await Promise.all([
    roomIds.length > 0
      ? db
          .select()
          .from(roomTypeBedConfigs)
          .where(inArray(roomTypeBedConfigs.roomTypeId, roomIds))
          .orderBy(asc(roomTypeBedConfigs.isPrimary), asc(roomTypeBedConfigs.createdAt))
      : [],
    ratePlanIds.length > 0
      ? db
          .select()
          .from(ratePlanRoomTypes)
          .where(
            and(
              inArray(ratePlanRoomTypes.ratePlanId, ratePlanIds),
              eq(ratePlanRoomTypes.active, true),
            ),
          )
          .orderBy(asc(ratePlanRoomTypes.sortOrder), asc(ratePlanRoomTypes.createdAt))
      : [],
  ])

  const facilityRow = facilityRows[0] ?? null
  const addressRow = addressRows[0] ?? null
  const content = accommodationContentSchema.parse({
    hotel: {
      id: propertyRow.id,
      name: facilityRow?.name ?? roomRow.name,
      description: facilityRow?.description ?? roomRow.description ?? null,
      star_rating: normalizeStarRating(propertyRow.rating, propertyRow.ratingScale),
      hero_image_url: firstStringFromMetadata(roomRow.metadata, "images"),
      highlights: featureRows
        .filter((feature: typeof facilityFeatures.$inferSelect) => feature.highlighted)
        .map((feature: typeof facilityFeatures.$inferSelect) => feature.name),
      brand: propertyRow.brandName ?? propertyRow.groupName ?? null,
      country: addressRow?.country ?? null,
      city: addressRow?.city ?? null,
      address: addressRow?.fullText ?? addressRow?.address ?? addressRow?.line1 ?? null,
      postal_code: addressRow?.postalCode ?? null,
      latitude: addressRow?.latitude ?? null,
      longitude: addressRow?.longitude ?? null,
      check_in_time: propertyRow.checkInTime ?? null,
      check_out_time: propertyRow.checkOutTime ?? null,
    },
    room_types: roomRows.map((room: typeof roomTypes.$inferSelect) =>
      ownedRoomTypeToContent(room, bedRows),
    ),
    rate_plans: ratePlanRows.map((plan: typeof ratePlans.$inferSelect) =>
      ownedRatePlanToContent(plan, ratePlanRoomRows),
    ),
    meal_plans: mealPlanRows.map((plan: typeof mealPlans.$inferSelect) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description ?? null,
      basis: mealPlanBasis(plan),
      inclusions: mealPlanInclusions(plan),
    })),
    amenities: featureRows
      .filter((feature: typeof facilityFeatures.$inferSelect) => feature.category === "amenity")
      .map((feature: typeof facilityFeatures.$inferSelect) => ({
        id: feature.code ?? feature.id,
        category: feature.category,
        name: feature.name,
        description: feature.description ?? feature.valueText ?? null,
        is_free: undefined,
      })),
    policies: propertyRow.policyNotes
      ? [{ kind: "supplier_notes" as const, body: propertyRow.policyNotes }]
      : [],
  })

  const validation = validateAccommodationContent(content)
  if (!validation.valid) {
    throw new Error(
      `owned accommodation ${entityId} projection failed validation: ${validation.reason}`,
    )
  }

  return {
    content,
    servedLocale: options.preferredLocales[0] ?? "en-GB",
    matchKind: options.preferredLocales.length > 0 ? "exact" : "any",
  }
}

function ownedRoomTypeToContent(
  room: typeof roomTypes.$inferSelect,
  bedRows: ReadonlyArray<typeof roomTypeBedConfigs.$inferSelect>,
): AccommodationContent["room_types"][number] {
  const roomBeds = bedRows.filter((bed) => bed.roomTypeId === room.id)
  return {
    id: room.id,
    code: room.code ?? null,
    name: room.name,
    description: room.description ?? null,
    room_class: room.roomClass ?? null,
    view: stringFromMetadata(room.metadata, "view"),
    bedrooms: room.bedroomCount ?? null,
    beds: roomBeds.map((bed) =>
      bed.quantity > 1 ? `${bed.quantity} ${bed.bedType}` : bed.bedType,
    ),
    size_sqm: room.areaUnit === "sqm" ? room.areaValue : null,
    max_adults: room.maxAdults ?? null,
    max_children: room.maxChildren ?? null,
    max_occupancy: room.maxOccupancy ?? room.standardOccupancy ?? null,
    amenities: stringArrayFromMetadata(room.metadata, "amenities"),
    images: stringArrayFromMetadata(room.metadata, "images"),
  }
}

function ownedRatePlanToContent(
  plan: typeof ratePlans.$inferSelect,
  ratePlanRoomRows: ReadonlyArray<typeof ratePlanRoomTypes.$inferSelect>,
): AccommodationContent["rate_plans"][number] {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description ?? null,
    charge_frequency: contentChargeFrequency(plan.chargeFrequency),
    applies_to_room_type_ids: ratePlanRoomRows
      .filter((row) => row.ratePlanId === plan.id)
      .map((row) => row.roomTypeId),
    cancellation_policy: plan.cancellationPolicyId ?? null,
    inclusions: [],
  }
}

function contentChargeFrequency(
  value: typeof ratePlans.$inferSelect.chargeFrequency,
): "per_night" | "per_stay" {
  return value === "per_stay" || value === "per_person_per_stay" ? "per_stay" : "per_night"
}

function mealPlanBasis(plan: typeof mealPlans.$inferSelect): BoardBasis {
  if (plan.includesBreakfast && plan.includesLunch && plan.includesDinner && plan.includesDrinks) {
    return "all_inclusive"
  }
  if (plan.includesBreakfast && plan.includesLunch && plan.includesDinner) return "full_board"
  if (plan.includesBreakfast && plan.includesDinner) return "half_board"
  if (plan.includesBreakfast) return "bed_breakfast"
  return "room_only"
}

function mealPlanInclusions(plan: typeof mealPlans.$inferSelect): string[] {
  const inclusions: string[] = []
  if (plan.includesBreakfast) inclusions.push("Breakfast")
  if (plan.includesLunch) inclusions.push("Lunch")
  if (plan.includesDinner) inclusions.push("Dinner")
  if (plan.includesDrinks) inclusions.push("Drinks")
  return inclusions
}

function normalizeStarRating(value: unknown, scale: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (typeof scale === "number" && Number.isFinite(scale) && scale > 0 && scale !== 5) {
    return Math.max(0, Math.min(5, (value / scale) * 5))
  }
  return Math.max(0, Math.min(5, value))
}

function firstStringFromMetadata(metadata: unknown, key: string): string | null {
  return stringArrayFromMetadata(metadata, key)[0] ?? null
}

function stringArrayFromMetadata(metadata: unknown, key: string): string[] {
  if (!metadata || typeof metadata !== "object") return []
  const value = (metadata as Record<string, unknown>)[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function stringFromMetadata(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.length > 0 ? value : null
}
