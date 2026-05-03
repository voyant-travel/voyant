import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { priceSchedulesRef } from "./pricing-ref.js"

import {
  housekeepingTasks,
  maintenanceBlocks,
  mealPlans,
  ratePlanInventoryOverrides,
  ratePlanRoomTypes,
  ratePlans,
  roomBlocks,
  roomInventory,
  roomTypeBedConfigs,
  roomTypeRates,
  roomTypes,
  roomUnitStatusEvents,
  roomUnits,
  stayBookingItems,
  stayCheckpoints,
  stayDailyRates,
  stayFolioLines,
  stayFolios,
  stayOperations,
  stayRules,
  stayServicePosts,
} from "./schema.js"
import type {
  housekeepingTaskListQuerySchema,
  insertHousekeepingTaskSchema,
  insertMaintenanceBlockSchema,
  insertMealPlanSchema,
  insertRatePlanInventoryOverrideSchema,
  insertRatePlanRoomTypeSchema,
  insertRatePlanSchema,
  insertRoomBlockSchema,
  insertRoomInventorySchema,
  insertRoomTypeBedConfigSchema,
  insertRoomTypeRateSchema,
  insertRoomTypeSchema,
  insertRoomUnitSchema,
  insertRoomUnitStatusEventSchema,
  insertStayBookingItemSchema,
  insertStayCheckpointSchema,
  insertStayDailyRateSchema,
  insertStayFolioLineSchema,
  insertStayFolioSchema,
  insertStayOperationSchema,
  insertStayRuleSchema,
  insertStayServicePostSchema,
  maintenanceBlockListQuerySchema,
  mealPlanListQuerySchema,
  ratePlanInventoryOverrideListQuerySchema,
  ratePlanListQuerySchema,
  ratePlanRoomTypeListQuerySchema,
  roomBlockListQuerySchema,
  roomInventoryListQuerySchema,
  roomTypeBedConfigListQuerySchema,
  roomTypeListQuerySchema,
  roomTypeRateListQuerySchema,
  roomUnitListQuerySchema,
  roomUnitStatusEventListQuerySchema,
  stayBookingItemListQuerySchema,
  stayCheckpointListQuerySchema,
  stayDailyRateListQuerySchema,
  stayFolioLineListQuerySchema,
  stayFolioListQuerySchema,
  stayOperationListQuerySchema,
  stayRuleListQuerySchema,
  stayServicePostListQuerySchema,
  updateHousekeepingTaskSchema,
  updateMaintenanceBlockSchema,
  updateMealPlanSchema,
  updateRatePlanInventoryOverrideSchema,
  updateRatePlanRoomTypeSchema,
  updateRatePlanSchema,
  updateRoomBlockSchema,
  updateRoomInventorySchema,
  updateRoomTypeBedConfigSchema,
  updateRoomTypeRateSchema,
  updateRoomTypeSchema,
  updateRoomUnitSchema,
  updateRoomUnitStatusEventSchema,
  updateStayBookingItemSchema,
  updateStayCheckpointSchema,
  updateStayDailyRateSchema,
  updateStayFolioLineSchema,
  updateStayFolioSchema,
  updateStayOperationSchema,
  updateStayRuleSchema,
  updateStayServicePostSchema,
} from "./validation.js"

type RoomTypeListQuery = z.infer<typeof roomTypeListQuerySchema>
type CreateRoomTypeInput = z.infer<typeof insertRoomTypeSchema>
type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>
type RoomTypeBedConfigListQuery = z.infer<typeof roomTypeBedConfigListQuerySchema>
type CreateRoomTypeBedConfigInput = z.infer<typeof insertRoomTypeBedConfigSchema>
type UpdateRoomTypeBedConfigInput = z.infer<typeof updateRoomTypeBedConfigSchema>
type RoomUnitListQuery = z.infer<typeof roomUnitListQuerySchema>
type CreateRoomUnitInput = z.infer<typeof insertRoomUnitSchema>
type UpdateRoomUnitInput = z.infer<typeof updateRoomUnitSchema>
type MealPlanListQuery = z.infer<typeof mealPlanListQuerySchema>
type CreateMealPlanInput = z.infer<typeof insertMealPlanSchema>
type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>
type RatePlanListQuery = z.infer<typeof ratePlanListQuerySchema>
type CreateRatePlanInput = z.infer<typeof insertRatePlanSchema>
type UpdateRatePlanInput = z.infer<typeof updateRatePlanSchema>
type RatePlanRoomTypeListQuery = z.infer<typeof ratePlanRoomTypeListQuerySchema>
type CreateRatePlanRoomTypeInput = z.infer<typeof insertRatePlanRoomTypeSchema>
type UpdateRatePlanRoomTypeInput = z.infer<typeof updateRatePlanRoomTypeSchema>
type StayRuleListQuery = z.infer<typeof stayRuleListQuerySchema>
type CreateStayRuleInput = z.infer<typeof insertStayRuleSchema>
type UpdateStayRuleInput = z.infer<typeof updateStayRuleSchema>
type RoomInventoryListQuery = z.infer<typeof roomInventoryListQuerySchema>
type CreateRoomInventoryInput = z.infer<typeof insertRoomInventorySchema>
type UpdateRoomInventoryInput = z.infer<typeof updateRoomInventorySchema>
type RatePlanInventoryOverrideListQuery = z.infer<typeof ratePlanInventoryOverrideListQuerySchema>
type CreateRatePlanInventoryOverrideInput = z.infer<typeof insertRatePlanInventoryOverrideSchema>
type UpdateRatePlanInventoryOverrideInput = z.infer<typeof updateRatePlanInventoryOverrideSchema>
type StayBookingItemListQuery = z.infer<typeof stayBookingItemListQuerySchema>
type CreateStayBookingItemInput = z.infer<typeof insertStayBookingItemSchema>
type UpdateStayBookingItemInput = z.infer<typeof updateStayBookingItemSchema>
type StayDailyRateListQuery = z.infer<typeof stayDailyRateListQuerySchema>
type CreateStayDailyRateInput = z.infer<typeof insertStayDailyRateSchema>
type UpdateStayDailyRateInput = z.infer<typeof updateStayDailyRateSchema>
type RoomBlockListQuery = z.infer<typeof roomBlockListQuerySchema>
type CreateRoomBlockInput = z.infer<typeof insertRoomBlockSchema>
type UpdateRoomBlockInput = z.infer<typeof updateRoomBlockSchema>
type RoomUnitStatusEventListQuery = z.infer<typeof roomUnitStatusEventListQuerySchema>
type CreateRoomUnitStatusEventInput = z.infer<typeof insertRoomUnitStatusEventSchema>
type UpdateRoomUnitStatusEventInput = z.infer<typeof updateRoomUnitStatusEventSchema>
type MaintenanceBlockListQuery = z.infer<typeof maintenanceBlockListQuerySchema>
type CreateMaintenanceBlockInput = z.infer<typeof insertMaintenanceBlockSchema>
type UpdateMaintenanceBlockInput = z.infer<typeof updateMaintenanceBlockSchema>
type HousekeepingTaskListQuery = z.infer<typeof housekeepingTaskListQuerySchema>
type CreateHousekeepingTaskInput = z.infer<typeof insertHousekeepingTaskSchema>
type UpdateHousekeepingTaskInput = z.infer<typeof updateHousekeepingTaskSchema>
type StayOperationListQuery = z.infer<typeof stayOperationListQuerySchema>
type CreateStayOperationInput = z.infer<typeof insertStayOperationSchema>
type UpdateStayOperationInput = z.infer<typeof updateStayOperationSchema>
type StayCheckpointListQuery = z.infer<typeof stayCheckpointListQuerySchema>
type CreateStayCheckpointInput = z.infer<typeof insertStayCheckpointSchema>
type UpdateStayCheckpointInput = z.infer<typeof updateStayCheckpointSchema>
type StayServicePostListQuery = z.infer<typeof stayServicePostListQuerySchema>
type CreateStayServicePostInput = z.infer<typeof insertStayServicePostSchema>
type UpdateStayServicePostInput = z.infer<typeof updateStayServicePostSchema>
type StayFolioListQuery = z.infer<typeof stayFolioListQuerySchema>
type CreateStayFolioInput = z.infer<typeof insertStayFolioSchema>
type UpdateStayFolioInput = z.infer<typeof updateStayFolioSchema>
type RoomTypeRateListQuery = z.infer<typeof roomTypeRateListQuerySchema>
type CreateRoomTypeRateInput = z.infer<typeof insertRoomTypeRateSchema>
type UpdateRoomTypeRateInput = z.infer<typeof updateRoomTypeRateSchema>
type StayFolioLineListQuery = z.infer<typeof stayFolioLineListQuerySchema>
type CreateStayFolioLineInput = z.infer<typeof insertStayFolioLineSchema>
type UpdateStayFolioLineInput = z.infer<typeof updateStayFolioLineSchema>

async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.count ?? 0, limit, offset }
}

function toDateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null
}

const WEEKDAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

/**
 * Returns true when the given ISO date matches the schedule's
 * weekdays + validFrom/validTo window.
 *
 * Schedule matching is intentionally simple: the
 * `recurrenceRule` (an iCal RRULE string) is NOT parsed. Production
 * uses set the `weekdays` JSON array (e.g. `["fri", "sat"]`) and
 * `validFrom` / `validTo` for the date window. Anything beyond
 * that — exception dates, monthly recurrences — needs RRULE parsing
 * which is a follow-up.
 */
function scheduleMatchesDate(
  schedule: {
    validFrom: string | null
    validTo: string | null
    weekdays: string[] | null
  },
  isoDate: string,
): boolean {
  if (schedule.validFrom && isoDate < schedule.validFrom) return false
  if (schedule.validTo && isoDate > schedule.validTo) return false
  if (schedule.weekdays && schedule.weekdays.length > 0) {
    const dayCode = WEEKDAY_CODES[new Date(`${isoDate}T00:00:00Z`).getUTCDay()]!
    const normalized = schedule.weekdays.map((d) => d.toLowerCase().slice(0, 3))
    if (!normalized.includes(dayCode)) return false
  }
  return true
}

/**
 * Pick the winning rate row for a given date from a set of candidate
 * rate rows. Rules with a higher-priority matching schedule beat
 * lower-priority ones; if no schedule matches, the default
 * (null-schedule) rule is returned.
 */
function pickRateForDate<
  TRate extends {
    priceScheduleId: string | null
    currencyCode: string
    baseAmountCents: number | null
    extraAdultAmountCents: number | null
    extraChildAmountCents: number | null
    extraInfantAmountCents: number | null
  },
  TSchedule extends {
    validFrom: string | null
    validTo: string | null
    weekdays: string[] | null
    priority: number
  },
>(
  date: string,
  rateRows: TRate[],
  schedulesById: Map<string, TSchedule>,
  defaultRate: TRate,
): TRate {
  let winner = defaultRate
  let winnerPriority = Number.NEGATIVE_INFINITY
  for (const row of rateRows) {
    if (!row.priceScheduleId) continue
    const schedule = schedulesById.get(row.priceScheduleId)
    if (!schedule) continue
    if (!scheduleMatchesDate(schedule, date)) continue
    if (schedule.priority > winnerPriority) {
      winner = row
      winnerPriority = schedule.priority
    }
  }
  return winner
}

/**
 * Iterate the dates from `start` (inclusive) to `end` (exclusive) as
 * ISO YYYY-MM-DD strings. Hotel "nights" — checking out on the
 * `endDate` does not consume that date's inventory.
 */
function eachNight(startDate: string, endDate: string): string[] {
  const out: string[] = []
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("eachNight: invalid date input")
  }
  for (
    let cursor = start;
    cursor < end;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    out.push(cursor.toISOString().slice(0, 10))
  }
  return out
}

/**
 * Input for {@link reserveStay}. Mirrors the schema's stay_booking_items
 * shape but consumes inventory atomically.
 */
export interface ReserveStayInput {
  bookingItemId: string
  propertyId: string
  roomTypeId: string
  ratePlanId: string
  checkInDate: string
  checkOutDate: string
  roomCount?: number
  adults?: number
  children?: number
  infants?: number
  mealPlanId?: string | null
  /**
   * Per-night sell amounts. Length must equal nightCount; each row is
   * inserted into `stay_daily_rates` for the corresponding night.
   */
  dailyRates: Array<{
    sellCurrency: string
    sellAmountCents?: number | null
    costCurrency?: string | null
    costAmountCents?: number | null
    taxAmountCents?: number | null
    feeAmountCents?: number | null
    commissionAmountCents?: number | null
  }>
}

export type ReserveStayResult =
  | { status: "ok"; stayBookingItemId: string; nightCount: number; roomUnitId?: string | null }
  | { status: "insufficient_capacity"; date: string; available: number; needed: number }
  | { status: "stop_sell"; date: string }
  | { status: "inventory_missing"; date: string }
  | { status: "rate_count_mismatch"; expected: number; received: number }
  | { status: "no_unit_available" }
  | { status: "room_type_not_found" }

/**
 * Per-night rate row produced by {@link resolveStayDailyRates}. Shape
 * matches the input expected by {@link reserveStay}'s `dailyRates`.
 */
export interface ResolvedDailyRate {
  date: string
  sellCurrency: string
  sellAmountCents: number | null
  extraAdultAmountCents: number | null
  extraChildAmountCents: number | null
  extraInfantAmountCents: number | null
}

export type ResolveStayDailyRatesResult =
  | { status: "ok"; rates: ResolvedDailyRate[] }
  | { status: "rate_not_found"; ratePlanId: string; roomTypeId: string }
  | { status: "stop_sell"; date: string }
  | { status: "closed_to_arrival"; date: string }
  | { status: "closed_to_departure"; date: string }

export interface ResolveStayDailyRatesInput {
  ratePlanId: string
  roomTypeId: string
  /** Inclusive ISO YYYY-MM-DD. */
  startDate: string
  /** Exclusive ISO YYYY-MM-DD (hotel checkout convention). */
  endDate: string
}

export const hospitalityService = {
  /**
   * Resolve the per-night rate card for a (rate plan, room type, date
   * range) tuple — produces the array shape that
   * {@link reserveStay}'s `dailyRates` consumes.
   *
   * **Resolution rules:**
   *
   * 1. The base rate comes from `room_type_rates.baseAmountCents` for
   *    the (ratePlanId, roomTypeId) pair. Currently flat — every night
   *    in the range gets the same base amount.
   * 2. `rate_plan_inventory_overrides` is consulted for restrictions
   *    only:
   *    - `stop_sell` on any night → typed `stop_sell` failure
   *    - `closed_to_arrival` on the FIRST night → `closed_to_arrival`
   *    - `closed_to_departure` on the night BEFORE the checkout date
   *      → `closed_to_departure`
   * 3. Currency is taken from `room_type_rates.currencyCode`.
   *
   * **What this resolver does NOT (yet) do:**
   *
   * - Date-scoped rate variation (weekend bumps, seasonal pricing).
   *   The schema's `room_type_rates` is flat per (rate plan, room
   *   type); date-scoped variation lives on the linked
   *   `priceScheduleId` in the pricing module, which this resolver
   *   does not yet consult. Wiring price-schedule resolution is a
   *   follow-up.
   * - Length-of-stay discounts.
   * - Promo codes.
   *
   * Pass the result directly to `reserveStay`'s `dailyRates`.
   */
  async resolveStayDailyRates(
    db: PostgresJsDatabase,
    input: ResolveStayDailyRatesInput,
  ): Promise<ResolveStayDailyRatesResult> {
    const nights = eachNight(input.startDate, input.endDate)
    if (nights.length === 0) {
      return { status: "ok", rates: [] }
    }

    // Pull every active rate row for the (ratePlanId, roomTypeId) pair.
    // Multiple rows are allowed when each carries a different
    // priceScheduleId (uidx_room_type_rates_plan_room_schedule); the
    // null-schedule row is the default that applies when no schedule
    // matches a given night.
    const rateRows = await db
      .select()
      .from(roomTypeRates)
      .where(
        and(
          eq(roomTypeRates.ratePlanId, input.ratePlanId),
          eq(roomTypeRates.roomTypeId, input.roomTypeId),
          eq(roomTypeRates.active, true),
        ),
      )

    if (rateRows.length === 0) {
      return {
        status: "rate_not_found",
        ratePlanId: input.ratePlanId,
        roomTypeId: input.roomTypeId,
      }
    }

    const defaultRate = rateRows.find((r) => r.priceScheduleId === null) ?? rateRows[0]!

    // Load schedules referenced by any non-default rate row. Cross-domain
    // read via the local pricing-ref column mirror.
    const scheduleIds = rateRows
      .map((r) => r.priceScheduleId)
      .filter((id): id is string => Boolean(id))
    const schedules =
      scheduleIds.length === 0
        ? []
        : await db
            .select()
            .from(priceSchedulesRef)
            .where(
              and(inArray(priceSchedulesRef.id, scheduleIds), eq(priceSchedulesRef.active, true)),
            )
    const schedulesById = new Map(schedules.map((s) => [s.id, s]))

    const overrides = await db
      .select()
      .from(ratePlanInventoryOverrides)
      .where(
        and(
          eq(ratePlanInventoryOverrides.ratePlanId, input.ratePlanId),
          eq(ratePlanInventoryOverrides.roomTypeId, input.roomTypeId),
          gte(ratePlanInventoryOverrides.date, nights[0]!),
          lte(ratePlanInventoryOverrides.date, nights[nights.length - 1]!),
        ),
      )
    const overridesByDate = new Map<string, (typeof overrides)[number]>()
    for (const ov of overrides) {
      overridesByDate.set(ov.date, ov)
    }

    // Stop-sell on any night → reject the whole range
    for (const date of nights) {
      const ov = overridesByDate.get(date)
      if (ov?.stopSell) {
        return { status: "stop_sell", date }
      }
    }
    // Closed-to-arrival on the first night → reject
    const firstNight = nights[0]!
    if (overridesByDate.get(firstNight)?.closedToArrival) {
      return { status: "closed_to_arrival", date: firstNight }
    }
    // Closed-to-departure on the last night before checkout → reject.
    const lastNight = nights[nights.length - 1]!
    if (overridesByDate.get(lastNight)?.closedToDeparture) {
      return { status: "closed_to_departure", date: lastNight }
    }

    // For each night, pick the rate row whose linked schedule matches.
    // Higher priority wins; if no schedule matches, fall back to the
    // default (null-schedule) row.
    const rates = nights.map((date) => {
      const winner = pickRateForDate(date, rateRows, schedulesById, defaultRate)
      return {
        date,
        sellCurrency: winner.currencyCode,
        sellAmountCents: winner.baseAmountCents,
        extraAdultAmountCents: winner.extraAdultAmountCents,
        extraChildAmountCents: winner.extraChildAmountCents,
        extraInfantAmountCents: winner.extraInfantAmountCents,
      }
    })

    return { status: "ok", rates }
  },

  /**
   * Atomically reserve a stay. Dispatches based on the room type's
   * `inventoryMode`:
   *
   * - **pooled** (default): the property tracks "rooms-of-type-X
   *   available for date Y" in `room_inventory`. Multiple physical
   *   rooms are interchangeable; the desk picks one at check-in.
   *   Reserve decrements `available_units` per night via per-night
   *   `SELECT ... FOR UPDATE` row locks.
   * - **serialized**: each `room_unit` is a specific physical room
   *   ("an instance"); the booking is bound to that unit at reserve
   *   time. Reserve picks the first available unit (sortOrder +
   *   room_number deterministic), `SELECT ... FOR UPDATE`s the
   *   chosen row, and persists the `roomUnitId` on
   *   `stay_booking_items`. Skips units covered by `room_blocks` /
   *   `maintenance_blocks` or already in an overlapping
   *   reserved/checked-in stay.
   * - **virtual**: not yet supported by `reserveStay`. Falls through
   *   to pooled-mode logic, which will fail with
   *   `inventory_missing` if no `room_inventory` row exists.
   *
   * Concurrency: pooled-mode reserves serialize through per-night
   * `room_inventory` locks; serialized-mode reserves serialize through
   * per-unit `room_units` locks. Both produce typed
   * `insufficient_capacity` / `no_unit_available` failures without
   * mutating state.
   */
  async reserveStay(db: PostgresJsDatabase, input: ReserveStayInput): Promise<ReserveStayResult> {
    const nights = eachNight(input.checkInDate, input.checkOutDate)
    if (nights.length === 0) {
      return { status: "rate_count_mismatch", expected: 0, received: input.dailyRates.length }
    }
    if (input.dailyRates.length !== nights.length) {
      return {
        status: "rate_count_mismatch",
        expected: nights.length,
        received: input.dailyRates.length,
      }
    }

    // Look up the room type to dispatch by inventory mode.
    const [roomType] = await db
      .select({ id: roomTypes.id, inventoryMode: roomTypes.inventoryMode })
      .from(roomTypes)
      .where(eq(roomTypes.id, input.roomTypeId))
      .limit(1)
    if (!roomType) {
      return { status: "room_type_not_found" }
    }

    if (roomType.inventoryMode === "serialized") {
      return this._reserveStaySerialized(db, input, nights)
    }

    const roomCount = input.roomCount ?? 1

    return db.transaction(async (tx) => {
      // Lock + check inventory for every night. Order by date so two
      // concurrent reserves with overlapping ranges always grab locks in
      // the same order — no deadlock possible.
      for (const date of nights) {
        const rows = await tx.execute(sql`
          SELECT id, available_units, stop_sell
          FROM ${roomInventory}
          WHERE ${roomInventory.roomTypeId} = ${input.roomTypeId}
            AND ${roomInventory.date} = ${date}
          FOR UPDATE
        `)
        const row = (
          rows as unknown as Array<{
            id: string
            available_units: number
            stop_sell: boolean
          }>
        )[0]

        if (!row) {
          return { status: "inventory_missing" as const, date }
        }
        if (row.stop_sell) {
          return { status: "stop_sell" as const, date }
        }
        if (row.available_units < roomCount) {
          return {
            status: "insufficient_capacity" as const,
            date,
            available: row.available_units,
            needed: roomCount,
          }
        }
      }

      // All nights have capacity. Decrement.
      for (const date of nights) {
        await tx
          .update(roomInventory)
          .set({
            availableUnits: sql`${roomInventory.availableUnits} - ${roomCount}`,
            heldUnits: sql`${roomInventory.heldUnits} + ${roomCount}`,
            updatedAt: new Date(),
          })
          .where(and(eq(roomInventory.roomTypeId, input.roomTypeId), eq(roomInventory.date, date)))
      }

      // Insert the stay row.
      const [stayRow] = await tx
        .insert(stayBookingItems)
        .values({
          bookingItemId: input.bookingItemId,
          propertyId: input.propertyId,
          roomTypeId: input.roomTypeId,
          ratePlanId: input.ratePlanId,
          mealPlanId: input.mealPlanId ?? null,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          nightCount: nights.length,
          roomCount,
          adults: input.adults ?? 1,
          children: input.children ?? 0,
          infants: input.infants ?? 0,
          status: "reserved",
        })
        .returning()

      if (!stayRow) {
        throw new Error("reserveStay: stay_booking_items insert returned no rows")
      }

      // Insert the per-night rate rows in lockstep with the date range.
      await tx.insert(stayDailyRates).values(
        nights.map((date, idx) => {
          const rate = input.dailyRates[idx]!
          return {
            stayBookingItemId: stayRow.id,
            date,
            sellCurrency: rate.sellCurrency,
            sellAmountCents: rate.sellAmountCents ?? null,
            costCurrency: rate.costCurrency ?? null,
            costAmountCents: rate.costAmountCents ?? null,
            taxAmountCents: rate.taxAmountCents ?? null,
            feeAmountCents: rate.feeAmountCents ?? null,
            commissionAmountCents: rate.commissionAmountCents ?? null,
          }
        }),
      )

      return { status: "ok" as const, stayBookingItemId: stayRow.id, nightCount: nights.length }
    })
  },

  /**
   * Internal: serialized-mode (per-physical-room) reserve.
   * Pooled-mode is in `reserveStay`.
   *
   * Picks the first available `room_unit` of the requested type by:
   * - Excluding units in non-active status
   * - Excluding units covered by an active `room_blocks` entry whose
   *   range overlaps the requested stay (per-unit OR property-wide
   *   roomType block)
   * - Excluding units covered by an active `maintenance_blocks` entry
   *   on the same logic
   * - Excluding units already occupied by a reserved or checked-in
   *   `stay_booking_items` whose date range overlaps
   *
   * The chosen unit is `SELECT ... FOR UPDATE`d so concurrent reserves
   * on the same physical room serialize. The loser sees the unit
   * already locked + occupied (after the first commits) and falls
   * through to the next candidate, or `no_unit_available` if none
   * remain.
   */
  async _reserveStaySerialized(
    db: PostgresJsDatabase,
    input: ReserveStayInput,
    nights: string[],
  ): Promise<ReserveStayResult> {
    return db.transaction(async (tx) => {
      // Find + lock the first available unit. The query mirrors the
      // logic enumerated in the docstring above. We use FOR UPDATE so
      // concurrent reserves serialize on the chosen unit.
      const candidates = await tx.execute(sql`
        SELECT u.id
        FROM ${roomUnits} u
        WHERE u.room_type_id = ${input.roomTypeId}
          AND u.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM ${roomBlocks} b
            WHERE (
                b.room_unit_id = u.id
                OR (b.room_type_id = u.room_type_id AND b.room_unit_id IS NULL)
              )
              AND b.status IN ('held', 'confirmed')
              AND b.starts_on < ${input.checkOutDate}
              AND b.ends_on > ${input.checkInDate}
          )
          AND NOT EXISTS (
            SELECT 1 FROM ${maintenanceBlocks} m
            WHERE (
                m.room_unit_id = u.id
                OR (m.room_type_id = u.room_type_id AND m.room_unit_id IS NULL)
              )
              AND m.status IN ('open', 'in_progress')
              AND m.starts_on < ${input.checkOutDate}
              AND m.ends_on > ${input.checkInDate}
          )
          AND NOT EXISTS (
            SELECT 1 FROM ${stayBookingItems} s
            WHERE s.room_unit_id = u.id
              AND s.status IN ('reserved', 'checked_in')
              AND s.check_in_date < ${input.checkOutDate}
              AND s.check_out_date > ${input.checkInDate}
          )
        ORDER BY u.code NULLS LAST, u.room_number NULLS LAST, u.id
        LIMIT 1
        FOR UPDATE
      `)
      const candidate = (candidates as unknown as Array<{ id: string }>)[0]
      if (!candidate) {
        return { status: "no_unit_available" as const }
      }

      const [stayRow] = await tx
        .insert(stayBookingItems)
        .values({
          bookingItemId: input.bookingItemId,
          propertyId: input.propertyId,
          roomTypeId: input.roomTypeId,
          roomUnitId: candidate.id,
          ratePlanId: input.ratePlanId,
          mealPlanId: input.mealPlanId ?? null,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          nightCount: nights.length,
          roomCount: input.roomCount ?? 1,
          adults: input.adults ?? 1,
          children: input.children ?? 0,
          infants: input.infants ?? 0,
          status: "reserved",
        })
        .returning()

      if (!stayRow) {
        throw new Error("_reserveStayInstance: stay_booking_items insert returned no rows")
      }

      await tx.insert(stayDailyRates).values(
        nights.map((date, idx) => {
          const rate = input.dailyRates[idx]!
          return {
            stayBookingItemId: stayRow.id,
            date,
            sellCurrency: rate.sellCurrency,
            sellAmountCents: rate.sellAmountCents ?? null,
            costCurrency: rate.costCurrency ?? null,
            costAmountCents: rate.costAmountCents ?? null,
            taxAmountCents: rate.taxAmountCents ?? null,
            feeAmountCents: rate.feeAmountCents ?? null,
            commissionAmountCents: rate.commissionAmountCents ?? null,
          }
        }),
      )

      return {
        status: "ok" as const,
        stayBookingItemId: stayRow.id,
        nightCount: nights.length,
        roomUnitId: candidate.id,
      }
    })
  },

  async listRoomTypes(db: PostgresJsDatabase, query: RoomTypeListQuery) {
    const conditions = []
    if (query.propertyId) conditions.push(eq(roomTypes.propertyId, query.propertyId))
    if (query.supplierId) conditions.push(eq(roomTypes.supplierId, query.supplierId))
    if (query.active !== undefined) conditions.push(eq(roomTypes.active, query.active))
    if (query.inventoryMode) conditions.push(eq(roomTypes.inventoryMode, query.inventoryMode))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(roomTypes.name, term), ilike(roomTypes.code, term)))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(roomTypes)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(roomTypes.sortOrder), asc(roomTypes.name)),
      db.select({ count: sql<number>`count(*)::int` }).from(roomTypes).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRoomTypeById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(roomTypes).where(eq(roomTypes.id, id)).limit(1)
    return row ?? null
  },

  async createRoomType(db: PostgresJsDatabase, data: CreateRoomTypeInput) {
    const [row] = await db.insert(roomTypes).values(data).returning()
    return row ?? null
  },

  async updateRoomType(db: PostgresJsDatabase, id: string, data: UpdateRoomTypeInput) {
    const [row] = await db
      .update(roomTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roomTypes.id, id))
      .returning()
    return row ?? null
  },

  async deleteRoomType(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(roomTypes)
      .where(eq(roomTypes.id, id))
      .returning({ id: roomTypes.id })
    return row ?? null
  },

  async listRoomTypeBedConfigs(db: PostgresJsDatabase, query: RoomTypeBedConfigListQuery) {
    const conditions = []
    if (query.roomTypeId) conditions.push(eq(roomTypeBedConfigs.roomTypeId, query.roomTypeId))
    if (query.bedType) conditions.push(eq(roomTypeBedConfigs.bedType, query.bedType))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(roomTypeBedConfigs)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(roomTypeBedConfigs.isPrimary), asc(roomTypeBedConfigs.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(roomTypeBedConfigs).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRoomTypeBedConfigById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(roomTypeBedConfigs)
      .where(eq(roomTypeBedConfigs.id, id))
      .limit(1)
    return row ?? null
  },

  async createRoomTypeBedConfig(db: PostgresJsDatabase, data: CreateRoomTypeBedConfigInput) {
    const [row] = await db.insert(roomTypeBedConfigs).values(data).returning()
    return row ?? null
  },

  async updateRoomTypeBedConfig(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateRoomTypeBedConfigInput,
  ) {
    const [row] = await db
      .update(roomTypeBedConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roomTypeBedConfigs.id, id))
      .returning()
    return row ?? null
  },

  async deleteRoomTypeBedConfig(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(roomTypeBedConfigs)
      .where(eq(roomTypeBedConfigs.id, id))
      .returning({ id: roomTypeBedConfigs.id })
    return row ?? null
  },

  async listRoomUnits(db: PostgresJsDatabase, query: RoomUnitListQuery) {
    const conditions = []
    if (query.propertyId) conditions.push(eq(roomUnits.propertyId, query.propertyId))
    if (query.roomTypeId) conditions.push(eq(roomUnits.roomTypeId, query.roomTypeId))
    if (query.status) conditions.push(eq(roomUnits.status, query.status))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(
        or(
          ilike(roomUnits.code, term),
          ilike(roomUnits.roomNumber, term),
          ilike(roomUnits.notes, term),
        ),
      )
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(roomUnits)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(roomUnits.roomNumber), asc(roomUnits.code)),
      db.select({ count: sql<number>`count(*)::int` }).from(roomUnits).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRoomUnitById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(roomUnits).where(eq(roomUnits.id, id)).limit(1)
    return row ?? null
  },

  async createRoomUnit(db: PostgresJsDatabase, data: CreateRoomUnitInput) {
    const [row] = await db.insert(roomUnits).values(data).returning()
    return row ?? null
  },

  async updateRoomUnit(db: PostgresJsDatabase, id: string, data: UpdateRoomUnitInput) {
    const [row] = await db
      .update(roomUnits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roomUnits.id, id))
      .returning()
    return row ?? null
  },

  async deleteRoomUnit(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(roomUnits)
      .where(eq(roomUnits.id, id))
      .returning({ id: roomUnits.id })
    return row ?? null
  },

  async listMealPlans(db: PostgresJsDatabase, query: MealPlanListQuery) {
    const conditions = []
    if (query.propertyId) conditions.push(eq(mealPlans.propertyId, query.propertyId))
    if (query.active !== undefined) conditions.push(eq(mealPlans.active, query.active))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(mealPlans.name, term), ilike(mealPlans.code, term)))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(mealPlans)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(mealPlans.sortOrder), asc(mealPlans.name)),
      db.select({ count: sql<number>`count(*)::int` }).from(mealPlans).where(where),
      query.limit,
      query.offset,
    )
  },

  async getMealPlanById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(mealPlans).where(eq(mealPlans.id, id)).limit(1)
    return row ?? null
  },

  async createMealPlan(db: PostgresJsDatabase, data: CreateMealPlanInput) {
    const [row] = await db.insert(mealPlans).values(data).returning()
    return row ?? null
  },

  async updateMealPlan(db: PostgresJsDatabase, id: string, data: UpdateMealPlanInput) {
    const [row] = await db
      .update(mealPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mealPlans.id, id))
      .returning()
    return row ?? null
  },

  async deleteMealPlan(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(mealPlans)
      .where(eq(mealPlans.id, id))
      .returning({ id: mealPlans.id })
    return row ?? null
  },

  async listRatePlans(db: PostgresJsDatabase, query: RatePlanListQuery) {
    const conditions = []
    if (query.propertyId) conditions.push(eq(ratePlans.propertyId, query.propertyId))
    if (query.mealPlanId) conditions.push(eq(ratePlans.mealPlanId, query.mealPlanId))
    if (query.marketId) conditions.push(eq(ratePlans.marketId, query.marketId))
    if (query.active !== undefined) conditions.push(eq(ratePlans.active, query.active))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(ratePlans.name, term), ilike(ratePlans.code, term)))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(ratePlans)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(ratePlans.sortOrder), asc(ratePlans.name)),
      db.select({ count: sql<number>`count(*)::int` }).from(ratePlans).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRatePlanById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(ratePlans).where(eq(ratePlans.id, id)).limit(1)
    return row ?? null
  },

  async createRatePlan(db: PostgresJsDatabase, data: CreateRatePlanInput) {
    const [row] = await db.insert(ratePlans).values(data).returning()
    return row ?? null
  },

  async updateRatePlan(db: PostgresJsDatabase, id: string, data: UpdateRatePlanInput) {
    const [row] = await db
      .update(ratePlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ratePlans.id, id))
      .returning()
    return row ?? null
  },

  async deleteRatePlan(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(ratePlans)
      .where(eq(ratePlans.id, id))
      .returning({ id: ratePlans.id })
    return row ?? null
  },

  async listRatePlanRoomTypes(db: PostgresJsDatabase, query: RatePlanRoomTypeListQuery) {
    const conditions = []
    if (query.ratePlanId) conditions.push(eq(ratePlanRoomTypes.ratePlanId, query.ratePlanId))
    if (query.roomTypeId) conditions.push(eq(ratePlanRoomTypes.roomTypeId, query.roomTypeId))
    if (query.productId) conditions.push(eq(ratePlanRoomTypes.productId, query.productId))
    if (query.active !== undefined) conditions.push(eq(ratePlanRoomTypes.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(ratePlanRoomTypes)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(ratePlanRoomTypes.sortOrder), asc(ratePlanRoomTypes.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(ratePlanRoomTypes).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRatePlanRoomTypeById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(ratePlanRoomTypes)
      .where(eq(ratePlanRoomTypes.id, id))
      .limit(1)
    return row ?? null
  },

  async createRatePlanRoomType(db: PostgresJsDatabase, data: CreateRatePlanRoomTypeInput) {
    const [row] = await db.insert(ratePlanRoomTypes).values(data).returning()
    return row ?? null
  },

  async updateRatePlanRoomType(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateRatePlanRoomTypeInput,
  ) {
    const [row] = await db
      .update(ratePlanRoomTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ratePlanRoomTypes.id, id))
      .returning()
    return row ?? null
  },

  async deleteRatePlanRoomType(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(ratePlanRoomTypes)
      .where(eq(ratePlanRoomTypes.id, id))
      .returning({ id: ratePlanRoomTypes.id })
    return row ?? null
  },

  async listStayRules(db: PostgresJsDatabase, query: StayRuleListQuery) {
    const conditions = []
    if (query.propertyId) conditions.push(eq(stayRules.propertyId, query.propertyId))
    if (query.ratePlanId) conditions.push(eq(stayRules.ratePlanId, query.ratePlanId))
    if (query.roomTypeId) conditions.push(eq(stayRules.roomTypeId, query.roomTypeId))
    if (query.active !== undefined) conditions.push(eq(stayRules.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(stayRules)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(stayRules.priority), asc(stayRules.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(stayRules).where(where),
      query.limit,
      query.offset,
    )
  },

  async getStayRuleById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(stayRules).where(eq(stayRules.id, id)).limit(1)
    return row ?? null
  },

  async createStayRule(db: PostgresJsDatabase, data: CreateStayRuleInput) {
    const [row] = await db.insert(stayRules).values(data).returning()
    return row ?? null
  },

  async updateStayRule(db: PostgresJsDatabase, id: string, data: UpdateStayRuleInput) {
    const [row] = await db
      .update(stayRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stayRules.id, id))
      .returning()
    return row ?? null
  },

  async deleteStayRule(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(stayRules)
      .where(eq(stayRules.id, id))
      .returning({ id: stayRules.id })
    return row ?? null
  },

  async listRoomInventory(db: PostgresJsDatabase, query: RoomInventoryListQuery) {
    const conditions = []
    if (query.propertyId) conditions.push(eq(roomInventory.propertyId, query.propertyId))
    if (query.roomTypeId) conditions.push(eq(roomInventory.roomTypeId, query.roomTypeId))
    if (query.stopSell !== undefined) conditions.push(eq(roomInventory.stopSell, query.stopSell))
    if (query.dateFrom) conditions.push(gte(roomInventory.date, query.dateFrom))
    if (query.dateTo) conditions.push(lte(roomInventory.date, query.dateTo))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(roomInventory)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(roomInventory.date)),
      db.select({ count: sql<number>`count(*)::int` }).from(roomInventory).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRoomInventoryById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(roomInventory).where(eq(roomInventory.id, id)).limit(1)
    return row ?? null
  },

  async createRoomInventory(db: PostgresJsDatabase, data: CreateRoomInventoryInput) {
    const [row] = await db.insert(roomInventory).values(data).returning()
    return row ?? null
  },

  async updateRoomInventory(db: PostgresJsDatabase, id: string, data: UpdateRoomInventoryInput) {
    const [row] = await db
      .update(roomInventory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roomInventory.id, id))
      .returning()
    return row ?? null
  },

  async deleteRoomInventory(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(roomInventory)
      .where(eq(roomInventory.id, id))
      .returning({ id: roomInventory.id })
    return row ?? null
  },

  async listRatePlanInventoryOverrides(
    db: PostgresJsDatabase,
    query: RatePlanInventoryOverrideListQuery,
  ) {
    const conditions = []
    if (query.ratePlanId)
      conditions.push(eq(ratePlanInventoryOverrides.ratePlanId, query.ratePlanId))
    if (query.roomTypeId)
      conditions.push(eq(ratePlanInventoryOverrides.roomTypeId, query.roomTypeId))
    if (query.dateFrom) conditions.push(gte(ratePlanInventoryOverrides.date, query.dateFrom))
    if (query.dateTo) conditions.push(lte(ratePlanInventoryOverrides.date, query.dateTo))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(ratePlanInventoryOverrides)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(ratePlanInventoryOverrides.date)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ratePlanInventoryOverrides)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getRatePlanInventoryOverrideById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(ratePlanInventoryOverrides)
      .where(eq(ratePlanInventoryOverrides.id, id))
      .limit(1)
    return row ?? null
  },

  async createRatePlanInventoryOverride(
    db: PostgresJsDatabase,
    data: CreateRatePlanInventoryOverrideInput,
  ) {
    const [row] = await db.insert(ratePlanInventoryOverrides).values(data).returning()
    return row ?? null
  },

  async updateRatePlanInventoryOverride(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateRatePlanInventoryOverrideInput,
  ) {
    const [row] = await db
      .update(ratePlanInventoryOverrides)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ratePlanInventoryOverrides.id, id))
      .returning()
    return row ?? null
  },

  async deleteRatePlanInventoryOverride(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(ratePlanInventoryOverrides)
      .where(eq(ratePlanInventoryOverrides.id, id))
      .returning({ id: ratePlanInventoryOverrides.id })
    return row ?? null
  },

  async listRoomTypeRates(db: PostgresJsDatabase, query: RoomTypeRateListQuery) {
    const conditions = []
    if (query.ratePlanId) conditions.push(eq(roomTypeRates.ratePlanId, query.ratePlanId))
    if (query.roomTypeId) conditions.push(eq(roomTypeRates.roomTypeId, query.roomTypeId))
    if (query.priceScheduleId)
      conditions.push(eq(roomTypeRates.priceScheduleId, query.priceScheduleId))
    if (query.active !== undefined) conditions.push(eq(roomTypeRates.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(roomTypeRates)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(roomTypeRates.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(roomTypeRates).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRoomTypeRateById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(roomTypeRates).where(eq(roomTypeRates.id, id)).limit(1)
    return row ?? null
  },

  async createRoomTypeRate(db: PostgresJsDatabase, data: CreateRoomTypeRateInput) {
    const [row] = await db.insert(roomTypeRates).values(data).returning()
    return row ?? null
  },

  async updateRoomTypeRate(db: PostgresJsDatabase, id: string, data: UpdateRoomTypeRateInput) {
    const [row] = await db
      .update(roomTypeRates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roomTypeRates.id, id))
      .returning()
    return row ?? null
  },

  async deleteRoomTypeRate(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(roomTypeRates)
      .where(eq(roomTypeRates.id, id))
      .returning({ id: roomTypeRates.id })
    return row ?? null
  },

  async listStayBookingItems(db: PostgresJsDatabase, query: StayBookingItemListQuery) {
    const conditions = []
    if (query.bookingItemId)
      conditions.push(eq(stayBookingItems.bookingItemId, query.bookingItemId))
    if (query.propertyId) conditions.push(eq(stayBookingItems.propertyId, query.propertyId))
    if (query.roomTypeId) conditions.push(eq(stayBookingItems.roomTypeId, query.roomTypeId))
    if (query.roomUnitId) conditions.push(eq(stayBookingItems.roomUnitId, query.roomUnitId))
    if (query.ratePlanId) conditions.push(eq(stayBookingItems.ratePlanId, query.ratePlanId))
    if (query.status) conditions.push(eq(stayBookingItems.status, query.status))
    if (query.dateFrom) conditions.push(gte(stayBookingItems.checkInDate, query.dateFrom))
    if (query.dateTo) conditions.push(lte(stayBookingItems.checkOutDate, query.dateTo))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(stayBookingItems)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(stayBookingItems.checkInDate)),
      db.select({ count: sql<number>`count(*)::int` }).from(stayBookingItems).where(where),
      query.limit,
      query.offset,
    )
  },

  async getStayBookingItemById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(stayBookingItems)
      .where(eq(stayBookingItems.id, id))
      .limit(1)
    return row ?? null
  },

  async createStayBookingItem(db: PostgresJsDatabase, data: CreateStayBookingItemInput) {
    const [row] = await db.insert(stayBookingItems).values(data).returning()
    return row ?? null
  },

  async updateStayBookingItem(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateStayBookingItemInput,
  ) {
    const [row] = await db
      .update(stayBookingItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stayBookingItems.id, id))
      .returning()
    return row ?? null
  },

  async deleteStayBookingItem(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(stayBookingItems)
      .where(eq(stayBookingItems.id, id))
      .returning({ id: stayBookingItems.id })
    return row ?? null
  },

  async listStayDailyRates(db: PostgresJsDatabase, query: StayDailyRateListQuery) {
    const conditions = []
    if (query.stayBookingItemId)
      conditions.push(eq(stayDailyRates.stayBookingItemId, query.stayBookingItemId))
    if (query.dateFrom) conditions.push(gte(stayDailyRates.date, query.dateFrom))
    if (query.dateTo) conditions.push(lte(stayDailyRates.date, query.dateTo))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(stayDailyRates)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(stayDailyRates.date)),
      db.select({ count: sql<number>`count(*)::int` }).from(stayDailyRates).where(where),
      query.limit,
      query.offset,
    )
  },

  async getStayDailyRateById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(stayDailyRates).where(eq(stayDailyRates.id, id)).limit(1)
    return row ?? null
  },

  async createStayDailyRate(db: PostgresJsDatabase, data: CreateStayDailyRateInput) {
    const [row] = await db.insert(stayDailyRates).values(data).returning()
    return row ?? null
  },

  async updateStayDailyRate(db: PostgresJsDatabase, id: string, data: UpdateStayDailyRateInput) {
    const [row] = await db
      .update(stayDailyRates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stayDailyRates.id, id))
      .returning()
    return row ?? null
  },

  async deleteStayDailyRate(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(stayDailyRates)
      .where(eq(stayDailyRates.id, id))
      .returning({ id: stayDailyRates.id })
    return row ?? null
  },

  async listRoomBlocks(db: PostgresJsDatabase, query: RoomBlockListQuery) {
    const conditions = []
    if (query.propertyId) conditions.push(eq(roomBlocks.propertyId, query.propertyId))
    if (query.roomTypeId) conditions.push(eq(roomBlocks.roomTypeId, query.roomTypeId))
    if (query.roomUnitId) conditions.push(eq(roomBlocks.roomUnitId, query.roomUnitId))
    if (query.status) conditions.push(eq(roomBlocks.status, query.status))
    if (query.startsOn) conditions.push(gte(roomBlocks.startsOn, query.startsOn))
    if (query.endsOn) conditions.push(lte(roomBlocks.endsOn, query.endsOn))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(roomBlocks)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(roomBlocks.startsOn)),
      db.select({ count: sql<number>`count(*)::int` }).from(roomBlocks).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRoomBlockById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(roomBlocks).where(eq(roomBlocks.id, id)).limit(1)
    return row ?? null
  },

  async createRoomBlock(db: PostgresJsDatabase, data: CreateRoomBlockInput) {
    const [row] = await db
      .insert(roomBlocks)
      .values({ ...data, releaseAt: toDateOrNull(data.releaseAt) })
      .returning()
    return row ?? null
  },

  async updateRoomBlock(db: PostgresJsDatabase, id: string, data: UpdateRoomBlockInput) {
    const [row] = await db
      .update(roomBlocks)
      .set({ ...data, releaseAt: toDateOrNull(data.releaseAt), updatedAt: new Date() })
      .where(eq(roomBlocks.id, id))
      .returning()
    return row ?? null
  },

  async deleteRoomBlock(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(roomBlocks)
      .where(eq(roomBlocks.id, id))
      .returning({ id: roomBlocks.id })
    return row ?? null
  },

  async listRoomUnitStatusEvents(db: PostgresJsDatabase, query: RoomUnitStatusEventListQuery) {
    const conditions = []
    if (query.roomUnitId) conditions.push(eq(roomUnitStatusEvents.roomUnitId, query.roomUnitId))
    if (query.statusCode) conditions.push(eq(roomUnitStatusEvents.statusCode, query.statusCode))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(roomUnitStatusEvents)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(roomUnitStatusEvents.effectiveFrom)),
      db.select({ count: sql<number>`count(*)::int` }).from(roomUnitStatusEvents).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRoomUnitStatusEventById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(roomUnitStatusEvents)
      .where(eq(roomUnitStatusEvents.id, id))
      .limit(1)
    return row ?? null
  },

  async createRoomUnitStatusEvent(db: PostgresJsDatabase, data: CreateRoomUnitStatusEventInput) {
    const [row] = await db
      .insert(roomUnitStatusEvents)
      .values({
        ...data,
        effectiveFrom: toDateOrNull(data.effectiveFrom) ?? new Date(),
        effectiveTo: toDateOrNull(data.effectiveTo),
      })
      .returning()
    return row ?? null
  },

  async updateRoomUnitStatusEvent(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateRoomUnitStatusEventInput,
  ) {
    const [row] = await db
      .update(roomUnitStatusEvents)
      .set({
        ...data,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
      })
      .where(eq(roomUnitStatusEvents.id, id))
      .returning()
    return row ?? null
  },

  async deleteRoomUnitStatusEvent(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(roomUnitStatusEvents)
      .where(eq(roomUnitStatusEvents.id, id))
      .returning({ id: roomUnitStatusEvents.id })
    return row ?? null
  },

  async listMaintenanceBlocks(db: PostgresJsDatabase, query: MaintenanceBlockListQuery) {
    const conditions = []
    if (query.propertyId) conditions.push(eq(maintenanceBlocks.propertyId, query.propertyId))
    if (query.roomTypeId) conditions.push(eq(maintenanceBlocks.roomTypeId, query.roomTypeId))
    if (query.roomUnitId) conditions.push(eq(maintenanceBlocks.roomUnitId, query.roomUnitId))
    if (query.status) conditions.push(eq(maintenanceBlocks.status, query.status))
    if (query.startsOn) conditions.push(gte(maintenanceBlocks.startsOn, query.startsOn))
    if (query.endsOn) conditions.push(lte(maintenanceBlocks.endsOn, query.endsOn))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(maintenanceBlocks)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(maintenanceBlocks.startsOn)),
      db.select({ count: sql<number>`count(*)::int` }).from(maintenanceBlocks).where(where),
      query.limit,
      query.offset,
    )
  },

  async getMaintenanceBlockById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(maintenanceBlocks)
      .where(eq(maintenanceBlocks.id, id))
      .limit(1)
    return row ?? null
  },

  async createMaintenanceBlock(db: PostgresJsDatabase, data: CreateMaintenanceBlockInput) {
    const [row] = await db.insert(maintenanceBlocks).values(data).returning()
    return row ?? null
  },

  async updateMaintenanceBlock(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateMaintenanceBlockInput,
  ) {
    const [row] = await db
      .update(maintenanceBlocks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(maintenanceBlocks.id, id))
      .returning()
    return row ?? null
  },

  async deleteMaintenanceBlock(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(maintenanceBlocks)
      .where(eq(maintenanceBlocks.id, id))
      .returning({ id: maintenanceBlocks.id })
    return row ?? null
  },

  async listHousekeepingTasks(db: PostgresJsDatabase, query: HousekeepingTaskListQuery) {
    const conditions = []
    if (query.propertyId) conditions.push(eq(housekeepingTasks.propertyId, query.propertyId))
    if (query.roomUnitId) conditions.push(eq(housekeepingTasks.roomUnitId, query.roomUnitId))
    if (query.stayBookingItemId)
      conditions.push(eq(housekeepingTasks.stayBookingItemId, query.stayBookingItemId))
    if (query.status) conditions.push(eq(housekeepingTasks.status, query.status))
    if (query.taskType) conditions.push(eq(housekeepingTasks.taskType, query.taskType))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(housekeepingTasks)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(housekeepingTasks.priority), asc(housekeepingTasks.dueAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(housekeepingTasks).where(where),
      query.limit,
      query.offset,
    )
  },

  async getHousekeepingTaskById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(housekeepingTasks)
      .where(eq(housekeepingTasks.id, id))
      .limit(1)
    return row ?? null
  },

  async createHousekeepingTask(db: PostgresJsDatabase, data: CreateHousekeepingTaskInput) {
    const [row] = await db
      .insert(housekeepingTasks)
      .values({
        ...data,
        dueAt: toDateOrNull(data.dueAt),
        startedAt: toDateOrNull(data.startedAt),
        completedAt: toDateOrNull(data.completedAt),
      })
      .returning()
    return row ?? null
  },

  async updateHousekeepingTask(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateHousekeepingTaskInput,
  ) {
    const [row] = await db
      .update(housekeepingTasks)
      .set({
        ...data,
        dueAt: toDateOrNull(data.dueAt),
        startedAt: toDateOrNull(data.startedAt),
        completedAt: toDateOrNull(data.completedAt),
        updatedAt: new Date(),
      })
      .where(eq(housekeepingTasks.id, id))
      .returning()
    return row ?? null
  },

  async deleteHousekeepingTask(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(housekeepingTasks)
      .where(eq(housekeepingTasks.id, id))
      .returning({ id: housekeepingTasks.id })
    return row ?? null
  },

  async listStayOperations(db: PostgresJsDatabase, query: StayOperationListQuery) {
    const conditions = []
    if (query.stayBookingItemId)
      conditions.push(eq(stayOperations.stayBookingItemId, query.stayBookingItemId))
    if (query.propertyId) conditions.push(eq(stayOperations.propertyId, query.propertyId))
    if (query.roomUnitId) conditions.push(eq(stayOperations.roomUnitId, query.roomUnitId))
    if (query.operationStatus)
      conditions.push(eq(stayOperations.operationStatus, query.operationStatus))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(stayOperations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(stayOperations.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(stayOperations).where(where),
      query.limit,
      query.offset,
    )
  },

  async getStayOperationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(stayOperations).where(eq(stayOperations.id, id)).limit(1)
    return row ?? null
  },

  async createStayOperation(db: PostgresJsDatabase, data: CreateStayOperationInput) {
    const [row] = await db
      .insert(stayOperations)
      .values({
        ...data,
        expectedArrivalAt: toDateOrNull(data.expectedArrivalAt),
        expectedDepartureAt: toDateOrNull(data.expectedDepartureAt),
        checkedInAt: toDateOrNull(data.checkedInAt),
        checkedOutAt: toDateOrNull(data.checkedOutAt),
        noShowRecordedAt: toDateOrNull(data.noShowRecordedAt),
      })
      .returning()
    return row ?? null
  },

  async updateStayOperation(db: PostgresJsDatabase, id: string, data: UpdateStayOperationInput) {
    const [row] = await db
      .update(stayOperations)
      .set({
        ...data,
        expectedArrivalAt: toDateOrNull(data.expectedArrivalAt),
        expectedDepartureAt: toDateOrNull(data.expectedDepartureAt),
        checkedInAt: toDateOrNull(data.checkedInAt),
        checkedOutAt: toDateOrNull(data.checkedOutAt),
        noShowRecordedAt: toDateOrNull(data.noShowRecordedAt),
        updatedAt: new Date(),
      })
      .where(eq(stayOperations.id, id))
      .returning()
    return row ?? null
  },

  async deleteStayOperation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(stayOperations)
      .where(eq(stayOperations.id, id))
      .returning({ id: stayOperations.id })
    return row ?? null
  },

  async listStayCheckpoints(db: PostgresJsDatabase, query: StayCheckpointListQuery) {
    const conditions = []
    if (query.stayOperationId)
      conditions.push(eq(stayCheckpoints.stayOperationId, query.stayOperationId))
    if (query.checkpointType)
      conditions.push(eq(stayCheckpoints.checkpointType, query.checkpointType))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(stayCheckpoints)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(stayCheckpoints.occurredAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(stayCheckpoints).where(where),
      query.limit,
      query.offset,
    )
  },

  async getStayCheckpointById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(stayCheckpoints).where(eq(stayCheckpoints.id, id)).limit(1)
    return row ?? null
  },

  async createStayCheckpoint(db: PostgresJsDatabase, data: CreateStayCheckpointInput) {
    const [row] = await db
      .insert(stayCheckpoints)
      .values({ ...data, occurredAt: toDateOrNull(data.occurredAt) ?? new Date() })
      .returning()
    return row ?? null
  },

  async updateStayCheckpoint(db: PostgresJsDatabase, id: string, data: UpdateStayCheckpointInput) {
    const [row] = await db
      .update(stayCheckpoints)
      .set({
        ...data,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : undefined,
      })
      .where(eq(stayCheckpoints.id, id))
      .returning()
    return row ?? null
  },

  async deleteStayCheckpoint(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(stayCheckpoints)
      .where(eq(stayCheckpoints.id, id))
      .returning({ id: stayCheckpoints.id })
    return row ?? null
  },

  async listStayServicePosts(db: PostgresJsDatabase, query: StayServicePostListQuery) {
    const conditions = []
    if (query.stayOperationId)
      conditions.push(eq(stayServicePosts.stayOperationId, query.stayOperationId))
    if (query.bookingItemId)
      conditions.push(eq(stayServicePosts.bookingItemId, query.bookingItemId))
    if (query.kind) conditions.push(eq(stayServicePosts.kind, query.kind))
    if (query.serviceDateFrom)
      conditions.push(gte(stayServicePosts.serviceDate, query.serviceDateFrom))
    if (query.serviceDateTo) conditions.push(lte(stayServicePosts.serviceDate, query.serviceDateTo))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(stayServicePosts)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(stayServicePosts.serviceDate)),
      db.select({ count: sql<number>`count(*)::int` }).from(stayServicePosts).where(where),
      query.limit,
      query.offset,
    )
  },

  async getStayServicePostById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(stayServicePosts)
      .where(eq(stayServicePosts.id, id))
      .limit(1)
    return row ?? null
  },

  async createStayServicePost(db: PostgresJsDatabase, data: CreateStayServicePostInput) {
    const [row] = await db.insert(stayServicePosts).values(data).returning()
    return row ?? null
  },

  async updateStayServicePost(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateStayServicePostInput,
  ) {
    const [row] = await db
      .update(stayServicePosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stayServicePosts.id, id))
      .returning()
    return row ?? null
  },

  async deleteStayServicePost(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(stayServicePosts)
      .where(eq(stayServicePosts.id, id))
      .returning({ id: stayServicePosts.id })
    return row ?? null
  },

  async listStayFolios(db: PostgresJsDatabase, query: StayFolioListQuery) {
    const conditions = []
    if (query.stayOperationId)
      conditions.push(eq(stayFolios.stayOperationId, query.stayOperationId))
    if (query.status) conditions.push(eq(stayFolios.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(stayFolios)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(stayFolios.openedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(stayFolios).where(where),
      query.limit,
      query.offset,
    )
  },

  async getStayFolioById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(stayFolios).where(eq(stayFolios.id, id)).limit(1)
    return row ?? null
  },

  async createStayFolio(db: PostgresJsDatabase, data: CreateStayFolioInput) {
    const [row] = await db
      .insert(stayFolios)
      .values({
        ...data,
        openedAt: toDateOrNull(data.openedAt) ?? new Date(),
        closedAt: toDateOrNull(data.closedAt),
      })
      .returning()
    return row ?? null
  },

  async updateStayFolio(db: PostgresJsDatabase, id: string, data: UpdateStayFolioInput) {
    const [row] = await db
      .update(stayFolios)
      .set({
        ...data,
        openedAt: data.openedAt ? new Date(data.openedAt) : undefined,
        closedAt: data.closedAt ? new Date(data.closedAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(stayFolios.id, id))
      .returning()
    return row ?? null
  },

  async deleteStayFolio(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(stayFolios)
      .where(eq(stayFolios.id, id))
      .returning({ id: stayFolios.id })
    return row ?? null
  },

  async listStayFolioLines(db: PostgresJsDatabase, query: StayFolioLineListQuery) {
    const conditions = []
    if (query.stayFolioId) conditions.push(eq(stayFolioLines.stayFolioId, query.stayFolioId))
    if (query.servicePostId) conditions.push(eq(stayFolioLines.servicePostId, query.servicePostId))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(stayFolioLines)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(stayFolioLines.postedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(stayFolioLines).where(where),
      query.limit,
      query.offset,
    )
  },

  async getStayFolioLineById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(stayFolioLines).where(eq(stayFolioLines.id, id)).limit(1)
    return row ?? null
  },

  async createStayFolioLine(db: PostgresJsDatabase, data: CreateStayFolioLineInput) {
    const [row] = await db
      .insert(stayFolioLines)
      .values({ ...data, postedAt: toDateOrNull(data.postedAt) ?? new Date() })
      .returning()
    return row ?? null
  },

  async updateStayFolioLine(db: PostgresJsDatabase, id: string, data: UpdateStayFolioLineInput) {
    const [row] = await db
      .update(stayFolioLines)
      .set({
        ...data,
        postedAt: data.postedAt ? new Date(data.postedAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(stayFolioLines.id, id))
      .returning()
    return row ?? null
  },

  async deleteStayFolioLine(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(stayFolioLines)
      .where(eq(stayFolioLines.id, id))
      .returning({ id: stayFolioLines.id })
    return row ?? null
  },
}
