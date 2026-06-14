import {
  departurePriceOverrides,
  dropoffPriceRules,
  extraPriceRules,
  optionPriceRules,
  optionStartTimeRules,
  optionUnitPriceRules,
  optionUnitTiers,
  pickupPriceRules,
} from "@voyant-travel/commerce"
import {
  availabilityRules,
  availabilitySlots,
  availabilityStartTimes,
} from "@voyant-travel/operations"
import { eq, inArray } from "drizzle-orm"
import { type CloneContext, withoutSystemColumns } from "./clone-content.js"

/**
 * Copies availability (when `copyDepartures`) and the full pricing-rule graph —
 * option price rules → unit price rules (with remapped pricing categories) →
 * tiers, plus start-time / pickup / dropoff / extra rules and departure
 * overrides. Relies on the id remaps populated by {@link copyProductContent}.
 */
export async function copyPricingAndAvailability(ctx: CloneContext): Promise<void> {
  if (ctx.copyDepartures) {
    await copyAvailability(ctx)
  }
  await copyPriceRules(ctx)
  if (ctx.copyDepartures && ctx.slotIdMap.size > 0) {
    await copyDepartureOverrides(ctx)
  }
}

async function copyAvailability(ctx: CloneContext): Promise<void> {
  const {
    tx,
    sourceId,
    targetId,
    optionIdMap,
    itineraryIdMap,
    startTimeIdMap,
    ruleIdMap,
    slotIdMap,
  } = ctx

  const startTimeRows = await tx
    .select()
    .from(availabilityStartTimes)
    .where(eq(availabilityStartTimes.productId, sourceId))
  for (const row of startTimeRows) {
    const [copy] = await tx
      .insert(availabilityStartTimes)
      .values({
        ...withoutSystemColumns(row),
        productId: targetId,
        optionId: row.optionId ? (optionIdMap.get(row.optionId) ?? null) : null,
      })
      .returning()
    if (copy) startTimeIdMap.set(row.id, copy.id)
  }

  const availabilityRuleRows = await tx
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.productId, sourceId))
  for (const row of availabilityRuleRows) {
    const [copy] = await tx
      .insert(availabilityRules)
      .values({
        ...withoutSystemColumns(row),
        productId: targetId,
        optionId: row.optionId ? (optionIdMap.get(row.optionId) ?? null) : null,
      })
      .returning()
    if (copy) ruleIdMap.set(row.id, copy.id)
  }

  const slotRows = await tx
    .select()
    .from(availabilitySlots)
    .where(eq(availabilitySlots.productId, sourceId))
  for (const row of slotRows) {
    const targetItineraryId = row.itineraryId ? (itineraryIdMap.get(row.itineraryId) ?? null) : null
    const targetOptionId = row.optionId ? (optionIdMap.get(row.optionId) ?? null) : null
    const targetRuleId = row.availabilityRuleId
      ? (ruleIdMap.get(row.availabilityRuleId) ?? null)
      : null
    const targetStartTimeId = row.startTimeId ? (startTimeIdMap.get(row.startTimeId) ?? null) : null
    const [copy] = await tx
      .insert(availabilitySlots)
      .values({
        ...withoutSystemColumns(row),
        productId: targetId,
        itineraryId: targetItineraryId,
        optionId: targetOptionId,
        availabilityRuleId: targetRuleId,
        startTimeId: targetStartTimeId,
        remainingPax: row.initialPax,
        remainingPickups: row.initialPickups,
      })
      .returning()
    if (copy) slotIdMap.set(row.id, copy.id)
  }
}

async function copyPriceRules(ctx: CloneContext): Promise<void> {
  const {
    tx,
    targetId,
    optionIdMap,
    unitIdMap,
    startTimeIdMap,
    optionPriceRuleIdMap,
    optionUnitPriceRuleIdMap,
    pricingCategoryIdMap,
    productExtraIdMap,
    optionExtraConfigIdMap,
  } = ctx

  const sourceOptionIds = [...optionIdMap.keys()]
  if (sourceOptionIds.length === 0) return

  const optionPriceRuleRows = await tx
    .select()
    .from(optionPriceRules)
    .where(inArray(optionPriceRules.optionId, sourceOptionIds))
  for (const row of optionPriceRuleRows) {
    const targetOptionId = optionIdMap.get(row.optionId)
    if (!targetOptionId) continue
    const [copy] = await tx
      .insert(optionPriceRules)
      .values({ ...withoutSystemColumns(row), productId: targetId, optionId: targetOptionId })
      .returning()
    if (copy) optionPriceRuleIdMap.set(row.id, copy.id)
  }

  const sourceOptionPriceRuleIds = optionPriceRuleRows.map((row) => row.id)
  if (sourceOptionPriceRuleIds.length === 0) return

  const optionUnitPriceRuleRows = await tx
    .select()
    .from(optionUnitPriceRules)
    .where(inArray(optionUnitPriceRules.optionPriceRuleId, sourceOptionPriceRuleIds))
  for (const row of optionUnitPriceRuleRows) {
    const targetPriceRuleId = optionPriceRuleIdMap.get(row.optionPriceRuleId)
    const targetOptionId = optionIdMap.get(row.optionId)
    const targetUnitId = unitIdMap.get(row.unitId)
    const targetPricingCategoryId = row.pricingCategoryId
      ? (pricingCategoryIdMap.get(row.pricingCategoryId) ?? null)
      : null
    if (!targetPriceRuleId || !targetOptionId || !targetUnitId) continue
    if (row.pricingCategoryId && !targetPricingCategoryId) continue
    const [copy] = await tx
      .insert(optionUnitPriceRules)
      .values({
        ...withoutSystemColumns(row),
        optionPriceRuleId: targetPriceRuleId,
        optionId: targetOptionId,
        unitId: targetUnitId,
        pricingCategoryId: targetPricingCategoryId,
      })
      .returning()
    if (copy) optionUnitPriceRuleIdMap.set(row.id, copy.id)
  }

  const sourceOptionUnitPriceRuleIds = optionUnitPriceRuleRows.map((row) => row.id)
  if (sourceOptionUnitPriceRuleIds.length > 0) {
    const tierRows = await tx
      .select()
      .from(optionUnitTiers)
      .where(inArray(optionUnitTiers.optionUnitPriceRuleId, sourceOptionUnitPriceRuleIds))
    for (const row of tierRows) {
      const targetUnitPriceRuleId = optionUnitPriceRuleIdMap.get(row.optionUnitPriceRuleId)
      if (!targetUnitPriceRuleId) continue
      await tx
        .insert(optionUnitTiers)
        .values({ ...withoutSystemColumns(row), optionUnitPriceRuleId: targetUnitPriceRuleId })
    }
  }

  const startRuleRows = await tx
    .select()
    .from(optionStartTimeRules)
    .where(inArray(optionStartTimeRules.optionPriceRuleId, sourceOptionPriceRuleIds))
  for (const row of startRuleRows) {
    const targetPriceRuleId = optionPriceRuleIdMap.get(row.optionPriceRuleId)
    const targetOptionId = optionIdMap.get(row.optionId)
    const targetStartTimeId = startTimeIdMap.get(row.startTimeId)
    if (!targetPriceRuleId || !targetOptionId || !targetStartTimeId) continue
    await tx.insert(optionStartTimeRules).values({
      ...withoutSystemColumns(row),
      optionPriceRuleId: targetPriceRuleId,
      optionId: targetOptionId,
      startTimeId: targetStartTimeId,
    })
  }

  const pickupPriceRuleRows = await tx
    .select()
    .from(pickupPriceRules)
    .where(inArray(pickupPriceRules.optionPriceRuleId, sourceOptionPriceRuleIds))
  for (const row of pickupPriceRuleRows) {
    const targetPriceRuleId = optionPriceRuleIdMap.get(row.optionPriceRuleId)
    const targetOptionId = optionIdMap.get(row.optionId)
    if (!targetPriceRuleId || !targetOptionId) continue
    await tx.insert(pickupPriceRules).values({
      ...withoutSystemColumns(row),
      optionPriceRuleId: targetPriceRuleId,
      optionId: targetOptionId,
    })
  }

  const dropoffPriceRuleRows = await tx
    .select()
    .from(dropoffPriceRules)
    .where(inArray(dropoffPriceRules.optionPriceRuleId, sourceOptionPriceRuleIds))
  for (const row of dropoffPriceRuleRows) {
    const targetPriceRuleId = optionPriceRuleIdMap.get(row.optionPriceRuleId)
    const targetOptionId = optionIdMap.get(row.optionId)
    if (!targetPriceRuleId || !targetOptionId) continue
    await tx.insert(dropoffPriceRules).values({
      ...withoutSystemColumns(row),
      optionPriceRuleId: targetPriceRuleId,
      optionId: targetOptionId,
    })
  }

  const extraPriceRuleRows = await tx
    .select()
    .from(extraPriceRules)
    .where(inArray(extraPriceRules.optionPriceRuleId, sourceOptionPriceRuleIds))
  for (const row of extraPriceRuleRows) {
    const targetPriceRuleId = optionPriceRuleIdMap.get(row.optionPriceRuleId)
    const targetOptionId = optionIdMap.get(row.optionId)
    const targetProductExtraId = row.productExtraId
      ? (productExtraIdMap.get(row.productExtraId) ?? null)
      : null
    const targetOptionExtraConfigId = row.optionExtraConfigId
      ? (optionExtraConfigIdMap.get(row.optionExtraConfigId) ?? null)
      : null
    if (!targetPriceRuleId || !targetOptionId) continue
    if (row.productExtraId && !targetProductExtraId) continue
    if (row.optionExtraConfigId && !targetOptionExtraConfigId) continue
    await tx.insert(extraPriceRules).values({
      ...withoutSystemColumns(row),
      optionPriceRuleId: targetPriceRuleId,
      optionId: targetOptionId,
      productExtraId: targetProductExtraId,
      optionExtraConfigId: targetOptionExtraConfigId,
    })
  }
}

async function copyDepartureOverrides(ctx: CloneContext): Promise<void> {
  const { tx, optionIdMap, unitIdMap, slotIdMap } = ctx
  const overrideRows = await tx
    .select()
    .from(departurePriceOverrides)
    .where(inArray(departurePriceOverrides.departureId, [...slotIdMap.keys()]))
  for (const row of overrideRows) {
    const targetDepartureId = slotIdMap.get(row.departureId)
    const targetOptionId = optionIdMap.get(row.optionId)
    const targetUnitId = unitIdMap.get(row.optionUnitId)
    if (!targetDepartureId || !targetOptionId || !targetUnitId) continue
    await tx.insert(departurePriceOverrides).values({
      ...withoutSystemColumns(row),
      departureId: targetDepartureId,
      optionId: targetOptionId,
      optionUnitId: targetUnitId,
    })
  }
}
