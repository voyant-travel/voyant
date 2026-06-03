import {
  availabilityRules,
  availabilitySlots,
  availabilityStartTimes,
  productOptionResourceTemplates,
} from "@voyantjs/availability"
import { optionExtraConfigs, productExtras } from "@voyantjs/extras"
import {
  departurePriceOverrides,
  dropoffPriceRules,
  extraPriceRules,
  optionPriceRules,
  optionStartTimeRules,
  optionUnitPriceRules,
  optionUnitTiers,
  pickupPriceRules,
  pricingCategories,
  pricingCategoryDependencies,
} from "@voyantjs/pricing"
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
  products,
  productTagProducts,
  productTicketSettings,
  productTranslations,
  productVisibilitySettings,
} from "@voyantjs/products"
import { eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"

type SystemColumns = {
  id?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

function withoutSystemColumns<T extends SystemColumns>(row: T) {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...values } = row
  return values
}

function copyName(name: string) {
  return `${name} (Copy)`
}

export async function duplicateProductAsDraft(db: PostgresJsDatabase, productId: string) {
  return db.transaction(async (tx) => {
    const [sourceProduct] = await tx.select().from(products).where(eq(products.id, productId))
    if (!sourceProduct) return null

    const [targetProduct] = await tx
      .insert(products)
      .values({
        ...withoutSystemColumns(sourceProduct),
        name: copyName(sourceProduct.name),
        status: "draft",
        activated: false,
      })
      .returning()

    if (!targetProduct) {
      throw new Error("Failed to duplicate product")
    }

    const targetProductId = targetProduct.id
    const optionIdMap = new Map<string, string>()
    const unitIdMap = new Map<string, string>()
    const itineraryIdMap = new Map<string, string>()
    const dayIdMap = new Map<string, string>()
    const startTimeIdMap = new Map<string, string>()
    const ruleIdMap = new Map<string, string>()
    const slotIdMap = new Map<string, string>()
    const optionPriceRuleIdMap = new Map<string, string>()
    const optionUnitPriceRuleIdMap = new Map<string, string>()
    const pricingCategoryIdMap = new Map<string, string>()
    const productExtraIdMap = new Map<string, string>()
    const optionExtraConfigIdMap = new Map<string, string>()

    const activationRows = await tx
      .select()
      .from(productActivationSettings)
      .where(eq(productActivationSettings.productId, productId))
    for (const row of activationRows) {
      await tx.insert(productActivationSettings).values({
        ...withoutSystemColumns(row),
        productId: targetProductId,
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
      .where(eq(productTicketSettings.productId, productId))
    for (const row of ticketRows) {
      await tx
        .insert(productTicketSettings)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const visibilityRows = await tx
      .select()
      .from(productVisibilitySettings)
      .where(eq(productVisibilitySettings.productId, productId))
    for (const row of visibilityRows) {
      await tx.insert(productVisibilitySettings).values({
        ...withoutSystemColumns(row),
        productId: targetProductId,
      })
    }

    const capabilityRows = await tx
      .select()
      .from(productCapabilities)
      .where(eq(productCapabilities.productId, productId))
    for (const row of capabilityRows) {
      await tx
        .insert(productCapabilities)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const deliveryFormatRows = await tx
      .select()
      .from(productDeliveryFormats)
      .where(eq(productDeliveryFormats.productId, productId))
    for (const row of deliveryFormatRows) {
      await tx
        .insert(productDeliveryFormats)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const featureRows = await tx
      .select()
      .from(productFeatures)
      .where(eq(productFeatures.productId, productId))
    for (const row of featureRows) {
      await tx
        .insert(productFeatures)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const faqRows = await tx.select().from(productFaqs).where(eq(productFaqs.productId, productId))
    for (const row of faqRows) {
      await tx
        .insert(productFaqs)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const locationRows = await tx
      .select()
      .from(productLocations)
      .where(eq(productLocations.productId, productId))
    for (const row of locationRows) {
      await tx
        .insert(productLocations)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const translationRows = await tx
      .select()
      .from(productTranslations)
      .where(eq(productTranslations.productId, productId))
    for (const row of translationRows) {
      await tx
        .insert(productTranslations)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const categoryRows = await tx
      .select()
      .from(productCategoryProducts)
      .where(eq(productCategoryProducts.productId, productId))
    for (const row of categoryRows) {
      await tx
        .insert(productCategoryProducts)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const tagRows = await tx
      .select()
      .from(productTagProducts)
      .where(eq(productTagProducts.productId, productId))
    for (const row of tagRows) {
      await tx
        .insert(productTagProducts)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const destinationRows = await tx
      .select()
      .from(productDestinations)
      .where(eq(productDestinations.productId, productId))
    for (const row of destinationRows) {
      await tx
        .insert(productDestinations)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
    }

    const sourceOptions = await tx
      .select()
      .from(productOptions)
      .where(eq(productOptions.productId, productId))
    for (const row of sourceOptions) {
      const [copy] = await tx
        .insert(productOptions)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
        .returning()
      if (copy) optionIdMap.set(row.id, copy.id)
    }

    const sourceOptionIds = sourceOptions.map((row) => row.id)
    if (sourceOptionIds.length > 0) {
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
        if (copy) unitIdMap.set(row.id, copy.id)
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
        await tx.insert(productOptionResourceTemplates).values({
          ...withoutSystemColumns(row),
          productOptionId: targetOptionId,
        })
      }
    }

    const pricingCategoryRows = await tx
      .select()
      .from(pricingCategories)
      .where(eq(pricingCategories.productId, productId))
    for (const row of pricingCategoryRows) {
      const targetOptionId = row.optionId ? (optionIdMap.get(row.optionId) ?? null) : null
      const targetUnitId = row.unitId ? (unitIdMap.get(row.unitId) ?? null) : null
      if (row.optionId && !targetOptionId) continue
      if (row.unitId && !targetUnitId) continue

      const [copy] = await tx
        .insert(pricingCategories)
        .values({
          ...withoutSystemColumns(row),
          productId: targetProductId,
          optionId: targetOptionId,
          unitId: targetUnitId,
        })
        .returning()
      if (copy) pricingCategoryIdMap.set(row.id, copy.id)
    }

    const sourcePricingCategoryIds = pricingCategoryRows.map((row) => row.id)
    if (sourcePricingCategoryIds.length > 0) {
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

    const sourceItineraries = await tx
      .select()
      .from(productItineraries)
      .where(eq(productItineraries.productId, productId))
    for (const row of sourceItineraries) {
      const [copy] = await tx
        .insert(productItineraries)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
        .returning()
      if (copy) itineraryIdMap.set(row.id, copy.id)
    }

    if (sourceItineraries.length === 0) {
      await tx.insert(productItineraries).values({
        productId: targetProductId,
        name: "Default",
        isDefault: true,
        sortOrder: 0,
      })
    }

    const sourceItineraryIds = sourceItineraries.map((row) => row.id)
    if (sourceItineraryIds.length > 0) {
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
      if (sourceDayIds.length > 0) {
        const dayServiceRows = await tx
          .select()
          .from(productDayServices)
          .where(inArray(productDayServices.dayId, sourceDayIds))
        for (const row of dayServiceRows) {
          const targetDayId = dayIdMap.get(row.dayId)
          if (!targetDayId) continue
          await tx
            .insert(productDayServices)
            .values({ ...withoutSystemColumns(row), dayId: targetDayId })
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
    }

    const mediaRows = await tx
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, productId))
    for (const row of mediaRows) {
      if (row.isBrochure) continue
      const targetDayId = row.dayId ? dayIdMap.get(row.dayId) : null
      if (row.dayId && !targetDayId) continue
      await tx.insert(productMedia).values({
        ...withoutSystemColumns(row),
        productId: targetProductId,
        dayId: targetDayId,
        isBrochure: false,
        isBrochureCurrent: false,
        brochureVersion: null,
      })
    }

    const extraRows = await tx
      .select()
      .from(productExtras)
      .where(eq(productExtras.productId, productId))
    for (const row of extraRows) {
      const [copy] = await tx
        .insert(productExtras)
        .values({ ...withoutSystemColumns(row), productId: targetProductId })
        .returning()
      if (copy) productExtraIdMap.set(row.id, copy.id)
    }

    if (sourceOptionIds.length > 0) {
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

    const startTimeRows = await tx
      .select()
      .from(availabilityStartTimes)
      .where(eq(availabilityStartTimes.productId, productId))
    for (const row of startTimeRows) {
      const [copy] = await tx
        .insert(availabilityStartTimes)
        .values({
          ...withoutSystemColumns(row),
          productId: targetProductId,
          optionId: row.optionId ? (optionIdMap.get(row.optionId) ?? null) : null,
        })
        .returning()
      if (copy) startTimeIdMap.set(row.id, copy.id)
    }

    const availabilityRuleRows = await tx
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.productId, productId))
    for (const row of availabilityRuleRows) {
      const [copy] = await tx
        .insert(availabilityRules)
        .values({
          ...withoutSystemColumns(row),
          productId: targetProductId,
          optionId: row.optionId ? (optionIdMap.get(row.optionId) ?? null) : null,
        })
        .returning()
      if (copy) ruleIdMap.set(row.id, copy.id)
    }

    const slotRows = await tx
      .select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.productId, productId))
    for (const row of slotRows) {
      const targetItineraryId = row.itineraryId
        ? (itineraryIdMap.get(row.itineraryId) ?? null)
        : null
      const targetOptionId = row.optionId ? (optionIdMap.get(row.optionId) ?? null) : null
      const targetRuleId = row.availabilityRuleId
        ? (ruleIdMap.get(row.availabilityRuleId) ?? null)
        : null
      const targetStartTimeId = row.startTimeId
        ? (startTimeIdMap.get(row.startTimeId) ?? null)
        : null
      const [copy] = await tx
        .insert(availabilitySlots)
        .values({
          ...withoutSystemColumns(row),
          productId: targetProductId,
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

    if (sourceOptionIds.length > 0) {
      const optionPriceRuleRows = await tx
        .select()
        .from(optionPriceRules)
        .where(inArray(optionPriceRules.optionId, sourceOptionIds))
      for (const row of optionPriceRuleRows) {
        const targetOptionId = optionIdMap.get(row.optionId)
        if (!targetOptionId) continue
        const [copy] = await tx
          .insert(optionPriceRules)
          .values({
            ...withoutSystemColumns(row),
            productId: targetProductId,
            optionId: targetOptionId,
          })
          .returning()
        if (copy) optionPriceRuleIdMap.set(row.id, copy.id)
      }

      const sourceOptionPriceRuleIds = optionPriceRuleRows.map((row) => row.id)
      if (sourceOptionPriceRuleIds.length > 0) {
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
            await tx.insert(optionUnitTiers).values({
              ...withoutSystemColumns(row),
              optionUnitPriceRuleId: targetUnitPriceRuleId,
            })
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
    }

    const sourceSlotIds = slotRows.map((row) => row.id)
    if (sourceSlotIds.length > 0) {
      const overrideRows = await tx
        .select()
        .from(departurePriceOverrides)
        .where(inArray(departurePriceOverrides.departureId, sourceSlotIds))
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

    return targetProduct
  })
}

async function handleDuplicateProduct(c: Context): Promise<Response> {
  const productId = c.req.param("id")
  if (!productId) {
    return c.json({ error: "Product id is required" }, 400)
  }

  const db = c.get("db") as PostgresJsDatabase
  const row = await duplicateProductAsDraft(db, productId)

  if (!row) {
    return c.json({ error: "Product not found" }, 404)
  }

  return c.json({ data: row }, 201)
}

export function mountProductDuplicateRoutes(hono: Hono): void {
  hono.post("/v1/admin/products/:id/duplicate", handleDuplicateProduct)
}
