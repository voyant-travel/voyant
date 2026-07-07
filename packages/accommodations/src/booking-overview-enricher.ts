import type { BookingOverviewEnricherItem } from "@voyant-travel/bookings"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { facilities, facilityAddressProjections, properties } from "@voyant-travel/operations"
import { asc, eq, inArray } from "drizzle-orm"

import { stayBookingItems, stayDailyRates } from "./schema-bookings.js"
import { mealPlans, ratePlans, roomTypes } from "./schema-inventory.js"

/**
 * Postal address for the stay's property, projected from the facility
 * address projection. Any field may be null when the source projection is
 * sparse.
 */
export interface StayBookingOverviewAddress {
  fullText: string | null
  line1: string | null
  line2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
}

/**
 * Guest-facing accommodation recap for a single booking item. Enough to
 * render "Deluxe King, Bed & Breakfast, 2 nights at Acme Grand Hotel,
 * €120/night" on a storefront "manage my booking" / confirmation page.
 */
export interface StayBookingOverviewDetails {
  kind: "accommodation"
  property: {
    id: string
    name: string | null
    checkInTime: string | null
    checkOutTime: string | null
    address: StayBookingOverviewAddress | null
  }
  roomType: { id: string; name: string | null }
  ratePlan: { id: string; name: string | null }
  mealPlan: { id: string; name: string | null } | null
  checkInDate: string
  checkOutDate: string
  nightCount: number
  roomCount: number
  adults: number
  children: number
  infants: number
  confirmationCode: string | null
  voucherCode: string | null
  status: string
  dailyRates: Array<{
    date: string
    sellCurrency: string
    sellAmountCents: number | null
  }>
}

function uniqueDefined(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

/**
 * Public-overview enricher for `accommodation` booking items (issue #2969).
 *
 * Given the core booking items, joins the accommodations stay tables
 * (`stay_booking_items`, `stay_daily_rates`) plus room type / rate plan /
 * meal plan and the property (facility name + address projection) to return
 * a `StayBookingOverviewDetails` per booking item, keyed by the core
 * `booking_items.id`. Wired into `@voyant-travel/bookings` at composition
 * time via `overviewItemEnrichers` so the bookings package never imports
 * accommodations.
 */
export const enrichStayBookingOverviewItems = async (
  db: AnyDrizzleDb,
  items: ReadonlyArray<BookingOverviewEnricherItem>,
): Promise<Map<string, StayBookingOverviewDetails>> => {
  const result = new Map<string, StayBookingOverviewDetails>()

  const bookingItemIds = uniqueDefined(items.map((item) => item.id))
  if (bookingItemIds.length === 0) {
    return result
  }

  const stays = await db
    .select()
    .from(stayBookingItems)
    .where(inArray(stayBookingItems.bookingItemId, bookingItemIds))

  if (stays.length === 0) {
    return result
  }

  const propertyIds = uniqueDefined(stays.map((stay) => stay.propertyId))
  const roomTypeIds = uniqueDefined(stays.map((stay) => stay.roomTypeId))
  const ratePlanIds = uniqueDefined(stays.map((stay) => stay.ratePlanId))
  const mealPlanIds = uniqueDefined(stays.map((stay) => stay.mealPlanId))
  const stayIds = uniqueDefined(stays.map((stay) => stay.id))

  const [propertyRows, roomTypeRows, ratePlanRows, mealPlanRows, dailyRateRows] = await Promise.all(
    [
      propertyIds.length > 0
        ? db
            .select({
              id: properties.id,
              checkInTime: properties.checkInTime,
              checkOutTime: properties.checkOutTime,
              name: facilities.name,
              addressFullText: facilityAddressProjections.fullText,
              addressLine1: facilityAddressProjections.line1,
              addressLine2: facilityAddressProjections.line2,
              city: facilityAddressProjections.city,
              region: facilityAddressProjections.region,
              postalCode: facilityAddressProjections.postalCode,
              country: facilityAddressProjections.country,
            })
            .from(properties)
            .innerJoin(facilities, eq(facilities.id, properties.facilityId))
            .leftJoin(
              facilityAddressProjections,
              eq(facilityAddressProjections.facilityId, properties.facilityId),
            )
            .where(inArray(properties.id, propertyIds))
        : Promise.resolve([]),
      roomTypeIds.length > 0
        ? db
            .select({ id: roomTypes.id, name: roomTypes.name })
            .from(roomTypes)
            .where(inArray(roomTypes.id, roomTypeIds))
        : Promise.resolve([]),
      ratePlanIds.length > 0
        ? db
            .select({ id: ratePlans.id, name: ratePlans.name })
            .from(ratePlans)
            .where(inArray(ratePlans.id, ratePlanIds))
        : Promise.resolve([]),
      mealPlanIds.length > 0
        ? db
            .select({ id: mealPlans.id, name: mealPlans.name })
            .from(mealPlans)
            .where(inArray(mealPlans.id, mealPlanIds))
        : Promise.resolve([]),
      stayIds.length > 0
        ? db
            .select({
              stayBookingItemId: stayDailyRates.stayBookingItemId,
              date: stayDailyRates.date,
              sellCurrency: stayDailyRates.sellCurrency,
              sellAmountCents: stayDailyRates.sellAmountCents,
            })
            .from(stayDailyRates)
            .where(inArray(stayDailyRates.stayBookingItemId, stayIds))
            .orderBy(asc(stayDailyRates.date))
        : Promise.resolve([]),
    ],
  )

  const propertyById = new Map(propertyRows.map((row) => [row.id, row]))
  const roomTypeById = new Map(roomTypeRows.map((row) => [row.id, row]))
  const ratePlanById = new Map(ratePlanRows.map((row) => [row.id, row]))
  const mealPlanById = new Map(mealPlanRows.map((row) => [row.id, row]))

  const dailyRatesByStayId = new Map<
    string,
    Array<{ date: string; sellCurrency: string; sellAmountCents: number | null }>
  >()
  for (const rate of dailyRateRows) {
    const bucket = dailyRatesByStayId.get(rate.stayBookingItemId) ?? []
    bucket.push({
      date: rate.date,
      sellCurrency: rate.sellCurrency,
      sellAmountCents: rate.sellAmountCents ?? null,
    })
    dailyRatesByStayId.set(rate.stayBookingItemId, bucket)
  }

  for (const stay of stays) {
    const property = propertyById.get(stay.propertyId)
    const roomType = roomTypeById.get(stay.roomTypeId)
    const ratePlan = ratePlanById.get(stay.ratePlanId)
    const mealPlan = stay.mealPlanId ? mealPlanById.get(stay.mealPlanId) : undefined

    const hasAddress =
      property != null &&
      (property.addressFullText != null ||
        property.addressLine1 != null ||
        property.city != null ||
        property.country != null)

    result.set(stay.bookingItemId, {
      kind: "accommodation",
      property: {
        id: stay.propertyId,
        name: property?.name ?? null,
        checkInTime: property?.checkInTime ?? null,
        checkOutTime: property?.checkOutTime ?? null,
        address: hasAddress
          ? {
              fullText: property?.addressFullText ?? null,
              line1: property?.addressLine1 ?? null,
              line2: property?.addressLine2 ?? null,
              city: property?.city ?? null,
              region: property?.region ?? null,
              postalCode: property?.postalCode ?? null,
              country: property?.country ?? null,
            }
          : null,
      },
      roomType: { id: stay.roomTypeId, name: roomType?.name ?? null },
      ratePlan: { id: stay.ratePlanId, name: ratePlan?.name ?? null },
      mealPlan: stay.mealPlanId ? { id: stay.mealPlanId, name: mealPlan?.name ?? null } : null,
      checkInDate: stay.checkInDate,
      checkOutDate: stay.checkOutDate,
      nightCount: stay.nightCount,
      roomCount: stay.roomCount,
      adults: stay.adults,
      children: stay.children,
      infants: stay.infants,
      confirmationCode: stay.confirmationCode ?? null,
      voucherCode: stay.voucherCode ?? null,
      status: stay.status,
      dailyRates: dailyRatesByStayId.get(stay.id) ?? [],
    })
  }

  return result
}
