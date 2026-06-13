import { loadDeparturePriceOverrides } from "@voyantjs/commerce/pricing"
import {
  extraPriceRules,
  optionPriceRules,
  optionUnitPriceRules,
  optionUnitTiers,
  priceCatalogs,
} from "@voyantjs/commerce/pricing/schema"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  listOptionUnitFacts,
  loadProductOptionFacts,
  loadProductPricingFacts,
} from "./service-boundary-sql.js"
import type { SlotRow } from "./service-departures-core.js"

export type PricingContext = {
  product: {
    id: string
    sellCurrency: string
    sellAmountCents: number | null
    capacityMode: string
  } | null
  catalog: {
    id: string
    currencyCode: string | null
  } | null
  option: {
    id: string
    name: string
    description: string | null
  } | null
  rule: {
    id: string
    name: string
    description: string | null
    pricingMode: string
    baseSellAmountCents: number | null
  } | null
  units: Array<{
    id: string
    name: string
    unitType: string
    minAge: number | null
    maxAge: number | null
    occupancyMin: number | null
    occupancyMax: number | null
    isRequired: boolean
  }>
  unitRules: Array<{
    id: string
    unitId: string
    pricingMode: string
    sellAmountCents: number | null
    minQuantity: number | null
    maxQuantity: number | null
    sortOrder: number
  }>
  tiers: Array<{
    id: string
    optionUnitPriceRuleId: string
    minQuantity: number
    maxQuantity: number | null
    sellAmountCents: number | null
    sortOrder: number
  }>
  extraRules: Array<{
    id: string
    productExtraId: string | null
    pricingMode: string
    sellAmountCents: number | null
    sortOrder: number
  }>
  unitPriceOverrides: Map<
    string,
    {
      sellAmountCents: number
      costAmountCents: number | null
    }
  >
}

export function centsToAmount(cents: number | null | undefined) {
  if (cents == null) {
    return null
  }

  return Number((cents / 100).toFixed(2))
}

export function amountToCents(amount: number) {
  return Math.round(amount * 100)
}

export function convertCents(cents: number | null | undefined, rate: number | null | undefined) {
  if (cents == null) {
    return null
  }

  return rate == null ? cents : Math.round(cents * rate)
}

export function convertedAmount(cents: number | null | undefined, rate: number | null | undefined) {
  return centsToAmount(convertCents(cents, rate))
}

export function getPreferredCurrency(context: PricingContext) {
  return context.catalog?.currencyCode ?? context.product?.sellCurrency ?? "EUR"
}

export function selectUnitTier(
  unitRule: PricingContext["unitRules"][number] | undefined,
  tiers: PricingContext["tiers"],
  quantity: number,
) {
  if (!unitRule) {
    return null
  }

  return (
    tiers
      .filter(
        (row) =>
          row.optionUnitPriceRuleId === unitRule.id &&
          quantity >= row.minQuantity &&
          (row.maxQuantity == null || quantity <= row.maxQuantity),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null
  )
}

export function selectTierAmount(
  unitRule: PricingContext["unitRules"][number] | undefined,
  tiers: PricingContext["tiers"],
  quantity: number,
) {
  if (!unitRule) {
    return null
  }

  const tier = selectUnitTier(unitRule, tiers, quantity)

  return tier?.sellAmountCents ?? unitRule.sellAmountCents ?? null
}

export function selectUnitAmount(
  context: PricingContext,
  unitRule: PricingContext["unitRules"][number] | undefined,
  quantity: number,
) {
  if (!unitRule) {
    return null
  }

  return (
    context.unitPriceOverrides.get(unitRule.unitId)?.sellAmountCents ??
    selectTierAmount(unitRule, context.tiers, quantity)
  )
}

function findNamedUnit(
  units: PricingContext["units"],
  matcher: (unit: PricingContext["units"][number]) => boolean,
) {
  return units.find(matcher) ?? null
}

export function buildTravelerRequestedUnits(args: {
  units: PricingContext["units"]
  adults: number
  children: number
  infants: number
}) {
  const requestedUnits: Array<{ unitId?: string; requestRef?: string; quantity: number }> = []
  const normalized = args.units.filter((unit) => unit.unitType === "person")

  const adultUnit =
    findNamedUnit(
      normalized,
      (unit) =>
        (unit.maxAge == null || unit.maxAge >= 18) &&
        (unit.minAge == null || unit.minAge < 18) &&
        !/child|infant/i.test(unit.name),
    ) ?? normalized[0]

  const childUnit =
    findNamedUnit(
      normalized,
      (unit) => /child/i.test(unit.name) || ((unit.maxAge ?? 99) < 18 && (unit.maxAge ?? 99) > 2),
    ) ?? null

  const infantUnit =
    findNamedUnit(
      normalized,
      (unit) => /infant/i.test(unit.name) || (unit.maxAge != null && unit.maxAge <= 2),
    ) ?? null

  if (args.adults > 0) {
    requestedUnits.push(
      adultUnit
        ? { unitId: adultUnit.id, requestRef: adultUnit.id, quantity: args.adults }
        : { quantity: args.adults },
    )
  }

  if (args.children > 0) {
    requestedUnits.push(
      childUnit
        ? { unitId: childUnit.id, requestRef: childUnit.id, quantity: args.children }
        : { quantity: args.children },
    )
  }

  if (args.infants > 0) {
    requestedUnits.push(
      infantUnit
        ? { unitId: infantUnit.id, requestRef: infantUnit.id, quantity: args.infants }
        : { quantity: args.infants },
    )
  }

  return requestedUnits
}

export async function resolvePricingContext(
  db: PostgresJsDatabase,
  productId: string,
  optionId?: string | null,
  departureId?: string | null,
): Promise<PricingContext> {
  const product = await loadProductPricingFacts(db, productId)

  const [catalog] = await db
    .select({
      id: priceCatalogs.id,
      currencyCode: priceCatalogs.currencyCode,
    })
    .from(priceCatalogs)
    .where(and(eq(priceCatalogs.catalogType, "public"), eq(priceCatalogs.active, true)))
    .orderBy(desc(priceCatalogs.isDefault), asc(priceCatalogs.name))
    .limit(1)

  const resolvedOption = await loadProductOptionFacts(db, { productId, optionId })

  if (!resolvedOption || !catalog) {
    return {
      product: product ?? null,
      catalog: catalog ?? null,
      option: resolvedOption ?? null,
      rule: null,
      units: [],
      unitRules: [],
      tiers: [],
      extraRules: [],
      unitPriceOverrides: new Map(),
    }
  }

  const [rule] = await db
    .select({
      id: optionPriceRules.id,
      name: optionPriceRules.name,
      description: optionPriceRules.description,
      pricingMode: optionPriceRules.pricingMode,
      baseSellAmountCents: optionPriceRules.baseSellAmountCents,
    })
    .from(optionPriceRules)
    .where(
      and(
        eq(optionPriceRules.productId, productId),
        eq(optionPriceRules.optionId, resolvedOption.id),
        eq(optionPriceRules.priceCatalogId, catalog.id),
        eq(optionPriceRules.active, true),
      ),
    )
    .orderBy(desc(optionPriceRules.isDefault), asc(optionPriceRules.name))
    .limit(1)

  const units = await listOptionUnitFacts(db, resolvedOption.id)

  if (!rule) {
    return {
      product: product ?? null,
      catalog,
      option: resolvedOption,
      rule: null,
      units,
      unitRules: [],
      tiers: [],
      extraRules: [],
      unitPriceOverrides: new Map(),
    }
  }

  const unitRules = await db
    .select({
      id: optionUnitPriceRules.id,
      unitId: optionUnitPriceRules.unitId,
      pricingMode: optionUnitPriceRules.pricingMode,
      sellAmountCents: optionUnitPriceRules.sellAmountCents,
      minQuantity: optionUnitPriceRules.minQuantity,
      maxQuantity: optionUnitPriceRules.maxQuantity,
      sortOrder: optionUnitPriceRules.sortOrder,
    })
    .from(optionUnitPriceRules)
    .where(
      and(
        eq(optionUnitPriceRules.optionPriceRuleId, rule.id),
        eq(optionUnitPriceRules.active, true),
      ),
    )
    .orderBy(asc(optionUnitPriceRules.sortOrder), asc(optionUnitPriceRules.createdAt))

  const tiers =
    unitRules.length > 0
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
              inArray(
                optionUnitTiers.optionUnitPriceRuleId,
                unitRules.map((unitRule) => unitRule.id),
              ),
              eq(optionUnitTiers.active, true),
            ),
          )
          .orderBy(asc(optionUnitTiers.sortOrder), asc(optionUnitTiers.minQuantity))
      : []

  const extraRules = await db
    .select({
      id: extraPriceRules.id,
      productExtraId: extraPriceRules.productExtraId,
      pricingMode: extraPriceRules.pricingMode,
      sellAmountCents: extraPriceRules.sellAmountCents,
      sortOrder: extraPriceRules.sortOrder,
    })
    .from(extraPriceRules)
    .where(and(eq(extraPriceRules.optionPriceRuleId, rule.id), eq(extraPriceRules.active, true)))
    .orderBy(asc(extraPriceRules.sortOrder), asc(extraPriceRules.createdAt))

  const unitPriceOverrides = departureId
    ? await loadDeparturePriceOverrides(db, {
        departureId,
        catalogId: catalog.id,
      })
    : new Map()

  return {
    product: product ?? null,
    catalog,
    option: resolvedOption,
    rule,
    units,
    unitRules,
    tiers,
    extraRules,
    unitPriceOverrides,
  }
}

export function buildRatePlans(context: PricingContext) {
  if (!context.rule) {
    return []
  }

  const currencyCode = getPreferredCurrency(context)
  const roomPrices = context.units
    .filter((unit) => unit.unitType === "room")
    .map((unit) => {
      const unitRule = context.unitRules.find((row) => row.unitId === unit.id)
      const quantityHint = Math.max(1, unit.occupancyMax ?? unit.occupancyMin ?? 1)
      const amount = centsToAmount(selectUnitAmount(context, unitRule, quantityHint))
      if (amount == null) {
        return null
      }

      return {
        amount,
        currencyCode,
        roomType: {
          id: unit.id,
          name: unit.name,
          occupancy: {
            adultsMin: unit.occupancyMin ?? 1,
            adultsMax: unit.occupancyMax ?? Math.max(2, unit.occupancyMin ?? 1),
            childrenMax: Math.max(
              0,
              (unit.occupancyMax ?? Math.max(2, unit.occupancyMin ?? 1)) - (unit.occupancyMin ?? 1),
            ),
          },
        },
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)

  const baseAmount = centsToAmount(context.rule.baseSellAmountCents)

  return [
    {
      id: context.rule.id,
      active: true,
      name: context.rule.name,
      pricingModel: roomPrices.length > 0 ? "per_room_person" : context.rule.pricingMode,
      basePrices:
        baseAmount == null
          ? []
          : [
              {
                amount: baseAmount,
                currencyCode,
              },
            ],
      roomPrices,
    },
  ]
}

export function buildDepartureStatus(slot: SlotRow, context: PricingContext) {
  if (slot.status === "open" && context.product?.capacityMode === "on_request") {
    return "on_request" as const
  }

  return slot.status
}
