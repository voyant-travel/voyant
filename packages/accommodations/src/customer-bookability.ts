import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq, exists, gt, gte, inArray, sql } from "drizzle-orm"

import {
  ratePlanDailyRates,
  ratePlanRoomTypes,
  ratePlans,
  roomTypeDailyInventory,
  type roomTypes,
} from "./schema-inventory.js"

type RoomTypeRow = typeof roomTypes.$inferSelect

export function currentDateIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function isCustomerRoomTypeBookable(
  db: AnyDrizzleDb,
  row: RoomTypeRow,
  asOfDate: string = currentDateIso(),
): Promise<boolean> {
  if (!row.active) return false

  const mappedRatePlans = await db
    .select()
    .from(ratePlanRoomTypes)
    .where(and(eq(ratePlanRoomTypes.roomTypeId, row.id), eq(ratePlanRoomTypes.active, true)))
    .limit(50)
  const mappedRatePlanIds = mappedRatePlans
    .filter((mapping) => mapping.roomTypeId === row.id && mapping.active)
    .map((mapping) => mapping.ratePlanId)
  if (mappedRatePlanIds.length === 0) return false

  const activeRatePlans = await db
    .select()
    .from(ratePlans)
    .where(and(inArray(ratePlans.id, mappedRatePlanIds), eq(ratePlans.active, true)))
    .limit(50)
  const activeRatePlanIds = activeRatePlans
    .filter((plan) => mappedRatePlanIds.includes(plan.id) && plan.active)
    .map((plan) => plan.id)
  if (activeRatePlanIds.length === 0) return false

  const openInventory = await db
    .select()
    .from(roomTypeDailyInventory)
    .where(
      and(
        eq(roomTypeDailyInventory.roomTypeId, row.id),
        gte(roomTypeDailyInventory.date, asOfDate),
        eq(roomTypeDailyInventory.closed, false),
        gt(roomTypeDailyInventory.capacity, 0),
        exists(
          db
            .select({ one: sql`1` })
            .from(ratePlanDailyRates)
            .where(
              and(
                eq(ratePlanDailyRates.roomTypeId, row.id),
                inArray(ratePlanDailyRates.ratePlanId, activeRatePlanIds),
                eq(ratePlanDailyRates.date, roomTypeDailyInventory.date),
                gte(ratePlanDailyRates.date, asOfDate),
                gt(ratePlanDailyRates.sellAmountCents, 0),
              ),
            ),
        ),
      ),
    )
    .limit(1)
  const openInventoryDate = openInventory.find(
    (inventory) =>
      inventory.roomTypeId === row.id &&
      inventory.date >= asOfDate &&
      !inventory.closed &&
      inventory.capacity > 0,
  )?.date
  if (!openInventoryDate) return false

  const matchingPricedDates = await db
    .select()
    .from(ratePlanDailyRates)
    .where(
      and(
        eq(ratePlanDailyRates.roomTypeId, row.id),
        inArray(ratePlanDailyRates.ratePlanId, activeRatePlanIds),
        eq(ratePlanDailyRates.date, openInventoryDate),
        gt(ratePlanDailyRates.sellAmountCents, 0),
      ),
    )
    .limit(1)
  return matchingPricedDates.some(
    (rate) =>
      rate.roomTypeId === row.id &&
      activeRatePlanIds.includes(rate.ratePlanId) &&
      rate.date === openInventoryDate &&
      rate.sellAmountCents > 0,
  )
}
