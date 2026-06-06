import { optionPriceRules, optionUnitPriceRules, optionUnitTiers } from "@voyantjs/pricing/schema"
import {
  optionUnits,
  productDayServices,
  productDays,
  productItineraries,
  productOptions,
  productPaxPricingTiers,
  products,
} from "@voyantjs/products/schema"
import { asc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ItinerarySpec, OptionSpec, PaxPricingTierSpec, ProductGraphSpec } from "./spec.js"

/**
 * Reads a complete product graph into a {@link ProductGraphSpec}. Local ref keys
 * are set to the source row ids; the builder remaps them to fresh ids. This is
 * the clone path's first half: `serialize → patch product row → build`.
 *
 * Intentionally omits `availability_slots` — departures are date-specific and
 * are added to the clone separately.
 */
export async function serializeProductGraph(
  db: PostgresJsDatabase,
  productId: string,
): Promise<ProductGraphSpec | null> {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
  if (!product) return null

  // --- options + units -------------------------------------------------------
  const optionRows = await db
    .select()
    .from(productOptions)
    .where(eq(productOptions.productId, productId))
    .orderBy(asc(productOptions.sortOrder), asc(productOptions.createdAt))

  const optionIds = optionRows.map((o) => o.id)

  const unitRows = optionIds.length
    ? await db
        .select()
        .from(optionUnits)
        .where(inArray(optionUnits.optionId, optionIds))
        .orderBy(asc(optionUnits.sortOrder), asc(optionUnits.createdAt))
    : []

  // --- pricing (option rules → unit rules → tiers) ---------------------------
  const priceRuleRows = optionIds.length
    ? await db
        .select()
        .from(optionPriceRules)
        .where(inArray(optionPriceRules.optionId, optionIds))
        .orderBy(asc(optionPriceRules.createdAt))
    : []

  const priceRuleIds = priceRuleRows.map((r) => r.id)

  const unitRuleRows = priceRuleIds.length
    ? await db
        .select()
        .from(optionUnitPriceRules)
        .where(inArray(optionUnitPriceRules.optionPriceRuleId, priceRuleIds))
        .orderBy(asc(optionUnitPriceRules.sortOrder), asc(optionUnitPriceRules.createdAt))
    : []

  const unitRuleIds = unitRuleRows.map((r) => r.id)

  const tierRows = unitRuleIds.length
    ? await db
        .select()
        .from(optionUnitTiers)
        .where(inArray(optionUnitTiers.optionUnitPriceRuleId, unitRuleIds))
        .orderBy(asc(optionUnitTiers.sortOrder), asc(optionUnitTiers.minQuantity))
    : []

  // --- pax pricing tiers -----------------------------------------------------
  const paxTierRows = await db
    .select()
    .from(productPaxPricingTiers)
    .where(eq(productPaxPricingTiers.productId, productId))
    .orderBy(asc(productPaxPricingTiers.tierPax))

  // --- itineraries → days → services -----------------------------------------
  const itineraryRows = await db
    .select()
    .from(productItineraries)
    .where(eq(productItineraries.productId, productId))
    .orderBy(asc(productItineraries.sortOrder), asc(productItineraries.createdAt))

  const itineraryIds = itineraryRows.map((i) => i.id)

  const dayRows = itineraryIds.length
    ? await db
        .select()
        .from(productDays)
        .where(inArray(productDays.itineraryId, itineraryIds))
        .orderBy(asc(productDays.dayNumber))
    : []

  const dayIds = dayRows.map((d) => d.id)

  const serviceRows = dayIds.length
    ? await db
        .select()
        .from(productDayServices)
        .where(inArray(productDayServices.dayId, dayIds))
        .orderBy(asc(productDayServices.sortOrder))
    : []

  // --- assemble --------------------------------------------------------------
  const options: OptionSpec[] = optionRows.map((opt) => ({
    ref: opt.id,
    name: opt.name,
    code: opt.code,
    description: opt.description,
    status: opt.status,
    isDefault: opt.isDefault,
    sortOrder: opt.sortOrder,
    availableFrom: opt.availableFrom,
    availableTo: opt.availableTo,
    units: unitRows
      .filter((u) => u.optionId === opt.id)
      .map((u) => ({
        ref: u.id,
        name: u.name,
        code: u.code,
        description: u.description,
        unitType: u.unitType,
        minQuantity: u.minQuantity,
        maxQuantity: u.maxQuantity,
        minAge: u.minAge,
        maxAge: u.maxAge,
        occupancyMin: u.occupancyMin,
        occupancyMax: u.occupancyMax,
        isRequired: u.isRequired,
        isHidden: u.isHidden,
        sortOrder: u.sortOrder,
      })),
    priceRules: priceRuleRows
      .filter((r) => r.optionId === opt.id)
      .map((rule) => ({
        priceCatalogId: rule.priceCatalogId,
        priceScheduleId: rule.priceScheduleId,
        cancellationPolicyId: rule.cancellationPolicyId,
        code: rule.code,
        name: rule.name,
        description: rule.description,
        pricingMode: rule.pricingMode,
        baseSellAmountCents: rule.baseSellAmountCents,
        baseCostAmountCents: rule.baseCostAmountCents,
        minPerBooking: rule.minPerBooking,
        maxPerBooking: rule.maxPerBooking,
        allPricingCategories: rule.allPricingCategories,
        isDefault: rule.isDefault,
        active: rule.active,
        notes: rule.notes,
        metadata: rule.metadata,
        unitPriceRules: unitRuleRows
          .filter((ur) => ur.optionPriceRuleId === rule.id)
          .map((ur) => ({
            unitRef: ur.unitId,
            pricingCategoryId: ur.pricingCategoryId,
            pricingMode: ur.pricingMode,
            sellAmountCents: ur.sellAmountCents,
            costAmountCents: ur.costAmountCents,
            minQuantity: ur.minQuantity,
            maxQuantity: ur.maxQuantity,
            active: ur.active,
            sortOrder: ur.sortOrder,
            notes: ur.notes,
            metadata: ur.metadata,
            tiers: tierRows
              .filter((t) => t.optionUnitPriceRuleId === ur.id)
              .map((t) => ({
                minQuantity: t.minQuantity,
                maxQuantity: t.maxQuantity,
                sellAmountCents: t.sellAmountCents,
                costAmountCents: t.costAmountCents,
                active: t.active,
                sortOrder: t.sortOrder,
              })),
          })),
      })),
  }))

  const paxPricingTiers: PaxPricingTierSpec[] = paxTierRows.map((t) => ({
    unitRef: t.optionUnitId,
    tierPax: t.tierPax,
    pricePerPaxCents: t.pricePerPaxCents,
    promoPricePerPaxCents: t.promoPricePerPaxCents,
    effectiveFrom: t.effectiveFrom,
    effectiveTo: t.effectiveTo,
  }))

  const itineraries: ItinerarySpec[] = itineraryRows.map((itin) => ({
    name: itin.name,
    isDefault: itin.isDefault,
    sortOrder: itin.sortOrder,
    days: dayRows
      .filter((d) => d.itineraryId === itin.id)
      .map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description,
        location: day.location,
        services: serviceRows
          .filter((s) => s.dayId === day.id)
          .map((s) => ({
            supplierServiceId: s.supplierServiceId,
            serviceType: s.serviceType,
            name: s.name,
            description: s.description,
            countryCode: s.countryCode,
            costCurrency: s.costCurrency,
            costAmountCents: s.costAmountCents,
            quantity: s.quantity,
            sortOrder: s.sortOrder,
            notes: s.notes,
          })),
      })),
  }))

  return {
    product: {
      name: product.name,
      status: product.status,
      description: product.description,
      inclusionsHtml: product.inclusionsHtml,
      exclusionsHtml: product.exclusionsHtml,
      termsHtml: product.termsHtml,
      termsShowOnContract: product.termsShowOnContract,
      bookingMode: product.bookingMode,
      capacityMode: product.capacityMode,
      timezone: product.timezone,
      defaultLanguageTag: product.defaultLanguageTag,
      visibility: product.visibility,
      sellCurrency: product.sellCurrency,
      sellAmountCents: product.sellAmountCents,
      costAmountCents: product.costAmountCents,
      marginPercent: product.marginPercent,
      reservationTimeoutMinutes: product.reservationTimeoutMinutes,
      facilityId: product.facilityId,
      supplierId: product.supplierId,
      startDate: product.startDate,
      endDate: product.endDate,
      pax: product.pax,
      productTypeId: product.productTypeId,
      contractTemplateId: product.contractTemplateId,
      taxClassId: product.taxClassId,
      customerPaymentPolicy: product.customerPaymentPolicy,
      tags: product.tags ?? [],
    },
    options,
    paxPricingTiers,
    itineraries,
  }
}
