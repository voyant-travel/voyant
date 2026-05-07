import { availabilitySlots, availabilityStartTimes } from "@voyantjs/availability/schema"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  optionPriceRules,
  optionStartTimeRules,
  optionUnitPriceRules,
  optionUnitTiers,
  priceCatalogs,
} from "./schema.js"
import type {
  PublicAvailabilitySnapshotQuery,
  PublicProductPricingQuery,
} from "./validation-public.js"

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : value
}

async function ensurePublicProduct(db: PostgresJsDatabase, productId: string) {
  const [product] = await db
    .select({
      id: products.id,
      bookingMode: products.bookingMode,
      capacityMode: products.capacityMode,
      sellCurrency: products.sellCurrency,
    })
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.status, "active"),
        eq(products.activated, true),
        eq(products.visibility, "public"),
      ),
    )
    .limit(1)

  return product ?? null
}

async function resolvePublicCatalog(
  db: PostgresJsDatabase,
  input: { catalogId?: string | undefined },
) {
  if (input.catalogId) {
    const [catalog] = await db
      .select({
        id: priceCatalogs.id,
        code: priceCatalogs.code,
        name: priceCatalogs.name,
        currencyCode: priceCatalogs.currencyCode,
      })
      .from(priceCatalogs)
      .where(
        and(
          eq(priceCatalogs.id, input.catalogId),
          eq(priceCatalogs.catalogType, "public"),
          eq(priceCatalogs.active, true),
        ),
      )
      .limit(1)

    return catalog ?? null
  }

  const [catalog] = await db
    .select({
      id: priceCatalogs.id,
      code: priceCatalogs.code,
      name: priceCatalogs.name,
      currencyCode: priceCatalogs.currencyCode,
    })
    .from(priceCatalogs)
    .where(and(eq(priceCatalogs.catalogType, "public"), eq(priceCatalogs.active, true)))
    .orderBy(desc(priceCatalogs.isDefault), asc(priceCatalogs.name))
    .limit(1)

  return catalog ?? null
}

export const publicPricingService = {
  async getProductPricingSnapshot(
    db: PostgresJsDatabase,
    productId: string,
    query: PublicProductPricingQuery,
  ) {
    const product = await ensurePublicProduct(db, productId)
    if (!product) {
      return null
    }

    const catalog = await resolvePublicCatalog(db, query)
    if (!catalog) {
      return null
    }

    const optionConditions = [
      eq(productOptions.productId, productId),
      eq(productOptions.status, "active"),
    ]

    if (query.optionId) {
      optionConditions.push(eq(productOptions.id, query.optionId))
    }

    const options = await db
      .select({
        id: productOptions.id,
        name: productOptions.name,
        description: productOptions.description,
        status: productOptions.status,
        isDefault: productOptions.isDefault,
      })
      .from(productOptions)
      .where(and(...optionConditions))
      .orderBy(
        desc(productOptions.isDefault),
        asc(productOptions.sortOrder),
        asc(productOptions.name),
      )

    if (options.length === 0) {
      return {
        productId,
        catalog: {
          ...catalog,
          currencyCode: catalog.currencyCode ?? product.sellCurrency,
        },
        options: [],
      }
    }

    const optionIds = options.map((option) => option.id)

    const [units, rules] = await Promise.all([
      db
        .select({
          id: optionUnits.id,
          optionId: optionUnits.optionId,
          name: optionUnits.name,
          unitType: optionUnits.unitType,
          isHidden: optionUnits.isHidden,
          sortOrder: optionUnits.sortOrder,
        })
        .from(optionUnits)
        .where(and(inArray(optionUnits.optionId, optionIds), eq(optionUnits.isHidden, false)))
        .orderBy(asc(optionUnits.sortOrder), asc(optionUnits.name)),
      db
        .select({
          id: optionPriceRules.id,
          optionId: optionPriceRules.optionId,
          name: optionPriceRules.name,
          description: optionPriceRules.description,
          pricingMode: optionPriceRules.pricingMode,
          baseSellAmountCents: optionPriceRules.baseSellAmountCents,
          minPerBooking: optionPriceRules.minPerBooking,
          maxPerBooking: optionPriceRules.maxPerBooking,
          isDefault: optionPriceRules.isDefault,
          cancellationPolicyId: optionPriceRules.cancellationPolicyId,
        })
        .from(optionPriceRules)
        .where(
          and(
            eq(optionPriceRules.productId, productId),
            inArray(optionPriceRules.optionId, optionIds),
            eq(optionPriceRules.priceCatalogId, catalog.id),
            eq(optionPriceRules.active, true),
          ),
        )
        .orderBy(desc(optionPriceRules.isDefault), asc(optionPriceRules.name)),
    ])

    const ruleIds = rules.map((rule) => rule.id)

    const [unitPrices, startTimeAdjustments] = await Promise.all([
      ruleIds.length > 0
        ? db
            .select({
              id: optionUnitPriceRules.id,
              optionPriceRuleId: optionUnitPriceRules.optionPriceRuleId,
              unitId: optionUnitPriceRules.unitId,
              pricingMode: optionUnitPriceRules.pricingMode,
              sellAmountCents: optionUnitPriceRules.sellAmountCents,
              minQuantity: optionUnitPriceRules.minQuantity,
              maxQuantity: optionUnitPriceRules.maxQuantity,
              pricingCategoryId: optionUnitPriceRules.pricingCategoryId,
              sortOrder: optionUnitPriceRules.sortOrder,
            })
            .from(optionUnitPriceRules)
            .where(
              and(
                inArray(optionUnitPriceRules.optionPriceRuleId, ruleIds),
                eq(optionUnitPriceRules.active, true),
              ),
            )
            .orderBy(asc(optionUnitPriceRules.sortOrder), asc(optionUnitPriceRules.createdAt))
        : Promise.resolve([]),
      ruleIds.length > 0
        ? db
            .select({
              id: optionStartTimeRules.id,
              optionPriceRuleId: optionStartTimeRules.optionPriceRuleId,
              startTimeId: optionStartTimeRules.startTimeId,
              label: availabilityStartTimes.label,
              startTimeLocal: availabilityStartTimes.startTimeLocal,
              durationMinutes: availabilityStartTimes.durationMinutes,
              ruleMode: optionStartTimeRules.ruleMode,
              adjustmentType: optionStartTimeRules.adjustmentType,
              sellAdjustmentCents: optionStartTimeRules.sellAdjustmentCents,
              adjustmentBasisPoints: optionStartTimeRules.adjustmentBasisPoints,
            })
            .from(optionStartTimeRules)
            .innerJoin(
              availabilityStartTimes,
              eq(availabilityStartTimes.id, optionStartTimeRules.startTimeId),
            )
            .where(
              and(
                inArray(optionStartTimeRules.optionPriceRuleId, ruleIds),
                eq(optionStartTimeRules.active, true),
                eq(availabilityStartTimes.active, true),
              ),
            )
            .orderBy(
              asc(availabilityStartTimes.sortOrder),
              asc(availabilityStartTimes.startTimeLocal),
            )
        : Promise.resolve([]),
    ])

    const unitPriceIds = unitPrices.map((unitPrice) => unitPrice.id)
    const tiers =
      unitPriceIds.length > 0
        ? await db
            .select({
              id: optionUnitTiers.id,
              optionUnitPriceRuleId: optionUnitTiers.optionUnitPriceRuleId,
              minQuantity: optionUnitTiers.minQuantity,
              maxQuantity: optionUnitTiers.maxQuantity,
              sellAmountCents: optionUnitTiers.sellAmountCents,
              sortOrder: optionUnitTiers.sortOrder,
            })
            .from(optionUnitTiers)
            .where(
              and(
                inArray(optionUnitTiers.optionUnitPriceRuleId, unitPriceIds),
                eq(optionUnitTiers.active, true),
              ),
            )
            .orderBy(asc(optionUnitTiers.sortOrder), asc(optionUnitTiers.minQuantity))
        : []

    const unitById = new Map(
      units.map((unit) => [
        unit.id,
        {
          id: unit.id,
          unitId: unit.id,
          unitName: unit.name,
          unitType: unit.unitType,
          sortOrder: unit.sortOrder,
        },
      ]),
    )

    const tiersByUnitPriceRule = new Map<string, Array<(typeof tiers)[number]>>()
    for (const tier of tiers) {
      const existing = tiersByUnitPriceRule.get(tier.optionUnitPriceRuleId) ?? []
      existing.push(tier)
      tiersByUnitPriceRule.set(tier.optionUnitPriceRuleId, existing)
    }

    const unitPricesByRule = new Map<string, Array<(typeof unitPrices)[number]>>()
    for (const unitPrice of unitPrices) {
      const existing = unitPricesByRule.get(unitPrice.optionPriceRuleId) ?? []
      existing.push(unitPrice)
      unitPricesByRule.set(unitPrice.optionPriceRuleId, existing)
    }

    const startTimeAdjustmentsByRule = new Map<
      string,
      Array<(typeof startTimeAdjustments)[number]>
    >()
    for (const adjustment of startTimeAdjustments) {
      const existing = startTimeAdjustmentsByRule.get(adjustment.optionPriceRuleId) ?? []
      existing.push(adjustment)
      startTimeAdjustmentsByRule.set(adjustment.optionPriceRuleId, existing)
    }

    const rulesByOption = new Map<string, Array<(typeof rules)[number]>>()
    for (const rule of rules) {
      const existing = rulesByOption.get(rule.optionId) ?? []
      existing.push(rule)
      rulesByOption.set(rule.optionId, existing)
    }

    return {
      productId,
      catalog: {
        ...catalog,
        currencyCode: catalog.currencyCode ?? product.sellCurrency,
      },
      options: options.map((option) => ({
        id: option.id,
        name: option.name,
        description: option.description ?? null,
        status: option.status,
        isDefault: option.isDefault,
        bookingMode: product.bookingMode,
        capacityMode: product.capacityMode,
        pricingRules: (rulesByOption.get(option.id) ?? []).map((rule) => ({
          id: rule.id,
          name: rule.name,
          description: rule.description ?? null,
          pricingMode: rule.pricingMode,
          baseSellAmountCents: rule.baseSellAmountCents ?? null,
          minPerBooking: rule.minPerBooking ?? null,
          maxPerBooking: rule.maxPerBooking ?? null,
          isDefault: rule.isDefault,
          cancellationPolicyId: rule.cancellationPolicyId ?? null,
          unitPrices: (unitPricesByRule.get(rule.id) ?? [])
            .map((unitPrice) => {
              const unit = unitById.get(unitPrice.unitId)
              if (!unit) {
                return null
              }

              return {
                id: unitPrice.id,
                unitId: unit.unitId,
                unitName: unit.unitName,
                unitType: unit.unitType,
                pricingMode: unitPrice.pricingMode,
                sellAmountCents: unitPrice.sellAmountCents ?? null,
                minQuantity: unitPrice.minQuantity ?? null,
                maxQuantity: unitPrice.maxQuantity ?? null,
                pricingCategoryId: unitPrice.pricingCategoryId ?? null,
                sortOrder: unitPrice.sortOrder,
                tiers: (tiersByUnitPriceRule.get(unitPrice.id) ?? []).map((tier) => ({
                  id: tier.id,
                  minQuantity: tier.minQuantity,
                  maxQuantity: tier.maxQuantity ?? null,
                  sellAmountCents: tier.sellAmountCents ?? null,
                  sortOrder: tier.sortOrder,
                })),
              }
            })
            .filter((value): value is NonNullable<typeof value> => value !== null),
          startTimeAdjustments: (startTimeAdjustmentsByRule.get(rule.id) ?? []).map(
            (adjustment) => ({
              id: adjustment.id,
              startTimeId: adjustment.startTimeId,
              label: adjustment.label ?? null,
              startTimeLocal: adjustment.startTimeLocal,
              ruleMode: adjustment.ruleMode,
              adjustmentType: adjustment.adjustmentType ?? null,
              sellAdjustmentCents: adjustment.sellAdjustmentCents ?? null,
              adjustmentBasisPoints: adjustment.adjustmentBasisPoints ?? null,
            }),
          ),
        })),
      })),
    }
  },

  async getAvailabilitySnapshot(
    db: PostgresJsDatabase,
    productId: string,
    query: PublicAvailabilitySnapshotQuery,
  ) {
    const product = await ensurePublicProduct(db, productId)
    if (!product) {
      return null
    }

    const conditions = [
      eq(availabilitySlots.productId, productId),
      ne(availabilitySlots.status, "cancelled"),
    ]

    if (query.optionId) {
      conditions.push(eq(availabilitySlots.optionId, query.optionId))
    }

    if (query.dateFrom) {
      conditions.push(gte(availabilitySlots.dateLocal, query.dateFrom))
    }

    if (query.dateTo) {
      conditions.push(lte(availabilitySlots.dateLocal, query.dateTo))
    }

    if (query.status) {
      conditions.push(eq(availabilitySlots.status, query.status))
    } else {
      conditions.push(
        or(eq(availabilitySlots.status, "open"), eq(availabilitySlots.status, "sold_out")) ??
          sql`1 = 1`,
      )
    }

    const where = and(...conditions)

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: availabilitySlots.id,
          optionId: availabilitySlots.optionId,
          dateLocal: availabilitySlots.dateLocal,
          startsAt: availabilitySlots.startsAt,
          endsAt: availabilitySlots.endsAt,
          timezone: availabilitySlots.timezone,
          status: availabilitySlots.status,
          unlimited: availabilitySlots.unlimited,
          remainingPax: availabilitySlots.remainingPax,
          remainingResources: availabilitySlots.remainingResources,
          pastCutoff: availabilitySlots.pastCutoff,
          tooEarly: availabilitySlots.tooEarly,
          startTimeId: availabilityStartTimes.id,
          startTimeLabel: availabilityStartTimes.label,
          startTimeLocal: availabilityStartTimes.startTimeLocal,
          durationMinutes: availabilityStartTimes.durationMinutes,
        })
        .from(availabilitySlots)
        .leftJoin(
          availabilityStartTimes,
          eq(availabilityStartTimes.id, availabilitySlots.startTimeId),
        )
        .where(where)
        .orderBy(asc(availabilitySlots.startsAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: sql<number>`count(*)::int` }).from(availabilitySlots).where(where),
    ])

    return {
      productId,
      slots: rows.map((row) => ({
        id: row.id,
        optionId: row.optionId ?? null,
        dateLocal: normalizeDate(row.dateLocal),
        startsAt: normalizeDate(row.startsAt),
        endsAt: normalizeDate(row.endsAt),
        timezone: row.timezone,
        status: row.status,
        unlimited: row.unlimited,
        remainingPax: row.remainingPax ?? null,
        remainingResources: row.remainingResources ?? null,
        pastCutoff: row.pastCutoff,
        tooEarly: row.tooEarly,
        startTime: row.startTimeId
          ? {
              id: row.startTimeId,
              label: row.startTimeLabel ?? null,
              startTimeLocal: row.startTimeLocal ?? "",
              durationMinutes: row.durationMinutes ?? null,
            }
          : null,
      })),
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },
}
