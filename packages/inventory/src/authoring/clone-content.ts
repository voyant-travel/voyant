import { pricingCategories, pricingCategoryDependencies } from "@voyant-travel/commerce"
import { productOptionResourceTemplates } from "@voyant-travel/operations"
import { eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { optionExtraConfigs, productExtras } from "../extras.js"
import {
  optionUnits,
  optionUnitTranslations,
  productActivationSettings,
  productCapabilities,
  productCategoryProducts,
  productDayServices,
  productDays,
  productDayTranslations,
  productDeliveryFormats,
  productDestinations,
  productFaqs,
  productFeatures,
  productItineraries,
  productLocations,
  productMedia,
  productOptions,
  productOptionTranslations,
  productTagProducts,
  productTicketSettings,
  productTranslations,
  productVisibilitySettings,
} from "../schema.js"

/** Shared, mutable state threaded across the clone copy phases (id remaps). */
export interface CloneContext {
  tx: PostgresJsDatabase
  sourceId: string
  targetId: string
  copyDepartures: boolean
  optionIdMap: Map<string, string>
  unitIdMap: Map<string, string>
  unitsByNewOption: Map<string, { id: string }[]>
  itineraryIdMap: Map<string, string>
  dayIdMap: Map<string, string>
  startTimeIdMap: Map<string, string>
  ruleIdMap: Map<string, string>
  slotIdMap: Map<string, string>
  optionPriceRuleIdMap: Map<string, string>
  optionUnitPriceRuleIdMap: Map<string, string>
  pricingCategoryIdMap: Map<string, string>
  productExtraIdMap: Map<string, string>
  optionExtraConfigIdMap: Map<string, string>
}

type SystemColumns = {
  id?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export function withoutSystemColumns<T extends SystemColumns>(row: T) {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...values } = row
  return values
}

/**
 * Copies the product's content graph: per-product settings, options + units
 * (with translations + resource templates), pricing categories (+ dependencies,
 * remapped), itineraries/days/services, media, and extras. Populates the id
 * remaps in {@link CloneContext} for the pricing/operations phase.
 */
export async function copyProductContent(ctx: CloneContext): Promise<void> {
  const { tx, sourceId, targetId } = ctx

  const activationRows = await tx
    .select()
    .from(productActivationSettings)
    .where(eq(productActivationSettings.productId, sourceId))
  for (const row of activationRows) {
    await tx.insert(productActivationSettings).values({
      ...withoutSystemColumns(row),
      productId: targetId,
      activationMode: "manual",
      activateAt: null,
      deactivateAt: null,
      sellAt: null,
      stopSellAt: null,
    })
  }

  const ticketRows = await tx
    .select()
    .from(productTicketSettings)
    .where(eq(productTicketSettings.productId, sourceId))
  for (const row of ticketRows) {
    await tx
      .insert(productTicketSettings)
      .values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const visibilityRows = await tx
    .select()
    .from(productVisibilitySettings)
    .where(eq(productVisibilitySettings.productId, sourceId))
  for (const row of visibilityRows) {
    await tx
      .insert(productVisibilitySettings)
      .values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const capabilityRows = await tx
    .select()
    .from(productCapabilities)
    .where(eq(productCapabilities.productId, sourceId))
  for (const row of capabilityRows) {
    await tx
      .insert(productCapabilities)
      .values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const deliveryFormatRows = await tx
    .select()
    .from(productDeliveryFormats)
    .where(eq(productDeliveryFormats.productId, sourceId))
  for (const row of deliveryFormatRows) {
    await tx
      .insert(productDeliveryFormats)
      .values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const featureRows = await tx
    .select()
    .from(productFeatures)
    .where(eq(productFeatures.productId, sourceId))
  for (const row of featureRows) {
    await tx.insert(productFeatures).values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const faqRows = await tx.select().from(productFaqs).where(eq(productFaqs.productId, sourceId))
  for (const row of faqRows) {
    await tx.insert(productFaqs).values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const locationRows = await tx
    .select()
    .from(productLocations)
    .where(eq(productLocations.productId, sourceId))
  for (const row of locationRows) {
    await tx.insert(productLocations).values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const translationRows = await tx
    .select()
    .from(productTranslations)
    .where(eq(productTranslations.productId, sourceId))
  for (const row of translationRows) {
    await tx
      .insert(productTranslations)
      .values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const categoryRows = await tx
    .select()
    .from(productCategoryProducts)
    .where(eq(productCategoryProducts.productId, sourceId))
  for (const row of categoryRows) {
    await tx
      .insert(productCategoryProducts)
      .values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const tagRows = await tx
    .select()
    .from(productTagProducts)
    .where(eq(productTagProducts.productId, sourceId))
  for (const row of tagRows) {
    await tx
      .insert(productTagProducts)
      .values({ ...withoutSystemColumns(row), productId: targetId })
  }

  const destinationRows = await tx
    .select()
    .from(productDestinations)
    .where(eq(productDestinations.productId, sourceId))
  for (const row of destinationRows) {
    await tx
      .insert(productDestinations)
      .values({ ...withoutSystemColumns(row), productId: targetId })
  }

  await copyOptionsAndUnits(ctx)
  await copyPricingCategories(ctx)
  await copyItinerary(ctx)
  await copyMedia(ctx)
  await copyExtras(ctx)
}

async function copyOptionsAndUnits(ctx: CloneContext): Promise<void> {
  const { tx, sourceId, targetId, optionIdMap, unitIdMap, unitsByNewOption } = ctx

  const sourceOptions = await tx
    .select()
    .from(productOptions)
    .where(eq(productOptions.productId, sourceId))
  for (const row of sourceOptions) {
    const [copy] = await tx
      .insert(productOptions)
      .values({ ...withoutSystemColumns(row), productId: targetId })
      .returning()
    if (copy) {
      optionIdMap.set(row.id, copy.id)
      unitsByNewOption.set(copy.id, [])
    }
  }

  const sourceOptionIds = sourceOptions.map((row) => row.id)
  if (sourceOptionIds.length === 0) return

  const optionTranslationRows = await tx
    .select()
    .from(productOptionTranslations)
    .where(inArray(productOptionTranslations.optionId, sourceOptionIds))
  for (const row of optionTranslationRows) {
    const targetOptionId = optionIdMap.get(row.optionId)
    if (!targetOptionId) continue
    await tx
      .insert(productOptionTranslations)
      .values({ ...withoutSystemColumns(row), optionId: targetOptionId })
  }

  const sourceUnits = await tx
    .select()
    .from(optionUnits)
    .where(inArray(optionUnits.optionId, sourceOptionIds))
  for (const row of sourceUnits) {
    const targetOptionId = optionIdMap.get(row.optionId)
    if (!targetOptionId) continue
    const [copy] = await tx
      .insert(optionUnits)
      .values({ ...withoutSystemColumns(row), optionId: targetOptionId })
      .returning()
    if (copy) {
      unitIdMap.set(row.id, copy.id)
      unitsByNewOption.get(targetOptionId)?.push({ id: copy.id })
    }
  }

  const sourceUnitIds = sourceUnits.map((row) => row.id)
  if (sourceUnitIds.length > 0) {
    const unitTranslationRows = await tx
      .select()
      .from(optionUnitTranslations)
      .where(inArray(optionUnitTranslations.unitId, sourceUnitIds))
    for (const row of unitTranslationRows) {
      const targetUnitId = unitIdMap.get(row.unitId)
      if (!targetUnitId) continue
      await tx
        .insert(optionUnitTranslations)
        .values({ ...withoutSystemColumns(row), unitId: targetUnitId })
    }
  }

  const resourceTemplateRows = await tx
    .select()
    .from(productOptionResourceTemplates)
    .where(inArray(productOptionResourceTemplates.productOptionId, sourceOptionIds))
  for (const row of resourceTemplateRows) {
    const targetOptionId = optionIdMap.get(row.productOptionId)
    if (!targetOptionId) continue
    await tx
      .insert(productOptionResourceTemplates)
      .values({ ...withoutSystemColumns(row), productOptionId: targetOptionId })
  }
}

async function copyPricingCategories(ctx: CloneContext): Promise<void> {
  const { tx, sourceId, targetId, optionIdMap, unitIdMap, pricingCategoryIdMap } = ctx

  const pricingCategoryRows = await tx
    .select()
    .from(pricingCategories)
    .where(eq(pricingCategories.productId, sourceId))
  for (const row of pricingCategoryRows) {
    const targetOptionId = row.optionId ? (optionIdMap.get(row.optionId) ?? null) : null
    const targetUnitId = row.unitId ? (unitIdMap.get(row.unitId) ?? null) : null
    if (row.optionId && !targetOptionId) continue
    if (row.unitId && !targetUnitId) continue

    const [copy] = await tx
      .insert(pricingCategories)
      .values({
        ...withoutSystemColumns(row),
        productId: targetId,
        optionId: targetOptionId,
        unitId: targetUnitId,
      })
      .returning()
    if (copy) pricingCategoryIdMap.set(row.id, copy.id)
  }

  const sourcePricingCategoryIds = pricingCategoryRows.map((row) => row.id)
  if (sourcePricingCategoryIds.length === 0) return

  const dependencyRows = await tx
    .select()
    .from(pricingCategoryDependencies)
    .where(inArray(pricingCategoryDependencies.pricingCategoryId, sourcePricingCategoryIds))
  for (const row of dependencyRows) {
    const targetPricingCategoryId = pricingCategoryIdMap.get(row.pricingCategoryId)
    const targetMasterPricingCategoryId = pricingCategoryIdMap.get(row.masterPricingCategoryId)
    if (!targetPricingCategoryId || !targetMasterPricingCategoryId) continue
    await tx.insert(pricingCategoryDependencies).values({
      ...withoutSystemColumns(row),
      pricingCategoryId: targetPricingCategoryId,
      masterPricingCategoryId: targetMasterPricingCategoryId,
    })
  }
}

async function copyItinerary(ctx: CloneContext): Promise<void> {
  const { tx, sourceId, targetId, itineraryIdMap, dayIdMap } = ctx

  const sourceItineraries = await tx
    .select()
    .from(productItineraries)
    .where(eq(productItineraries.productId, sourceId))
  for (const row of sourceItineraries) {
    const [copy] = await tx
      .insert(productItineraries)
      .values({ ...withoutSystemColumns(row), productId: targetId })
      .returning()
    if (copy) itineraryIdMap.set(row.id, copy.id)
  }

  if (sourceItineraries.length === 0) {
    await tx
      .insert(productItineraries)
      .values({ productId: targetId, name: "Default", isDefault: true, sortOrder: 0 })
    return
  }

  const sourceItineraryIds = sourceItineraries.map((row) => row.id)
  const sourceDays = await tx
    .select()
    .from(productDays)
    .where(inArray(productDays.itineraryId, sourceItineraryIds))
  for (const row of sourceDays) {
    const targetItineraryId = itineraryIdMap.get(row.itineraryId)
    if (!targetItineraryId) continue
    const [copy] = await tx
      .insert(productDays)
      .values({ ...withoutSystemColumns(row), itineraryId: targetItineraryId })
      .returning()
    if (copy) dayIdMap.set(row.id, copy.id)
  }

  const sourceDayIds = sourceDays.map((row) => row.id)
  if (sourceDayIds.length === 0) return

  const dayServiceRows = await tx
    .select()
    .from(productDayServices)
    .where(inArray(productDayServices.dayId, sourceDayIds))
  for (const row of dayServiceRows) {
    const targetDayId = dayIdMap.get(row.dayId)
    if (!targetDayId) continue
    await tx.insert(productDayServices).values({ ...withoutSystemColumns(row), dayId: targetDayId })
  }

  const dayTranslationRows = await tx
    .select()
    .from(productDayTranslations)
    .where(inArray(productDayTranslations.dayId, sourceDayIds))
  for (const row of dayTranslationRows) {
    const targetDayId = dayIdMap.get(row.dayId)
    if (!targetDayId) continue
    await tx
      .insert(productDayTranslations)
      .values({ ...withoutSystemColumns(row), dayId: targetDayId })
  }
}

async function copyMedia(ctx: CloneContext): Promise<void> {
  const { tx, sourceId, targetId, dayIdMap } = ctx
  const mediaRows = await tx.select().from(productMedia).where(eq(productMedia.productId, sourceId))
  for (const row of mediaRows) {
    if (row.isBrochure) continue
    const targetDayId = row.dayId ? dayIdMap.get(row.dayId) : null
    if (row.dayId && !targetDayId) continue
    await tx.insert(productMedia).values({
      ...withoutSystemColumns(row),
      productId: targetId,
      dayId: targetDayId,
      isBrochure: false,
      isBrochureCurrent: false,
      brochureVersion: null,
    })
  }
}

async function copyExtras(ctx: CloneContext): Promise<void> {
  const { tx, sourceId, targetId, optionIdMap, productExtraIdMap, optionExtraConfigIdMap } = ctx

  const extraRows = await tx
    .select()
    .from(productExtras)
    .where(eq(productExtras.productId, sourceId))
  for (const row of extraRows) {
    const [copy] = await tx
      .insert(productExtras)
      .values({ ...withoutSystemColumns(row), productId: targetId })
      .returning()
    if (copy) productExtraIdMap.set(row.id, copy.id)
  }

  const sourceOptionIds = [...optionIdMap.keys()]
  if (sourceOptionIds.length === 0) return

  const extraConfigRows = await tx
    .select()
    .from(optionExtraConfigs)
    .where(inArray(optionExtraConfigs.optionId, sourceOptionIds))
  for (const row of extraConfigRows) {
    const targetOptionId = optionIdMap.get(row.optionId)
    const targetProductExtraId = productExtraIdMap.get(row.productExtraId)
    if (!targetOptionId || !targetProductExtraId) continue
    const [copy] = await tx
      .insert(optionExtraConfigs)
      .values({
        ...withoutSystemColumns(row),
        optionId: targetOptionId,
        productExtraId: targetProductExtraId,
      })
      .returning()
    if (copy) optionExtraConfigIdMap.set(row.id, copy.id)
  }
}
