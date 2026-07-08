// agent-quality: file-size exception -- owner: accommodations; owned stay quote, batch quote, and search resolution share the same pure resolver helpers and stay co-located until a dedicated service split preserves behavior and tests.
import type { OwnedSearchContext } from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { facilityAddressProjections, properties } from "@voyant-travel/operations"
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm"

import type {
  AccommodationSearchBridge,
  AccommodationSearchBridgeInput,
  AccommodationSearchCriteria,
  AccommodationSearchMatch,
  AccommodationSearchOccupancy,
} from "./booking-engine/search-handler.js"
import { stayBookingItems } from "./schema-bookings.js"
import {
  ratePlanDailyRates,
  ratePlanRoomTypes,
  ratePlans,
  roomTypeDailyInventory,
  roomTypes,
} from "./schema-inventory.js"

export interface OwnedStayOccupancy {
  adults?: number
  children?: number
  infants?: number
}

export interface QuoteOwnedStayInput {
  roomTypeId: string
  ratePlanId: string
  checkIn: string
  checkOut: string
  roomCount?: number
  occupancy?: OwnedStayOccupancy
  occupancies?: ReadonlyArray<OwnedStayOccupancy>
  currency?: string
}

export interface OwnedStayNightlyRate {
  date: string
  sellCurrency: string
  sellAmountCents: number
  costCurrency?: string | null
  costAmountCents?: number | null
  taxAmountCents?: number | null
  feeAmountCents?: number | null
  occupancyBasis: string
  includedAdults: number
  includedChildren: number
  includedInfants: number
  quantity: number
  totalAmountCents: number
}

export interface OwnedStayAvailabilityNight {
  date: string
  capacity: number
  booked: number
  remaining: number
  closed: boolean
}

export type OwnedStayQuoteResult =
  | {
      status: "ok"
      available: boolean
      propertyId: string
      roomTypeId: string
      ratePlanId: string
      mealPlanId?: string | null
      roomCount: number
      nights: number
      currency: string
      nightlyRates: OwnedStayNightlyRate[]
      totalAmountCents: number
      availability: {
        requestedRooms: number
        minimumRemainingRooms: number
        nights: OwnedStayAvailabilityNight[]
      }
    }
  | { status: "invalid_range"; reason: string }
  | { status: "room_not_found" }
  | { status: "rate_plan_not_found" }
  | { status: "room_occupancy_exceeded" }
  | { status: "rates_missing"; missingDates: string[] }
  | { status: "inventory_missing"; missingDates: string[] }
  | { status: "currency_mismatch"; expected: string; actual: string }

export interface OwnedStayRateRecord {
  date: string
  sellCurrency: string
  sellAmountCents: number
  costCurrency?: string | null
  costAmountCents?: number | null
  taxAmountCents?: number | null
  feeAmountCents?: number | null
  occupancyBasis?: string | null
  includedAdults?: number | null
  includedChildren?: number | null
  includedInfants?: number | null
}

export interface OwnedStayInventoryRecord {
  date: string
  capacity: number
  closed?: boolean | null
}

export interface OwnedStayBookingOverlapRecord {
  checkInDate: string
  checkOutDate: string
  roomCount: number
}

export interface ResolveOwnedStayQuoteRecords {
  room: {
    id: string
    propertyId: string
    active: boolean
    maxAdults?: number | null
    maxChildren?: number | null
    maxInfants?: number | null
    maxOccupancy?: number | null
  }
  ratePlan: {
    id: string
    propertyId: string
    active: boolean
    mealPlanId?: string | null
  }
  rates: ReadonlyArray<OwnedStayRateRecord>
  inventory: ReadonlyArray<OwnedStayInventoryRecord>
  overlappingBookings: ReadonlyArray<OwnedStayBookingOverlapRecord>
}

export function resolveOwnedStayQuote(
  input: QuoteOwnedStayInput,
  records: ResolveOwnedStayQuoteRecords,
): OwnedStayQuoteResult {
  const roomCount = input.roomCount ?? 1
  const nights = eachStayNight(input.checkIn, input.checkOut)
  if (roomCount <= 0) return { status: "invalid_range", reason: "room_count_must_be_positive" }
  if (nights.length === 0) return { status: "invalid_range", reason: "check_out_after_check_in" }
  if (!records.room.active || records.room.id !== input.roomTypeId)
    return { status: "room_not_found" }
  if (
    !records.ratePlan.active ||
    records.ratePlan.id !== input.ratePlanId ||
    records.ratePlan.propertyId !== records.room.propertyId
  ) {
    return { status: "rate_plan_not_found" }
  }
  const occupancies = occupanciesForQuote(input)
  if (occupancies?.some((occupancy) => !fitsOccupancy(records.room, occupancy))) {
    return { status: "room_occupancy_exceeded" }
  }

  const ratesByDate = new Map(records.rates.map((rate) => [rate.date, rate]))
  const missingRates = nights.filter((date) => !ratesByDate.has(date))
  if (missingRates.length > 0) return { status: "rates_missing", missingDates: missingRates }

  const inventoryByDate = new Map(records.inventory.map((row) => [row.date, row]))
  const missingInventory = nights.filter((date) => !inventoryByDate.has(date))
  if (missingInventory.length > 0) {
    return { status: "inventory_missing", missingDates: missingInventory }
  }

  const firstCurrency = ratesByDate.get(nights[0] as string)?.sellCurrency
  if (!firstCurrency) return { status: "rates_missing", missingDates: nights }
  if (input.currency && firstCurrency !== input.currency) {
    return { status: "currency_mismatch", expected: input.currency, actual: firstCurrency }
  }
  const mismatchedCurrency = nights
    .map((date) => ratesByDate.get(date))
    .find((rate) => rate && rate.sellCurrency !== firstCurrency)
  if (mismatchedCurrency) {
    return {
      status: "currency_mismatch",
      expected: firstCurrency,
      actual: mismatchedCurrency.sellCurrency,
    }
  }

  const bookedByDate = bookedRoomsByNight(records.overlappingBookings, nights)
  const availabilityNights = nights.map((date) => {
    const inventory = inventoryByDate.get(date)
    const capacity = inventory?.capacity ?? 0
    const booked = bookedByDate.get(date) ?? 0
    const closed = inventory?.closed === true
    return {
      date,
      capacity,
      booked,
      closed,
      remaining: closed ? 0 : Math.max(0, capacity - booked),
    }
  })
  const minimumRemainingRooms = Math.min(...availabilityNights.map((night) => night.remaining))
  const available = minimumRemainingRooms >= roomCount

  let totalAmountCents = 0
  const nightlyRates = nights.map((date) => {
    const rate = ratesByDate.get(date)
    if (!rate) throw new Error(`missing rate for already-validated night ${date}`)
    const quantity = rateQuantity(rate.occupancyBasis, roomCount, occupancies)
    const totalAmount = rate.sellAmountCents * quantity
    totalAmountCents += totalAmount
    return {
      date,
      sellCurrency: rate.sellCurrency,
      sellAmountCents: rate.sellAmountCents,
      costCurrency: rate.costCurrency,
      costAmountCents: rate.costAmountCents,
      taxAmountCents: rate.taxAmountCents,
      feeAmountCents: rate.feeAmountCents,
      occupancyBasis: rate.occupancyBasis ?? "room",
      includedAdults: rate.includedAdults ?? 2,
      includedChildren: rate.includedChildren ?? 0,
      includedInfants: rate.includedInfants ?? 0,
      quantity,
      totalAmountCents: totalAmount,
    }
  })

  return {
    status: "ok",
    available,
    propertyId: records.room.propertyId,
    roomTypeId: input.roomTypeId,
    ratePlanId: input.ratePlanId,
    mealPlanId: records.ratePlan.mealPlanId,
    roomCount,
    nights: nights.length,
    currency: firstCurrency,
    nightlyRates,
    totalAmountCents,
    availability: {
      requestedRooms: roomCount,
      minimumRemainingRooms,
      nights: availabilityNights,
    },
  }
}

export async function quoteOwnedStay(
  db: AnyDrizzleDb,
  input: QuoteOwnedStayInput,
): Promise<OwnedStayQuoteResult> {
  const nights = eachStayNight(input.checkIn, input.checkOut)
  if (nights.length === 0) return { status: "invalid_range", reason: "check_out_after_check_in" }

  const [roomRow, ratePlanRow, rateRows, inventoryRows, overlappingBookings] = await Promise.all([
    db.select().from(roomTypes).where(eq(roomTypes.id, input.roomTypeId)).limit(1),
    db.select().from(ratePlans).where(eq(ratePlans.id, input.ratePlanId)).limit(1),
    db
      .select()
      .from(ratePlanDailyRates)
      .where(
        and(
          eq(ratePlanDailyRates.roomTypeId, input.roomTypeId),
          eq(ratePlanDailyRates.ratePlanId, input.ratePlanId),
          inArray(ratePlanDailyRates.date, nights),
        ),
      ),
    db
      .select()
      .from(roomTypeDailyInventory)
      .where(
        and(
          eq(roomTypeDailyInventory.roomTypeId, input.roomTypeId),
          inArray(roomTypeDailyInventory.date, nights),
        ),
      ),
    db
      .select({
        checkInDate: stayBookingItems.checkInDate,
        checkOutDate: stayBookingItems.checkOutDate,
        roomCount: stayBookingItems.roomCount,
      })
      .from(stayBookingItems)
      .where(
        and(
          eq(stayBookingItems.roomTypeId, input.roomTypeId),
          eq(stayBookingItems.status, "reserved"),
          lt(stayBookingItems.checkInDate, input.checkOut),
          gt(stayBookingItems.checkOutDate, input.checkIn),
        ),
      ),
  ])

  const room = roomRow[0]
  if (!room) return { status: "room_not_found" }
  const ratePlan = ratePlanRow[0]
  if (!ratePlan) return { status: "rate_plan_not_found" }

  return resolveOwnedStayQuote(input, {
    room,
    ratePlan,
    rates: rateRows,
    inventory: inventoryRows,
    overlappingBookings,
  })
}

export async function quoteOwnedStaysBatch(
  db: AnyDrizzleDb,
  inputs: ReadonlyArray<QuoteOwnedStayInput>,
): Promise<OwnedStayQuoteResult[]> {
  const results = new Map<number, OwnedStayQuoteResult>()
  const groups = new Map<string, Array<{ index: number; input: QuoteOwnedStayInput }>>()

  inputs.forEach((input, index) => {
    const nights = eachStayNight(input.checkIn, input.checkOut)
    if (nights.length === 0) {
      results.set(index, { status: "invalid_range", reason: "check_out_after_check_in" })
      return
    }
    const key = [input.roomTypeId, input.checkIn, input.checkOut].join("\u001f")
    const group = groups.get(key) ?? []
    group.push({ index, input })
    groups.set(key, group)
  })

  await Promise.all(
    [...groups.values()].map(async (group) => {
      const first = group[0]
      if (!first) return
      const nights = eachStayNight(first.input.checkIn, first.input.checkOut)
      const ratePlanIds = distinct(group.map(({ input }) => input.ratePlanId))
      const [roomRow, ratePlanRows, rateRows, inventoryRows, overlappingBookings] =
        await Promise.all([
          db.select().from(roomTypes).where(eq(roomTypes.id, first.input.roomTypeId)).limit(1),
          db.select().from(ratePlans).where(inArray(ratePlans.id, ratePlanIds)),
          db
            .select()
            .from(ratePlanDailyRates)
            .where(
              and(
                eq(ratePlanDailyRates.roomTypeId, first.input.roomTypeId),
                inArray(ratePlanDailyRates.ratePlanId, ratePlanIds),
                inArray(ratePlanDailyRates.date, nights),
              ),
            ),
          db
            .select()
            .from(roomTypeDailyInventory)
            .where(
              and(
                eq(roomTypeDailyInventory.roomTypeId, first.input.roomTypeId),
                inArray(roomTypeDailyInventory.date, nights),
              ),
            ),
          db
            .select({
              checkInDate: stayBookingItems.checkInDate,
              checkOutDate: stayBookingItems.checkOutDate,
              roomCount: stayBookingItems.roomCount,
            })
            .from(stayBookingItems)
            .where(
              and(
                eq(stayBookingItems.roomTypeId, first.input.roomTypeId),
                eq(stayBookingItems.status, "reserved"),
                lt(stayBookingItems.checkInDate, first.input.checkOut),
                gt(stayBookingItems.checkOutDate, first.input.checkIn),
              ),
            ),
        ])

      const room = roomRow[0]
      if (!room) {
        for (const { index } of group) results.set(index, { status: "room_not_found" })
        return
      }
      const plansById = new Map(ratePlanRows.map((plan) => [plan.id, plan]))
      for (const { index, input } of group) {
        const ratePlan = plansById.get(input.ratePlanId)
        if (!ratePlan) {
          results.set(index, { status: "rate_plan_not_found" })
          continue
        }
        results.set(
          index,
          resolveOwnedStayQuote(input, {
            room,
            ratePlan,
            rates: rateRows.filter((rate) => rate.ratePlanId === input.ratePlanId),
            inventory: inventoryRows,
            overlappingBookings,
          }),
        )
      }
    }),
  )

  return inputs.map((_, index) => {
    const result = results.get(index)
    if (!result) throw new Error(`quoteOwnedStaysBatch: missing result ${index}`)
    return result
  })
}

export function createFirstPartyAccommodationSearchBridge(): AccommodationSearchBridge {
  return async (ctx: OwnedSearchContext, input: AccommodationSearchBridgeInput) =>
    searchOwnedStays(ctx.db, input)
}

export async function searchOwnedStays(
  db: AnyDrizzleDb,
  input: AccommodationSearchBridgeInput,
): Promise<{ matches: AccommodationSearchMatch[]; nextCursor?: string }> {
  const propertyIds = await propertyIdsForSearch(db, input.criteria)
  const roomRowsQuery = db
    .select()
    .from(roomTypes)
    .where(
      propertyIds
        ? and(eq(roomTypes.active, true), inArray(roomTypes.propertyId, propertyIds))
        : eq(roomTypes.active, true),
    )
    .orderBy(asc(roomTypes.sortOrder), asc(roomTypes.name))
  const allRoomRows = await roomRowsQuery
  const roomRows = await filterRoomsForSearch(db, allRoomRows, input.criteria)
  if (roomRows.length === 0) return { matches: [] }

  const ratePlanRows = await db
    .select()
    .from(ratePlans)
    .where(
      and(
        eq(ratePlans.active, true),
        inArray(ratePlans.propertyId, distinct(roomRows.map((r) => r.propertyId))),
        input.criteria.refundableOnly ? eq(ratePlans.refundable, true) : undefined,
      ),
    )
    .orderBy(asc(ratePlans.sortOrder), asc(ratePlans.name))
  const eligibleRatePlanRows = input.criteria.refundableOnly
    ? ratePlanRows.filter((plan) => plan.refundable)
    : ratePlanRows
  if (eligibleRatePlanRows.length === 0) return { matches: [] }

  const mappingRows = await db
    .select()
    .from(ratePlanRoomTypes)
    .where(
      and(
        eq(ratePlanRoomTypes.active, true),
        inArray(
          ratePlanRoomTypes.ratePlanId,
          eligibleRatePlanRows.map((r) => r.id),
        ),
      ),
    )

  const mappingsByPlan = new Map<string, Set<string>>()
  for (const row of mappingRows) {
    const set = mappingsByPlan.get(row.ratePlanId) ?? new Set<string>()
    set.add(row.roomTypeId)
    mappingsByPlan.set(row.ratePlanId, set)
  }

  const requestedRooms = input.criteria.rooms.length
  const occupancy = aggregateOccupancy(input.criteria.rooms)
  const occupancies = input.criteria.rooms.map((room) => ({
    adults: room.adults,
    children: room.children,
    infants: room.infants,
  }))
  const matches: AccommodationSearchMatch[] = []
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100))

  for (const room of roomRows) {
    const plans = eligibleRatePlanRows.filter((plan) => {
      if (plan.propertyId !== room.propertyId) return false
      const mappedRoomIds = mappingsByPlan.get(plan.id)
      return !mappedRoomIds || mappedRoomIds.has(room.id)
    })
    for (const plan of plans) {
      const quote = await quoteOwnedStay(db, {
        roomTypeId: room.id,
        ratePlanId: plan.id,
        checkIn: input.criteria.checkIn,
        checkOut: input.criteria.checkOut,
        roomCount: requestedRooms,
        occupancy,
        occupancies,
        currency: input.scope.currency,
      })
      if (quote.status !== "ok" || !quote.available) continue
      matches.push({
        accommodationId: room.id,
        roomTypeId: room.id,
        ratePlanId: plan.id,
        occupancy: input.criteria.rooms[0] ?? { adults: occupancy.adults ?? 1 },
        price: { amount: centsToDecimal(quote.totalAmountCents), currency: quote.currency },
        providerData: {
          propertyId: quote.propertyId,
          mealPlanId: quote.mealPlanId ?? null,
          nightlyRates: quote.nightlyRates,
          availability: quote.availability,
        },
      })
    }
  }

  matches.sort((a, b) => Number(a.price.amount) - Number(b.price.amount))
  const offset = parseOwnedSearchCursor(input.cursor)
  const end = offset + limit
  return {
    matches: matches.slice(offset, end),
    nextCursor: end < matches.length ? formatOwnedSearchCursor(end) : undefined,
  }
}

export function eachStayNight(checkIn: string, checkOut: string): string[] {
  const start = Date.parse(`${checkIn}T00:00:00.000Z`)
  const end = Date.parse(`${checkOut}T00:00:00.000Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return []
  const dates: string[] = []
  for (let cursor = start; cursor < end; cursor += 86_400_000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10))
  }
  return dates
}

function bookedRoomsByNight(
  rows: ReadonlyArray<OwnedStayBookingOverlapRecord>,
  nights: ReadonlyArray<string>,
): Map<string, number> {
  const byDate = new Map<string, number>()
  const requested = new Set(nights)
  for (const row of rows) {
    for (const date of eachStayNight(row.checkInDate, row.checkOutDate)) {
      if (!requested.has(date)) continue
      byDate.set(date, (byDate.get(date) ?? 0) + row.roomCount)
    }
  }
  return byDate
}

function fitsOccupancy(
  room: ResolveOwnedStayQuoteRecords["room"],
  occupancy: OwnedStayOccupancy | undefined,
): boolean {
  if (!occupancy) return true
  const adults = occupancy.adults ?? 0
  const children = occupancy.children ?? 0
  const infants = occupancy.infants ?? 0
  const total = adults + children + infants
  if (room.maxAdults != null && adults > room.maxAdults) return false
  if (room.maxChildren != null && children > room.maxChildren) return false
  if (room.maxInfants != null && infants > room.maxInfants) return false
  if (room.maxOccupancy != null && total > room.maxOccupancy) return false
  return true
}

function roomFitsSearch(
  room: typeof roomTypes.$inferSelect,
  requestedRooms: ReadonlyArray<AccommodationSearchOccupancy>,
): boolean {
  return requestedRooms.every((occupancy) =>
    fitsOccupancy(room, {
      adults: occupancy.adults,
      children: occupancy.children,
      infants: occupancy.infants,
    }),
  )
}

async function filterRoomsForSearch(
  db: AnyDrizzleDb,
  rows: ReadonlyArray<typeof roomTypes.$inferSelect>,
  criteria: AccommodationSearchCriteria,
): Promise<Array<typeof roomTypes.$inferSelect>> {
  const occupancyFiltered = rows.filter((room) => roomFitsSearch(room, criteria.rooms))
  if (criteria.minStars == null) return occupancyFiltered
  const minStars = criteria.minStars
  const propertyRows = await db
    .select({ id: properties.id, rating: properties.rating, ratingScale: properties.ratingScale })
    .from(properties)
    .where(inArray(properties.id, distinct(occupancyFiltered.map((room) => room.propertyId))))
  const allowedPropertyIds = new Set(
    propertyRows
      .filter((property) => normalizedStars(property.rating, property.ratingScale) >= minStars)
      .map((property) => property.id),
  )
  return occupancyFiltered.filter((room) => allowedPropertyIds.has(room.propertyId))
}

function aggregateOccupancy(
  rooms: ReadonlyArray<AccommodationSearchOccupancy>,
): OwnedStayOccupancy {
  return rooms.reduce<OwnedStayOccupancy>(
    (sum, room) => ({
      adults: (sum.adults ?? 0) + room.adults,
      children: (sum.children ?? 0) + (room.children ?? 0),
      infants: (sum.infants ?? 0) + (room.infants ?? 0),
    }),
    { adults: 0, children: 0, infants: 0 },
  )
}

function occupanciesForQuote(
  input: QuoteOwnedStayInput,
): ReadonlyArray<OwnedStayOccupancy> | undefined {
  if (input.occupancies && input.occupancies.length > 0) return input.occupancies
  return input.occupancy ? [input.occupancy] : undefined
}

function aggregateOwnedOccupancies(
  occupancies: ReadonlyArray<OwnedStayOccupancy> | undefined,
): OwnedStayOccupancy {
  return (occupancies ?? []).reduce<OwnedStayOccupancy>(
    (sum, room) => ({
      adults: (sum.adults ?? 0) + (room.adults ?? 0),
      children: (sum.children ?? 0) + (room.children ?? 0),
      infants: (sum.infants ?? 0) + (room.infants ?? 0),
    }),
    { adults: 0, children: 0, infants: 0 },
  )
}

function rateQuantity(
  occupancyBasis: string | null | undefined,
  roomCount: number,
  occupancies: ReadonlyArray<OwnedStayOccupancy> | undefined,
): number {
  if (occupancyBasis === "per_person") {
    const occupancy = aggregateOwnedOccupancies(occupancies)
    return Math.max(
      1,
      (occupancy?.adults ?? 0) + (occupancy?.children ?? 0) + (occupancy?.infants ?? 0),
    )
  }
  return roomCount
}

async function propertyIdsForSearch(
  db: AnyDrizzleDb,
  criteria: AccommodationSearchCriteria,
): Promise<string[] | null> {
  const destination = criteria.destination
  if (!destination?.countryCode && !destination?.city && !destination?.region) return null
  const clauses = []
  if (destination.countryCode)
    clauses.push(eq(facilityAddressProjections.country, destination.countryCode))
  if (destination.city) clauses.push(eq(facilityAddressProjections.city, destination.city))
  if (destination.region) clauses.push(eq(facilityAddressProjections.region, destination.region))
  const rows = await db
    .select({ id: properties.id })
    .from(properties)
    .innerJoin(
      facilityAddressProjections,
      eq(facilityAddressProjections.facilityId, properties.facilityId),
    )
    .where(and(...clauses))
  return rows.map((row) => row.id)
}

function distinct(values: string[]): string[] {
  return [...new Set(values)]
}

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2)
}

function parseOwnedSearchCursor(cursor: string | undefined): number {
  if (!cursor) return 0
  const raw = cursor.startsWith("owned:") ? cursor.slice("owned:".length) : cursor
  if (!/^\d+$/.test(raw)) return 0
  const offset = Number(raw)
  return Number.isSafeInteger(offset) && offset > 0 ? offset : 0
}

function formatOwnedSearchCursor(offset: number): string {
  return `owned:${offset}`
}

function normalizedStars(value: number | null, scale: number | null): number {
  if (value == null) return 0
  if (scale != null && scale > 0 && scale !== 5)
    return Math.max(0, Math.min(5, (value / scale) * 5))
  return Math.max(0, Math.min(5, value))
}
