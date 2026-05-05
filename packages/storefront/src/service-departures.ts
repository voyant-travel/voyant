import { availabilitySlots, availabilityStartTimes } from "@voyantjs/availability/schema"
import { productExtras } from "@voyantjs/extras/schema"
import {
  extraPriceRules,
  optionPriceRules,
  optionUnitPriceRules,
  optionUnitTiers,
  priceCatalogs,
} from "@voyantjs/pricing/schema"
import {
  optionUnits,
  productDayServices,
  productDays,
  productItineraries,
  productLocations,
  productMedia,
  productOptions,
  products,
} from "@voyantjs/products/schema"
import { sellabilityService } from "@voyantjs/sellability"
import { and, asc, count, desc, eq, gte, inArray, lte, ne } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type {
  StorefrontDepartureListQuery,
  StorefrontDeparturePricePreviewInput,
  StorefrontProductAvailabilitySummaryQuery,
} from "./validation.js"

type SlotRow = {
  id: string
  productId: string
  itineraryId: string | null
  optionId: string | null
  startTimeId: string | null
  dateLocal: Date | string
  startsAt: Date | string
  endsAt: Date | string | null
  timezone: string
  status: "open" | "closed" | "sold_out" | "cancelled"
  unlimited: boolean
  initialPax: number | null
  remainingPax: number | null
  remainingResources: number | null
  pastCutoff: boolean
  tooEarly: boolean
  nights: number | null
  days: number | null
  startTimeLabel: string | null
  startTimeLocal: string | null
  durationMinutes: number | null
}

type PricingContext = {
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
}

function normalizeIso(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
}

function normalizeLocalDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).slice(0, 10)
}

function centsToAmount(cents: number | null | undefined) {
  if (cents == null) {
    return null
  }

  return Number((cents / 100).toFixed(2))
}

function getPreferredCurrency(context: PricingContext) {
  return context.catalog?.currencyCode ?? context.product?.sellCurrency ?? "EUR"
}

function selectTierAmount(
  unitRule: PricingContext["unitRules"][number] | undefined,
  tiers: PricingContext["tiers"],
  quantity: number,
) {
  if (!unitRule) {
    return null
  }

  const tier = tiers
    .filter(
      (row) =>
        row.optionUnitPriceRuleId === unitRule.id &&
        quantity >= row.minQuantity &&
        (row.maxQuantity == null || quantity <= row.maxQuantity),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]

  return tier?.sellAmountCents ?? unitRule.sellAmountCents ?? null
}

function findNamedUnit(
  units: PricingContext["units"],
  matcher: (unit: PricingContext["units"][number]) => boolean,
) {
  return units.find(matcher) ?? null
}

function buildTravelerRequestedUnits(args: {
  units: PricingContext["units"]
  adults: number
  children: number
  infants: number
}) {
  const requestedUnits: Array<{ unitId?: string; requestRef?: string; quantity: number }> = []
  const normalized = args.units.filter((unit) => unit.unitType === "person" && !unit.isRequired)

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

async function listMeetingPointsByProductIds(db: PostgresJsDatabase, productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, string>()
  }

  const rows = await db
    .select({
      productId: productLocations.productId,
      title: productLocations.title,
      locationType: productLocations.locationType,
    })
    .from(productLocations)
    .where(inArray(productLocations.productId, productIds))
    .orderBy(
      productLocations.locationType,
      asc(productLocations.sortOrder),
      asc(productLocations.createdAt),
    )

  const byProduct = new Map<string, string>()
  for (const row of rows) {
    if (byProduct.has(row.productId)) {
      continue
    }

    byProduct.set(row.productId, row.title)
  }

  return byProduct
}

async function listDefaultItineraryIdsByProductIds(
  db: PostgresJsDatabase,
  productIds: string[],
): Promise<Map<string, string>> {
  if (productIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .select({
      productId: productItineraries.productId,
      itineraryId: productItineraries.id,
    })
    .from(productItineraries)
    .where(
      and(
        inArray(productItineraries.productId, productIds),
        eq(productItineraries.isDefault, true),
      ),
    )
    .orderBy(asc(productItineraries.sortOrder), asc(productItineraries.createdAt))

  return new Map(rows.map((row) => [row.productId, row.itineraryId] as const))
}

async function listSlots(
  db: PostgresJsDatabase,
  filters: {
    productId?: string
    slotId?: string
    optionId?: string
    status?: "open" | "closed" | "sold_out" | "cancelled"
    dateFrom?: string
    dateTo?: string
    limit?: number
    offset?: number
    includeCancelled?: boolean
  } = {},
) {
  const conditions = [
    eq(products.status, "active"),
    eq(products.activated, true),
    eq(products.visibility, "public"),
  ]

  if (filters.productId) {
    conditions.push(eq(availabilitySlots.productId, filters.productId))
  }

  if (filters.slotId) {
    conditions.push(eq(availabilitySlots.id, filters.slotId))
  }

  if (filters.optionId) {
    conditions.push(eq(availabilitySlots.optionId, filters.optionId))
  }

  if (filters.status) {
    conditions.push(eq(availabilitySlots.status, filters.status))
  } else if (!filters.includeCancelled) {
    conditions.push(ne(availabilitySlots.status, "cancelled"))
  }

  if (filters.dateFrom) {
    conditions.push(gte(availabilitySlots.dateLocal, filters.dateFrom))
  }

  if (filters.dateTo) {
    conditions.push(lte(availabilitySlots.dateLocal, filters.dateTo))
  }

  return db
    .select({
      id: availabilitySlots.id,
      productId: availabilitySlots.productId,
      itineraryId: availabilitySlots.itineraryId,
      optionId: availabilitySlots.optionId,
      startTimeId: availabilitySlots.startTimeId,
      dateLocal: availabilitySlots.dateLocal,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
      timezone: availabilitySlots.timezone,
      status: availabilitySlots.status,
      unlimited: availabilitySlots.unlimited,
      initialPax: availabilitySlots.initialPax,
      remainingPax: availabilitySlots.remainingPax,
      remainingResources: availabilitySlots.remainingResources,
      pastCutoff: availabilitySlots.pastCutoff,
      tooEarly: availabilitySlots.tooEarly,
      nights: availabilitySlots.nights,
      days: availabilitySlots.days,
      startTimeLabel: availabilityStartTimes.label,
      startTimeLocal: availabilityStartTimes.startTimeLocal,
      durationMinutes: availabilityStartTimes.durationMinutes,
    })
    .from(availabilitySlots)
    .innerJoin(products, eq(products.id, availabilitySlots.productId))
    .leftJoin(availabilityStartTimes, eq(availabilityStartTimes.id, availabilitySlots.startTimeId))
    .where(and(...conditions))
    .orderBy(asc(availabilitySlots.startsAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)
}

async function countSlots(
  db: PostgresJsDatabase,
  filters: {
    productId?: string
    slotId?: string
    optionId?: string
    status?: "open" | "closed" | "sold_out" | "cancelled"
    dateFrom?: string
    dateTo?: string
    includeCancelled?: boolean
  } = {},
) {
  const conditions = [
    eq(products.status, "active"),
    eq(products.activated, true),
    eq(products.visibility, "public"),
  ]

  if (filters.productId) {
    conditions.push(eq(availabilitySlots.productId, filters.productId))
  }

  if (filters.slotId) {
    conditions.push(eq(availabilitySlots.id, filters.slotId))
  }

  if (filters.optionId) {
    conditions.push(eq(availabilitySlots.optionId, filters.optionId))
  }

  if (filters.status) {
    conditions.push(eq(availabilitySlots.status, filters.status))
  } else if (!filters.includeCancelled) {
    conditions.push(ne(availabilitySlots.status, "cancelled"))
  }

  if (filters.dateFrom) {
    conditions.push(gte(availabilitySlots.dateLocal, filters.dateFrom))
  }

  if (filters.dateTo) {
    conditions.push(lte(availabilitySlots.dateLocal, filters.dateTo))
  }

  const [result] = await db
    .select({ value: count() })
    .from(availabilitySlots)
    .innerJoin(products, eq(products.id, availabilitySlots.productId))
    .where(and(...conditions))

  return result?.value ?? 0
}

async function resolvePricingContext(
  db: PostgresJsDatabase,
  productId: string,
  optionId?: string | null,
): Promise<PricingContext> {
  const [product] = await db
    .select({
      id: products.id,
      sellCurrency: products.sellCurrency,
      sellAmountCents: products.sellAmountCents,
      capacityMode: products.capacityMode,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  const [catalog] = await db
    .select({
      id: priceCatalogs.id,
      currencyCode: priceCatalogs.currencyCode,
    })
    .from(priceCatalogs)
    .where(and(eq(priceCatalogs.catalogType, "public"), eq(priceCatalogs.active, true)))
    .orderBy(desc(priceCatalogs.isDefault), asc(priceCatalogs.name))
    .limit(1)

  const [resolvedOption] = await db
    .select({
      id: productOptions.id,
      name: productOptions.name,
      description: productOptions.description,
    })
    .from(productOptions)
    .where(
      and(
        eq(productOptions.productId, productId),
        eq(productOptions.status, "active"),
        optionId ? eq(productOptions.id, optionId) : undefined,
      ),
    )
    .orderBy(
      desc(productOptions.isDefault),
      asc(productOptions.sortOrder),
      asc(productOptions.name),
    )
    .limit(1)

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

  const units = await db
    .select({
      id: optionUnits.id,
      name: optionUnits.name,
      unitType: optionUnits.unitType,
      minAge: optionUnits.minAge,
      maxAge: optionUnits.maxAge,
      occupancyMin: optionUnits.occupancyMin,
      occupancyMax: optionUnits.occupancyMax,
      isRequired: optionUnits.isRequired,
    })
    .from(optionUnits)
    .where(and(eq(optionUnits.optionId, resolvedOption.id), eq(optionUnits.isHidden, false)))
    .orderBy(asc(optionUnits.sortOrder), asc(optionUnits.name))

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

  return {
    product: product ?? null,
    catalog,
    option: resolvedOption,
    rule,
    units,
    unitRules,
    tiers,
    extraRules,
  }
}

function buildRatePlans(context: PricingContext) {
  if (!context.rule) {
    return []
  }

  const currencyCode = getPreferredCurrency(context)
  const roomPrices = context.units
    .filter((unit) => unit.unitType === "room")
    .map((unit) => {
      const unitRule = context.unitRules.find((row) => row.unitId === unit.id)
      const quantityHint = Math.max(1, unit.occupancyMax ?? unit.occupancyMin ?? 1)
      const amount = centsToAmount(selectTierAmount(unitRule, context.tiers, quantityHint))
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

function buildDepartureStatus(slot: SlotRow, context: PricingContext) {
  if (slot.status === "open" && context.product?.capacityMode === "on_request") {
    return "on_request" as const
  }

  return slot.status
}

function computeFallbackLineItems(args: {
  context: PricingContext
  adults: number
  children: number
  infants: number
  rooms: Array<{ unitId: string; occupancy: number; quantity: number }>
}) {
  const lineItems: Array<{ name: string; total: number; quantity: number; unitPrice: number }> = []
  const currencyCode = getPreferredCurrency(args.context)
  let total = 0

  if (args.rooms.length > 0) {
    for (const room of args.rooms) {
      const unitRule = args.context.unitRules.find((row) => row.unitId === room.unitId)
      if (!unitRule) {
        continue
      }

      const amountCents = selectTierAmount(
        unitRule,
        args.context.tiers,
        Math.max(1, room.occupancy * room.quantity),
      )
      const unitAmount = centsToAmount(amountCents) ?? 0
      const quantity =
        unitRule.pricingMode === "per_person"
          ? Math.max(1, room.occupancy * room.quantity)
          : Math.max(1, room.quantity)
      const totalAmount = Number((unitAmount * quantity).toFixed(2))
      total += totalAmount
      const unit = args.context.units.find((row) => row.id === room.unitId)
      lineItems.push({
        name: unit?.name ?? room.unitId,
        total: totalAmount,
        quantity,
        unitPrice: unitAmount,
      })
    }
  } else {
    const requested = buildTravelerRequestedUnits({
      units: args.context.units,
      adults: args.adults,
      children: args.children,
      infants: args.infants,
    })

    for (const request of requested) {
      const unitRule = request.unitId
        ? args.context.unitRules.find((row) => row.unitId === request.unitId)
        : args.context.unitRules[0]
      if (!unitRule) {
        continue
      }

      const unitAmount =
        centsToAmount(selectTierAmount(unitRule, args.context.tiers, request.quantity)) ?? 0
      const totalAmount = Number((unitAmount * request.quantity).toFixed(2))
      total += totalAmount
      const unit = request.unitId
        ? args.context.units.find((row) => row.id === request.unitId)
        : null
      lineItems.push({
        name: unit?.name ?? args.context.option?.name ?? "Traveler",
        total: totalAmount,
        quantity: request.quantity,
        unitPrice: unitAmount,
      })
    }
  }

  if (lineItems.length === 0 && args.context.product?.sellAmountCents != null) {
    const pax = Math.max(1, args.adults + args.children + args.infants)
    const unitAmount = centsToAmount(args.context.product.sellAmountCents) ?? 0
    const totalAmount = Number((unitAmount * pax).toFixed(2))
    total += totalAmount
    lineItems.push({
      name: args.context.option?.name ?? "Base",
      total: totalAmount,
      quantity: pax,
      unitPrice: unitAmount,
    })
  }

  return {
    currencyCode,
    total: Number(total.toFixed(2)),
    lineItems,
  }
}

async function applyExtraLineItems(args: {
  db: PostgresJsDatabase
  productId: string
  context: PricingContext
  paxTotal: number
  extras: Array<{ extraId: string; quantity: number }>
  lineItems: Array<{ name: string; total: number; quantity: number; unitPrice: number }>
  total: number
}) {
  if (args.extras.length === 0) {
    return { lineItems: args.lineItems, total: args.total }
  }

  const extras = await args.db
    .select({
      id: productExtras.id,
      name: productExtras.name,
      pricingMode: productExtras.pricingMode,
      pricedPerPerson: productExtras.pricedPerPerson,
    })
    .from(productExtras)
    .where(
      and(
        eq(productExtras.productId, args.productId),
        eq(productExtras.active, true),
        inArray(
          productExtras.id,
          args.extras.map((extra) => extra.extraId),
        ),
      ),
    )

  const ruleByExtraId = new Map(
    args.context.extraRules
      .filter((rule) => rule.productExtraId)
      .map((rule) => [rule.productExtraId as string, rule] as const),
  )

  let total = args.total
  const lineItems = [...args.lineItems]

  for (const extraSelection of args.extras) {
    const extra = extras.find((row) => row.id === extraSelection.extraId)
    if (!extra) {
      continue
    }

    const rule = ruleByExtraId.get(extraSelection.extraId)
    const pricingMode =
      rule?.pricingMode ?? (extra.pricedPerPerson ? "per_person" : extra.pricingMode)
    const unitAmount = centsToAmount(rule?.sellAmountCents) ?? 0

    if (
      pricingMode === "included" ||
      pricingMode === "free" ||
      pricingMode === "unavailable" ||
      pricingMode === "on_request"
    ) {
      continue
    }

    const quantity =
      pricingMode === "per_person"
        ? Math.max(1, args.paxTotal * Math.max(1, extraSelection.quantity))
        : Math.max(1, extraSelection.quantity)

    const totalAmount = Number((unitAmount * quantity).toFixed(2))
    total += totalAmount
    lineItems.push({
      name: extra.name,
      total: totalAmount,
      quantity,
      unitPrice: unitAmount,
    })
  }

  return {
    lineItems,
    total: Number(total.toFixed(2)),
  }
}

async function buildDeparture(
  db: PostgresJsDatabase,
  slot: SlotRow,
  defaultItineraryByProduct: Map<string, string>,
  meetingPointByProduct?: Map<string, string>,
) {
  const context = await resolvePricingContext(db, slot.productId, slot.optionId)
  const itineraryId = slot.itineraryId ?? defaultItineraryByProduct.get(slot.productId) ?? null

  return {
    id: slot.id,
    productId: slot.productId,
    itineraryId: itineraryId ?? slot.id,
    optionId: slot.optionId,
    dateLocal: normalizeLocalDate(slot.dateLocal),
    startAt: normalizeIso(slot.startsAt),
    endAt: normalizeIso(slot.endsAt),
    timezone: slot.timezone,
    startTime:
      slot.startTimeId == null
        ? null
        : {
            id: slot.startTimeId,
            label: slot.startTimeLabel,
            startTimeLocal: slot.startTimeLocal ?? "00:00",
            durationMinutes: slot.durationMinutes,
          },
    meetingPoint: meetingPointByProduct?.get(slot.productId) ?? null,
    capacity: slot.unlimited ? null : (slot.initialPax ?? slot.remainingPax ?? null),
    remaining: slot.remainingPax ?? slot.remainingResources ?? null,
    departureStatus: buildDepartureStatus(slot, context),
    nights: slot.nights,
    days: slot.days,
    ratePlans: buildRatePlans(context),
  }
}

export async function getStorefrontDeparture(db: PostgresJsDatabase, departureId: string) {
  const [slot] = await listSlots(db, { slotId: departureId, limit: 1 })
  if (!slot) {
    return null
  }

  const [meetingPointByProduct, defaultItineraryByProduct] = await Promise.all([
    listMeetingPointsByProductIds(db, [slot.productId]),
    listDefaultItineraryIdsByProductIds(db, [slot.productId]),
  ])

  return buildDeparture(db, slot, defaultItineraryByProduct, meetingPointByProduct)
}

export async function listStorefrontProductDepartures(
  db: PostgresJsDatabase,
  productId: string,
  query: StorefrontDepartureListQuery,
) {
  const filters = {
    productId,
    optionId: query.optionId,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  }
  const [slots, total] = await Promise.all([
    listSlots(db, {
      ...filters,
      limit: query.limit,
      offset: query.offset,
    }),
    countSlots(db, filters),
  ])
  const [meetingPointByProduct, defaultItineraryByProduct] = await Promise.all([
    listMeetingPointsByProductIds(db, [productId]),
    listDefaultItineraryIdsByProductIds(db, [productId]),
  ])
  const data = await Promise.all(
    slots.map((slot) => buildDeparture(db, slot, defaultItineraryByProduct, meetingPointByProduct)),
  )

  return {
    data,
    total,
    limit: query.limit,
    offset: query.offset,
  }
}

type StorefrontProductAvailabilityState =
  | "available"
  | "sold_out"
  | "closed"
  | "cancelled"
  | "on_request"
  | "past_cutoff"
  | "too_early"
  | "unavailable"

function todayLocalDate() {
  return new Date().toISOString().slice(0, 10)
}

function buildAvailabilityState(args: {
  status: "open" | "closed" | "sold_out" | "cancelled" | "on_request"
  remaining: number | null
  capacity: number | null
  pastCutoff: boolean
  tooEarly: boolean
}): StorefrontProductAvailabilityState {
  if (args.status === "cancelled") return "cancelled"
  if (args.status === "closed") return "closed"
  if (args.status === "sold_out") return "sold_out"
  if (args.status === "on_request") return "on_request"
  if (args.pastCutoff) return "past_cutoff"
  if (args.tooEarly) return "too_early"
  if (args.capacity != null && args.remaining === 0) return "sold_out"

  return "available"
}

function summarizeProductAvailability(
  departures: Array<{
    availabilityState: StorefrontProductAvailabilityState
    status: "open" | "closed" | "sold_out" | "cancelled" | "on_request"
  }>,
): StorefrontProductAvailabilityState {
  if (departures.some((departure) => departure.availabilityState === "available")) {
    return "available"
  }
  if (departures.some((departure) => departure.availabilityState === "on_request")) {
    return "on_request"
  }
  if (departures.some((departure) => departure.availabilityState === "too_early")) {
    return "too_early"
  }
  if (departures.some((departure) => departure.availabilityState === "past_cutoff")) {
    return "past_cutoff"
  }
  if (departures.some((departure) => departure.availabilityState === "sold_out")) {
    return "sold_out"
  }
  if (departures.some((departure) => departure.availabilityState === "closed")) {
    return "closed"
  }
  if (departures.some((departure) => departure.availabilityState === "cancelled")) {
    return "cancelled"
  }

  return "unavailable"
}

export async function getStorefrontProductAvailabilitySummary(
  db: PostgresJsDatabase,
  productId: string,
  query: StorefrontProductAvailabilitySummaryQuery,
) {
  const requestedStatus = query.status
  const persistedStatus = requestedStatus === "on_request" ? "open" : requestedStatus
  const filters = {
    productId,
    optionId: query.optionId,
    status: persistedStatus,
    dateFrom: query.dateFrom ?? todayLocalDate(),
    dateTo: query.dateTo,
    includeCancelled: true,
  }
  const [slots, total] = await Promise.all([
    listSlots(db, {
      ...filters,
      limit: query.limit,
      offset: query.offset,
    }),
    countSlots(db, filters),
  ])
  const [meetingPointByProduct, defaultItineraryByProduct] = await Promise.all([
    listMeetingPointsByProductIds(db, [productId]),
    listDefaultItineraryIdsByProductIds(db, [productId]),
  ])
  const departures = (
    await Promise.all(
      slots.map(async (slot) => {
        const departure = await buildDeparture(
          db,
          slot,
          defaultItineraryByProduct,
          meetingPointByProduct,
        )
        const availabilityState = buildAvailabilityState({
          status: departure.departureStatus,
          remaining: departure.remaining,
          capacity: departure.capacity,
          pastCutoff: slot.pastCutoff,
          tooEarly: slot.tooEarly,
        })

        return {
          id: departure.id,
          productId: departure.productId,
          optionId: departure.optionId,
          dateLocal: departure.dateLocal,
          startAt: departure.startAt,
          endAt: departure.endAt,
          timezone: departure.timezone,
          status: departure.departureStatus,
          availabilityState,
          capacity: departure.capacity,
          remaining: departure.remaining,
          pastCutoff: slot.pastCutoff,
          tooEarly: slot.tooEarly,
        }
      }),
    )
  ).filter((departure) => !requestedStatus || departure.status === requestedStatus)

  const counts = departures.reduce(
    (acc, departure) => {
      acc.total += 1
      if (departure.status === "open") acc.open += 1
      if (departure.status === "closed") acc.closed += 1
      if (departure.status === "sold_out") acc.soldOut += 1
      if (departure.status === "cancelled") acc.cancelled += 1
      if (departure.status === "on_request") acc.onRequest += 1
      if (departure.availabilityState === "past_cutoff") acc.pastCutoff += 1
      if (departure.availabilityState === "too_early") acc.tooEarly += 1
      if (departure.availabilityState === "available") acc.available += 1
      return acc
    },
    {
      total: 0,
      open: 0,
      closed: 0,
      soldOut: 0,
      cancelled: 0,
      onRequest: 0,
      pastCutoff: 0,
      tooEarly: 0,
      available: 0,
    },
  )

  return {
    productId,
    availabilityState: summarizeProductAvailability(departures),
    counts,
    departures,
    total: requestedStatus === "on_request" ? departures.length : total,
    limit: query.limit,
    offset: query.offset,
  }
}

export async function previewStorefrontDeparturePrice(
  db: PostgresJsDatabase,
  departureId: string,
  input: StorefrontDeparturePricePreviewInput,
) {
  const [slot] = await listSlots(db, { slotId: departureId, limit: 1 })
  if (!slot) {
    return null
  }

  const context = await resolvePricingContext(db, slot.productId, slot.optionId)
  const adults = Math.max(0, input.pax?.adults ?? 1)
  const children = Math.max(0, input.pax?.children ?? 0)
  const infants = Math.max(0, input.pax?.infants ?? 0)
  const rooms = input.rooms.map((room) => ({
    unitId: room.unitId,
    occupancy: room.occupancy,
    quantity: room.quantity,
  }))
  const extras = input.extras.map((extra) => ({
    extraId: extra.extraId,
    quantity: extra.quantity,
  }))

  const requestedUnits =
    rooms.length > 0
      ? rooms.map((room) => ({
          unitId: room.unitId,
          requestRef: room.unitId,
          quantity: Math.max(1, room.occupancy * room.quantity),
        }))
      : buildTravelerRequestedUnits({
          units: context.units,
          adults,
          children,
          infants,
        })

  const resolved = await sellabilityService.resolve(db, {
    productId: slot.productId,
    optionId: slot.optionId ?? undefined,
    slotId: departureId,
    currencyCode: input.currencyCode ?? undefined,
    requestedUnits,
    limit: 25,
  })

  const candidate =
    resolved.data.find(
      (row) => row.slot.id === departureId && (!slot.optionId || row.option.id === slot.optionId),
    ) ?? resolved.data[0]

  const seeded = candidate
    ? {
        currencyCode: candidate.pricing.currencyCode,
        total: Number((candidate.pricing.sellAmountCents / 100).toFixed(2)),
        lineItems: candidate.pricing.components.map((component) => ({
          name: component.title,
          total: Number((component.sellAmountCents / 100).toFixed(2)),
          quantity: Math.max(1, component.quantity),
          unitPrice: Number(
            (component.sellAmountCents / 100 / Math.max(1, component.quantity)).toFixed(2),
          ),
        })),
        notes: candidate.sellability.onRequest ? "on_request" : null,
      }
    : {
        ...computeFallbackLineItems({
          context,
          adults,
          children,
          infants,
          rooms,
        }),
        notes: null,
      }

  const withExtras = await applyExtraLineItems({
    db,
    productId: slot.productId,
    context,
    paxTotal: Math.max(1, adults + children + infants),
    extras,
    lineItems: seeded.lineItems,
    total: seeded.total,
  })

  return {
    departureId: slot.id,
    productId: slot.productId,
    optionId: slot.optionId,
    currencyCode: seeded.currencyCode,
    basePrice: seeded.lineItems[0]?.total ?? 0,
    taxAmount: 0,
    total: withExtras.total,
    notes: seeded.notes,
    lineItems: withExtras.lineItems,
  }
}

export async function getStorefrontProductExtensions(
  db: PostgresJsDatabase,
  productId: string,
  optionId?: string,
) {
  const context = await resolvePricingContext(db, productId, optionId)

  const extras = await db
    .select({
      id: productExtras.id,
      name: productExtras.name,
      description: productExtras.description,
      selectionType: productExtras.selectionType,
      pricingMode: productExtras.pricingMode,
      pricedPerPerson: productExtras.pricedPerPerson,
      defaultQuantity: productExtras.defaultQuantity,
      minQuantity: productExtras.minQuantity,
      maxQuantity: productExtras.maxQuantity,
      metadata: productExtras.metadata,
    })
    .from(productExtras)
    .where(and(eq(productExtras.productId, productId), eq(productExtras.active, true)))
    .orderBy(asc(productExtras.sortOrder), asc(productExtras.name))

  const priceRuleByExtraId = new Map(
    context.extraRules
      .filter((rule) => rule.productExtraId)
      .map((rule) => [rule.productExtraId as string, rule] as const),
  )

  const extensions = extras.map((extra) => {
    const metadata = (extra.metadata ?? {}) as Record<string, unknown>
    const rule = priceRuleByExtraId.get(extra.id)
    const pricingMode =
      rule?.pricingMode ?? (extra.pricedPerPerson ? "per_person" : extra.pricingMode)
    const amount = centsToAmount(rule?.sellAmountCents)

    return {
      id: extra.id,
      name: extra.name,
      label: extra.name,
      required: extra.selectionType === "required",
      selectable: extra.selectionType !== "unavailable",
      hasOptions: false,
      refProductId:
        typeof metadata.refProductId === "string"
          ? metadata.refProductId
          : typeof metadata.productId === "string"
            ? metadata.productId
            : null,
      thumb: typeof metadata.thumbUrl === "string" ? metadata.thumbUrl : null,
      pricePerPerson:
        pricingMode === "per_person" || extra.pricedPerPerson ? (amount ?? null) : null,
      currencyCode: getPreferredCurrency(context),
      pricingMode,
      defaultQuantity: extra.defaultQuantity ?? null,
      minQuantity: extra.minQuantity ?? null,
      maxQuantity: extra.maxQuantity ?? null,
    }
  })

  const details = Object.fromEntries(
    extras.map((extra) => {
      const metadata = (extra.metadata ?? {}) as Record<string, unknown>
      const media = Array.isArray(metadata.media)
        ? metadata.media
            .map((entry) =>
              entry && typeof entry === "object"
                ? {
                    url:
                      typeof (entry as Record<string, unknown>).url === "string"
                        ? String((entry as Record<string, unknown>).url)
                        : "",
                    alt:
                      typeof (entry as Record<string, unknown>).alt === "string"
                        ? String((entry as Record<string, unknown>).alt)
                        : null,
                  }
                : null,
            )
            .filter((value): value is NonNullable<typeof value> => Boolean(value?.url))
        : []

      return [
        extra.id,
        {
          description: extra.description ?? null,
          media,
        },
      ]
    }),
  )

  return {
    extensions,
    items: extensions,
    details,
    currencyCode: getPreferredCurrency(context),
  }
}

export async function getStorefrontDepartureItinerary(
  db: PostgresJsDatabase,
  input: { departureId: string; productId: string },
) {
  const [slot] = await listSlots(db, {
    productId: input.productId,
    slotId: input.departureId,
    limit: 1,
  })
  const defaultItineraryByProduct = await listDefaultItineraryIdsByProductIds(db, [input.productId])
  const itineraryId = slot?.itineraryId ?? defaultItineraryByProduct.get(input.productId)

  if (!itineraryId) {
    return null
  }

  const days = await db
    .select({
      id: productDays.id,
      dayNumber: productDays.dayNumber,
      title: productDays.title,
      description: productDays.description,
    })
    .from(productDays)
    .where(eq(productDays.itineraryId, itineraryId))
    .orderBy(asc(productDays.dayNumber))

  if (days.length === 0) {
    return null
  }

  const dayIds = days.map((day) => day.id)
  const [services, dayMedia] = await Promise.all([
    db
      .select({
        id: productDayServices.id,
        dayId: productDayServices.dayId,
        name: productDayServices.name,
        description: productDayServices.description,
        sortOrder: productDayServices.sortOrder,
      })
      .from(productDayServices)
      .where(inArray(productDayServices.dayId, dayIds))
      .orderBy(asc(productDayServices.sortOrder), asc(productDayServices.createdAt)),
    db
      .select({
        id: productMedia.id,
        dayId: productMedia.dayId,
        url: productMedia.url,
        isCover: productMedia.isCover,
        sortOrder: productMedia.sortOrder,
      })
      .from(productMedia)
      .where(and(eq(productMedia.productId, input.productId), inArray(productMedia.dayId, dayIds)))
      .orderBy(
        desc(productMedia.isCover),
        asc(productMedia.sortOrder),
        asc(productMedia.createdAt),
      ),
  ])

  const servicesByDay = new Map<string, Array<(typeof services)[number]>>()
  for (const service of services) {
    const existing = servicesByDay.get(service.dayId) ?? []
    existing.push(service)
    servicesByDay.set(service.dayId, existing)
  }

  const mediaByDay = new Map<string, (typeof dayMedia)[number]>()
  for (const media of dayMedia) {
    if (!media.dayId || mediaByDay.has(media.dayId)) {
      continue
    }

    mediaByDay.set(media.dayId, media)
  }

  return {
    id: input.departureId,
    days: days.map((day) => ({
      id: day.id,
      title: day.title ?? `Day ${day.dayNumber}`,
      description: day.description ?? null,
      thumbnail: mediaByDay.get(day.id) ? { url: mediaByDay.get(day.id)?.url ?? "" } : null,
      segments: (servicesByDay.get(day.id) ?? []).map((service) => ({
        id: service.id,
        title: service.name,
        description: service.description ?? null,
      })),
    })),
  }
}
