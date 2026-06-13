// agent-quality: file-size exception -- owner: sellability; resolve remains a single pricing/sellability workflow after #1734 split the surrounding service operations.
import { availabilitySlots } from "@voyantjs/availability/schema"
import {
  channelInventoryAllotments,
  channelInventoryAllotmentTargets,
  channelInventoryReleaseRules,
  channels,
} from "@voyantjs/distribution/schema"
import {
  exchangeRates,
  fxRateSets,
  marketChannelRules,
  marketPriceCatalogs,
  marketProductRules,
  markets,
} from "@voyantjs/markets/schema"
import {
  departurePriceOverrides,
  optionPriceRules,
  optionStartTimeRules,
  optionUnitPriceRules,
  optionUnitTiers,
  pickupPriceRules,
  priceCatalogs,
  priceSchedules,
  pricingCategories,
} from "@voyantjs/pricing/schema"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  applyAdjustment,
  chooseBestScheduledRule,
  chooseBestSpecificRule,
  computeUnitAmounts,
  type ResolvedPriceBreakdown,
  type ResolvedPriceComponent,
  type SellabilityResolveQuery,
  scheduleMatches,
  toNumeric,
} from "./service-shared.js"

export async function resolve(db: PostgresJsDatabase, query: SellabilityResolveQuery) {
  const optionConditions = [eq(products.status, "active"), eq(productOptions.status, "active")]
  if (query.productId) optionConditions.push(eq(products.id, query.productId))
  if (query.optionId) optionConditions.push(eq(productOptions.id, query.optionId))

  const optionRows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productSellCurrency: products.sellCurrency,
      optionId: productOptions.id,
      optionName: productOptions.name,
      optionCode: productOptions.code,
      optionIsDefault: productOptions.isDefault,
      optionAvailableFrom: productOptions.availableFrom,
      optionAvailableTo: productOptions.availableTo,
    })
    .from(productOptions)
    .innerJoin(products, eq(productOptions.productId, products.id))
    .where(and(...optionConditions))
    .orderBy(asc(products.name), asc(productOptions.sortOrder))

  if (optionRows.length === 0) {
    return { data: [], meta: { total: 0 } }
  }

  const optionIds = optionRows.map((row) => row.optionId)
  const productIds = [...new Set(optionRows.map((row) => row.productId))]

  const slotConditions = [
    inArray(availabilitySlots.optionId, optionIds),
    eq(availabilitySlots.status, "open"),
  ]
  if (query.slotId) slotConditions.push(eq(availabilitySlots.id, query.slotId))
  if (query.dateLocal) slotConditions.push(eq(availabilitySlots.dateLocal, query.dateLocal))
  if (query.startTimeId) slotConditions.push(eq(availabilitySlots.startTimeId, query.startTimeId))

  const slots = await db
    .select({
      id: availabilitySlots.id,
      productId: availabilitySlots.productId,
      optionId: availabilitySlots.optionId,
      startTimeId: availabilitySlots.startTimeId,
      dateLocal: availabilitySlots.dateLocal,
      startsAt: availabilitySlots.startsAt,
      timezone: availabilitySlots.timezone,
      unlimited: availabilitySlots.unlimited,
      remainingPax: availabilitySlots.remainingPax,
      remainingPickups: availabilitySlots.remainingPickups,
      pastCutoff: availabilitySlots.pastCutoff,
      tooEarly: availabilitySlots.tooEarly,
    })
    .from(availabilitySlots)
    .where(and(...slotConditions))
    .orderBy(asc(availabilitySlots.startsAt))
    .limit(query.limit)

  const startTimeIds = [
    ...new Set(slots.flatMap((slot) => (slot.startTimeId ? [slot.startTimeId] : []))),
  ]
  const slotIds = slots.map((slot) => slot.id)

  const [
    marketRow,
    channelRow,
    marketProductRuleRows,
    marketChannelRuleRows,
    marketCatalogRows,
    catalogRows,
    optionPriceRuleRows,
    optionScheduleRows,
    unitPriceRuleRows,
    unitTierRows,
    unitRows,
    pricingCategoryRows,
    startTimeRuleRows,
    pickupRuleRows,
    allotmentRows,
    allotmentTargetRows,
    releaseRuleRows,
    exchangeRateRow,
    departureOverrideRows,
  ] = await Promise.all([
    query.marketId
      ? db
          .select()
          .from(markets)
          .where(eq(markets.id, query.marketId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    query.channelId
      ? db
          .select({ id: channels.id, kind: channels.kind })
          .from(channels)
          .where(eq(channels.id, query.channelId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    query.marketId
      ? db
          .select()
          .from(marketProductRules)
          .where(
            and(
              eq(marketProductRules.marketId, query.marketId),
              eq(marketProductRules.active, true),
              inArray(marketProductRules.productId, productIds),
            ),
          )
      : Promise.resolve([]),
    query.marketId && query.channelId
      ? db
          .select()
          .from(marketChannelRules)
          .where(
            and(
              eq(marketChannelRules.marketId, query.marketId),
              eq(marketChannelRules.channelId, query.channelId),
              eq(marketChannelRules.active, true),
            ),
          )
      : Promise.resolve([]),
    query.marketId
      ? db
          .select({
            id: marketPriceCatalogs.id,
            marketId: marketPriceCatalogs.marketId,
            priceCatalogId: marketPriceCatalogs.priceCatalogId,
            isDefault: marketPriceCatalogs.isDefault,
            priority: marketPriceCatalogs.priority,
            active: marketPriceCatalogs.active,
          })
          .from(marketPriceCatalogs)
          .where(
            and(
              eq(marketPriceCatalogs.marketId, query.marketId),
              eq(marketPriceCatalogs.active, true),
            ),
          )
      : Promise.resolve([]),
    db
      .select({ id: priceCatalogs.id, currencyCode: priceCatalogs.currencyCode })
      .from(priceCatalogs),
    db
      .select()
      .from(optionPriceRules)
      .where(and(inArray(optionPriceRules.optionId, optionIds), eq(optionPriceRules.active, true))),
    db.select().from(priceSchedules),
    db
      .select()
      .from(optionUnitPriceRules)
      .where(
        and(
          inArray(optionUnitPriceRules.optionId, optionIds),
          eq(optionUnitPriceRules.active, true),
        ),
      ),
    db.select().from(optionUnitTiers).where(eq(optionUnitTiers.active, true)),
    db
      .select({ id: optionUnits.id, name: optionUnits.name, unitType: optionUnits.unitType })
      .from(optionUnits),
    db
      .select({ id: pricingCategories.id, name: pricingCategories.name })
      .from(pricingCategories)
      .where(eq(pricingCategories.active, true)),
    startTimeIds.length
      ? db
          .select()
          .from(optionStartTimeRules)
          .where(
            and(
              inArray(optionStartTimeRules.optionId, optionIds),
              inArray(optionStartTimeRules.startTimeId, startTimeIds),
              eq(optionStartTimeRules.active, true),
            ),
          )
      : Promise.resolve([]),
    query.pickupPointId
      ? db
          .select()
          .from(pickupPriceRules)
          .where(
            and(
              inArray(pickupPriceRules.optionId, optionIds),
              eq(pickupPriceRules.pickupPointId, query.pickupPointId),
              eq(pickupPriceRules.active, true),
            ),
          )
      : Promise.resolve([]),
    query.channelId
      ? db
          .select()
          .from(channelInventoryAllotments)
          .where(
            and(
              eq(channelInventoryAllotments.channelId, query.channelId),
              eq(channelInventoryAllotments.active, true),
              inArray(channelInventoryAllotments.productId, productIds),
            ),
          )
      : Promise.resolve([]),
    query.channelId && slotIds.length
      ? db
          .select()
          .from(channelInventoryAllotmentTargets)
          .where(
            and(
              inArray(channelInventoryAllotmentTargets.slotId, slotIds),
              eq(channelInventoryAllotmentTargets.active, true),
            ),
          )
      : Promise.resolve([]),
    query.channelId ? db.select().from(channelInventoryReleaseRules) : Promise.resolve([]),
    query.currencyCode
      ? db
          .select({
            rateDecimal: exchangeRates.rateDecimal,
            baseCurrency: exchangeRates.baseCurrency,
            quoteCurrency: exchangeRates.quoteCurrency,
            fxRateSetId: exchangeRates.fxRateSetId,
            effectiveAt: fxRateSets.effectiveAt,
          })
          .from(exchangeRates)
          .innerJoin(fxRateSets, eq(exchangeRates.fxRateSetId, fxRateSets.id))
          .where(eq(exchangeRates.quoteCurrency, query.currencyCode))
          .orderBy(desc(fxRateSets.effectiveAt))
      : Promise.resolve([]),
    slotIds.length
      ? db
          .select({
            departureId: departurePriceOverrides.departureId,
            priceCatalogId: departurePriceOverrides.priceCatalogId,
            optionUnitId: departurePriceOverrides.optionUnitId,
            sellAmountCents: departurePriceOverrides.sellAmountCents,
            costAmountCents: departurePriceOverrides.costAmountCents,
          })
          .from(departurePriceOverrides)
          .where(
            and(
              inArray(departurePriceOverrides.departureId, slotIds),
              eq(departurePriceOverrides.active, true),
            ),
          )
      : Promise.resolve([]),
  ])

  const optionMap = new Map(optionRows.map((row) => [row.optionId, row]))
  const scheduleMap = new Map(optionScheduleRows.map((row) => [row.id, row]))
  const marketCatalogMap = new Map(marketCatalogRows.map((row) => [row.id, row]))
  const catalogMap = new Map(catalogRows.map((row) => [row.id, row]))
  const unitMap = new Map(unitRows.map((row) => [row.id, row]))
  const pricingCategoryMap = new Map(pricingCategoryRows.map((row) => [row.id, row]))
  const departureOverrideMap = new Map(
    departureOverrideRows.map((row) => [
      `${row.departureId}:${row.priceCatalogId}:${row.optionUnitId}`,
      row,
    ]),
  )

  const candidates = []

  for (const slot of slots) {
    if (!slot.optionId) continue
    const option = optionMap.get(slot.optionId)
    if (!option) continue

    if (option.optionAvailableFrom && slot.dateLocal < option.optionAvailableFrom) continue
    if (option.optionAvailableTo && slot.dateLocal > option.optionAvailableTo) continue
    if (slot.pastCutoff || slot.tooEarly) continue
    if (!slot.unlimited && (slot.remainingPax ?? 0) <= 0) continue

    const marketRule = query.marketId
      ? chooseBestSpecificRule(
          marketProductRuleRows.filter((row) => {
            if (row.productId !== option.productId) return false
            if (row.optionId && row.optionId !== option.optionId) return false
            if (query.dateLocal && row.availableFrom && query.dateLocal < row.availableFrom)
              return false
            if (query.dateLocal && row.availableTo && query.dateLocal > row.availableTo)
              return false
            return true
          }),
        )
      : null

    if (marketRule?.sellability === "unavailable") continue

    const channelRule =
      query.marketId && query.channelId
        ? [...marketChannelRuleRows]
            .sort((a, b) => b.priority - a.priority)
            .find((row) => row.sellability !== "unavailable")
        : null

    if (query.marketId && query.channelId && !channelRule && marketChannelRuleRows.length > 0) {
      continue
    }

    const catalogSelection =
      (channelRule?.priceCatalogId ? marketCatalogMap.get(channelRule.priceCatalogId) : null) ??
      (marketRule?.priceCatalogId ? marketCatalogMap.get(marketRule.priceCatalogId) : null) ??
      [...marketCatalogRows].sort((a, b) => {
        const scoreA = Number(a.isDefault) * 10 - a.priority
        const scoreB = Number(b.isDefault) * 10 - b.priority
        return scoreB - scoreA
      })[0] ??
      null

    const applicableRules = optionPriceRuleRows.filter((row) => {
      if (row.optionId !== option.optionId || row.productId !== option.productId) return false
      if (catalogSelection && row.priceCatalogId !== catalogSelection.priceCatalogId) return false
      const schedule = row.priceScheduleId ? scheduleMap.get(row.priceScheduleId) : null
      return scheduleMatches(
        {
          validFrom: schedule?.validFrom ?? null,
          validTo: schedule?.validTo ?? null,
          weekdays: (schedule?.weekdays as string[] | null | undefined) ?? null,
        },
        slot.dateLocal,
      )
    })

    const chosenRule = chooseBestScheduledRule(applicableRules)
    if (!chosenRule) continue

    const applicableStartRule = slot.startTimeId
      ? (startTimeRuleRows.find(
          (row) => row.optionPriceRuleId === chosenRule.id && row.startTimeId === slot.startTimeId,
        ) ?? null)
      : null

    if (applicableStartRule?.ruleMode === "excluded") continue

    const ruleUnitRows = unitPriceRuleRows.filter((row) => row.optionPriceRuleId === chosenRule.id)
    const ruleTierRows = unitTierRows.filter((row) =>
      ruleUnitRows.some((unitRule) => unitRule.id === row.optionUnitPriceRuleId),
    )

    const requestedUnits = query.requestedUnits.length > 0 ? query.requestedUnits : []
    const breakdown: ResolvedPriceBreakdown[] = []
    const components: ResolvedPriceComponent[] = []
    let sellAmountCents = chosenRule.baseSellAmountCents ?? 0
    let costAmountCents = chosenRule.baseCostAmountCents ?? 0
    let onRequest = chosenRule.pricingMode === "on_request"

    if (
      (chosenRule.baseSellAmountCents ?? 0) !== 0 ||
      (chosenRule.baseCostAmountCents ?? 0) !== 0
    ) {
      components.push({
        kind: "base",
        title: option.optionName,
        quantity: 1,
        pricingMode: chosenRule.pricingMode,
        sellAmountCents: chosenRule.baseSellAmountCents ?? 0,
        costAmountCents: chosenRule.baseCostAmountCents ?? 0,
        unitId: null,
        unitName: null,
        unitType: null,
        pricingCategoryId: null,
        pricingCategoryName: null,
        requestRef: null,
        sourceRuleId: chosenRule.id,
        tierId: null,
      })
    }

    for (const request of requestedUnits) {
      const candidateUnitRules = ruleUnitRows.filter((row) => {
        if (request.unitId && row.unitId !== request.unitId) return false
        if (
          request.pricingCategoryId &&
          row.pricingCategoryId &&
          row.pricingCategoryId !== request.pricingCategoryId
        )
          return false
        if (row.minQuantity && request.quantity < row.minQuantity) return false
        if (row.maxQuantity && request.quantity > row.maxQuantity) return false
        return true
      })
      const unitRule =
        [...candidateUnitRules].sort((a, b) => {
          const scoreA =
            Number(Boolean(request.unitId && a.unitId === request.unitId)) * 10 +
            Number(
              Boolean(
                request.pricingCategoryId && a.pricingCategoryId === request.pricingCategoryId,
              ),
            )
          const scoreB =
            Number(Boolean(request.unitId && b.unitId === request.unitId)) * 10 +
            Number(
              Boolean(
                request.pricingCategoryId && b.pricingCategoryId === request.pricingCategoryId,
              ),
            )
          return scoreB - scoreA
        })[0] ?? null

      const tier = unitRule
        ? ([...ruleTierRows]
            .filter(
              (row) =>
                row.optionUnitPriceRuleId === unitRule.id &&
                row.active &&
                request.quantity >= row.minQuantity &&
                (row.maxQuantity === null || request.quantity <= row.maxQuantity),
            )
            .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null)
        : null

      if (unitRule?.pricingMode === "on_request") onRequest = true
      const overrideUnitId = request.unitId ?? unitRule?.unitId ?? null
      const override =
        overrideUnitId == null
          ? null
          : (departureOverrideMap.get(
              `${slot.id}:${chosenRule.priceCatalogId}:${overrideUnitId}`,
            ) ?? null)
      const item = computeUnitAmounts(
        request,
        {
          unitName: request.unitId ? (unitMap.get(request.unitId)?.name ?? null) : null,
          unitType: request.unitId ? (unitMap.get(request.unitId)?.unitType ?? null) : null,
          pricingCategoryName: request.pricingCategoryId
            ? (pricingCategoryMap.get(request.pricingCategoryId)?.name ?? null)
            : null,
        },
        unitRule,
        tier,
        override,
      )
      breakdown.push(item)
      components.push({
        kind: "unit",
        title:
          [option.optionName, item.unitName, item.pricingCategoryName]
            .filter(Boolean)
            .join(" · ") || option.optionName,
        quantity: item.quantity,
        pricingMode: item.pricingMode,
        sellAmountCents: item.sellAmountCents,
        costAmountCents: item.costAmountCents,
        unitId: item.unitId,
        unitName: item.unitName,
        unitType: item.unitType,
        pricingCategoryId: item.pricingCategoryId,
        pricingCategoryName: item.pricingCategoryName,
        requestRef: item.requestRef,
        sourceRuleId: item.sourceRuleId,
        tierId: item.tierId,
      })
      sellAmountCents += item.sellAmountCents
      costAmountCents += item.costAmountCents
    }

    if (query.pickupPointId) {
      const pickupRule =
        pickupRuleRows.find(
          (row) =>
            row.optionPriceRuleId === chosenRule.id && row.pickupPointId === query.pickupPointId,
        ) ?? null
      if (pickupRule) {
        const quantity = Math.max(
          1,
          query.requestedUnits.reduce((sum, unit) => sum + unit.quantity, 0),
        )
        const pickupSellAmountCents =
          pickupRule.pricingMode === "per_person"
            ? (pickupRule.sellAmountCents ?? 0) * quantity
            : (pickupRule.sellAmountCents ?? 0)
        const pickupCostAmountCents =
          pickupRule.pricingMode === "per_person"
            ? (pickupRule.costAmountCents ?? 0) * quantity
            : (pickupRule.costAmountCents ?? 0)
        if (pickupRule.pricingMode === "on_request") onRequest = true
        components.push({
          kind: "pickup",
          title: "Pickup",
          quantity: pickupRule.pricingMode === "per_person" ? quantity : 1,
          pricingMode: pickupRule.pricingMode,
          sellAmountCents: pickupSellAmountCents,
          costAmountCents: pickupCostAmountCents,
          unitId: null,
          unitName: null,
          unitType: null,
          pricingCategoryId: null,
          pricingCategoryName: null,
          requestRef: null,
          sourceRuleId: pickupRule.id,
          tierId: null,
        })
        if (pickupRule.pricingMode === "per_booking") {
          sellAmountCents += pickupRule.sellAmountCents ?? 0
          costAmountCents += pickupRule.costAmountCents ?? 0
        } else if (pickupRule.pricingMode === "per_person") {
          sellAmountCents += (pickupRule.sellAmountCents ?? 0) * quantity
          costAmountCents += (pickupRule.costAmountCents ?? 0) * quantity
        }
      }
    }

    const preAdjustmentTotal = { sellAmountCents, costAmountCents }
    const adjusted = applicableStartRule
      ? applyAdjustment(preAdjustmentTotal, {
          adjustmentType: applicableStartRule.adjustmentType,
          sellAdjustmentCents: applicableStartRule.sellAdjustmentCents,
          costAdjustmentCents: applicableStartRule.costAdjustmentCents,
          adjustmentBasisPoints: applicableStartRule.adjustmentBasisPoints,
        })
      : { sellAmountCents, costAmountCents }

    sellAmountCents = adjusted.sellAmountCents
    costAmountCents = adjusted.costAmountCents

    const startTimeAdjustmentSellAmountCents =
      adjusted.sellAmountCents - preAdjustmentTotal.sellAmountCents
    const startTimeAdjustmentCostAmountCents =
      adjusted.costAmountCents - preAdjustmentTotal.costAmountCents

    if (
      applicableStartRule &&
      (startTimeAdjustmentSellAmountCents !== 0 || startTimeAdjustmentCostAmountCents !== 0)
    ) {
      components.push({
        kind: "start_time_adjustment",
        title: "Start time adjustment",
        quantity: 1,
        pricingMode: applicableStartRule.adjustmentType ?? "fixed",
        sellAmountCents: startTimeAdjustmentSellAmountCents,
        costAmountCents: startTimeAdjustmentCostAmountCents,
        unitId: null,
        unitName: null,
        unitType: null,
        pricingCategoryId: null,
        pricingCategoryName: null,
        requestRef: null,
        sourceRuleId: applicableStartRule.id,
        tierId: null,
      })
    }

    const relevantAllotments = allotmentRows.filter((row) => {
      if (row.productId !== option.productId) return false
      if (row.optionId && row.optionId !== option.optionId) return false
      if (row.startTimeId && row.startTimeId !== slot.startTimeId) return false
      if (slot.dateLocal && row.validFrom && slot.dateLocal < row.validFrom) return false
      if (slot.dateLocal && row.validTo && slot.dateLocal > row.validTo) return false
      return true
    })

    const relevantTargets = allotmentTargetRows.filter(
      (row) =>
        relevantAllotments.some((allotment) => allotment.id === row.allotmentId) &&
        (row.slotId === slot.id || (!row.slotId && row.startTimeId === slot.startTimeId)),
    )

    let allotmentStatus: "not_applicable" | "sellable" | "sold_out" = "not_applicable"
    let releaseRuleId: string | null = null
    if (relevantAllotments.length > 0) {
      const remaining = relevantTargets.reduce(
        (sum, row) => sum + Math.max(0, row.remainingCapacity ?? 0),
        0,
      )
      allotmentStatus = remaining > 0 ? "sellable" : "sold_out"
      const firstReleaseRule = releaseRuleRows.find((row) =>
        relevantAllotments.some((allotment) => allotment.id === row.allotmentId),
      )
      releaseRuleId = firstReleaseRule?.id ?? null
      if (allotmentStatus === "sold_out") continue
    }

    let displayCurrency =
      (catalogSelection ? catalogMap.get(catalogSelection.priceCatalogId)?.currencyCode : null) ??
      option.productSellCurrency

    let convertedSellAmountCents = sellAmountCents
    let convertedCostAmountCents = costAmountCents
    let fx = null as {
      fxRateSetId: string
      baseCurrency: string
      quoteCurrency: string
      rateDecimal: number
    } | null

    if (query.currencyCode && query.currencyCode !== displayCurrency) {
      const fxRate = exchangeRateRow.find(
        (row) => row.baseCurrency === displayCurrency && row.quoteCurrency === query.currencyCode,
      )
      if (fxRate) {
        const rate = toNumeric(fxRate.rateDecimal) ?? 1
        convertedSellAmountCents = Math.round(sellAmountCents * rate)
        convertedCostAmountCents = Math.round(costAmountCents * rate)
        fx = {
          fxRateSetId: fxRate.fxRateSetId,
          baseCurrency: displayCurrency,
          quoteCurrency: query.currencyCode,
          rateDecimal: rate,
        }
        displayCurrency = query.currencyCode
      }
    }

    candidates.push({
      product: {
        id: option.productId,
        name: option.productName,
      },
      option: {
        id: option.optionId,
        name: option.optionName,
        code: option.optionCode,
      },
      slot,
      market: marketRow
        ? {
            id: marketRow.id,
            code: marketRow.code,
            name: marketRow.name,
          }
        : null,
      channel: channelRow,
      sellability: {
        mode: marketRule?.sellability ?? channelRule?.sellability ?? "sellable",
        onRequest,
        allotmentStatus,
      },
      pricing: {
        currencyCode: displayCurrency,
        sellAmountCents: convertedSellAmountCents,
        costAmountCents: convertedCostAmountCents,
        marginAmountCents: convertedSellAmountCents - convertedCostAmountCents,
        breakdown,
        components,
        fx,
      },
      sources: {
        marketProductRuleId: marketRule?.id ?? null,
        marketChannelRuleId: channelRule?.id ?? null,
        marketPriceCatalogId: catalogSelection?.id ?? null,
        optionPriceRuleId: chosenRule.id,
        optionStartTimeRuleId: applicableStartRule?.id ?? null,
        channelInventoryAllotmentIds: relevantAllotments.map((row) => row.id),
        channelInventoryReleaseRuleId: releaseRuleId,
      },
    })
  }

  return {
    data: candidates,
    meta: {
      total: candidates.length,
    },
  }
}
