import { publicBookingsService, resolveSessionPricingSnapshot } from "@voyant-travel/bookings"
import {
  computePaymentSchedule,
  financeService,
  noDepositPolicy,
  type PaymentPolicy,
} from "@voyant-travel/finance"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { loadStorefrontAvailabilitySlot } from "./service-boundary-sql.js"
import type { StorefrontBookingSessionBootstrapInput } from "./validation.js"

export interface StorefrontBootstrapRequestContext {
  db: PostgresJsDatabase
  env?: unknown
  context?: unknown
}

export interface StorefrontBookingSessionBootstrapOptions {
  paymentPolicy?: PaymentPolicy
  resolvePaymentPolicy?: (
    input: StorefrontBookingSessionBootstrapInput & StorefrontBootstrapRequestContext,
  ) => Promise<PaymentPolicy | null | undefined> | PaymentPolicy | null | undefined
  today?: Date
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function normalizeDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : value
}

function isExpired(value: string | null | undefined, now: Date) {
  if (!value) {
    return false
  }

  const expiresAt = new Date(value)
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()
}

function resolveTierAmount(
  tiers: Array<{
    minQuantity: number
    maxQuantity: number | null
    sellAmountCents: number | null
  }>,
  quantity: number,
  fallbackAmount: number | null,
) {
  const tier = tiers.find(
    (candidate) =>
      quantity >= candidate.minQuantity &&
      (candidate.maxQuantity === null || quantity <= candidate.maxQuantity),
  )

  return tier?.sellAmountCents ?? fallbackAmount
}

function computeLineTotal(
  pricingMode: string,
  unitSellAmountCents: number | null,
  quantity: number,
  fallbackAmount: number | null,
) {
  switch (pricingMode) {
    case "free":
    case "included":
      return 0
    case "on_request":
      return null
    case "per_unit":
    case "per_person":
      return unitSellAmountCents === null ? null : unitSellAmountCents * quantity
    default:
      return unitSellAmountCents ?? fallbackAmount
  }
}

function serializePaymentPlan(policy: PaymentPolicy, requiresFullPayment: boolean) {
  return {
    source: "storefront_default" as const,
    depositKind: policy.deposit.kind,
    depositPercent: policy.deposit.kind === "percent" ? (policy.deposit.percent ?? 0) : null,
    depositAmountCents:
      policy.deposit.kind === "fixed_cents" ? (policy.deposit.amountCents ?? 0) : null,
    requiresFullPayment,
  }
}

async function resolveAvailabilitySlot(db: PostgresJsDatabase, slotId: string) {
  return loadStorefrontAvailabilitySlot(db, slotId)
}

async function previewBootstrapPricing(
  db: PostgresJsDatabase,
  input: StorefrontBookingSessionBootstrapInput,
  slot: {
    productId: string
    optionId: string | null
  },
) {
  const pricedItems: Array<{
    inputIndex: number
    itemId: string
    title: string
    productId: string | null
    optionId: string | null
    optionUnitId: string | null
    optionUnitName: string | null
    optionUnitType: string | null
    pricingCategoryId: string | null
    quantity: number
    pricingMode: string
    unitSellAmountCents: number | null
    totalSellAmountCents: number | null
    warnings: string[]
  }> = []
  let resolvedCatalogId: string | null = input.catalogId ?? null
  let resolvedCurrency = input.session.sellCurrency

  for (const [index, item] of input.session.items.entries()) {
    const productId = item.productId ?? slot.productId
    const optionId = item.optionId ?? slot.optionId ?? undefined
    if (!productId) {
      return { status: "pricing_unavailable" as const }
    }

    const snapshot = await resolveSessionPricingSnapshot(db, productId, {
      catalogId: input.catalogId,
      departureId: input.slotId,
      optionId,
    })

    if (!snapshot) {
      return { status: "pricing_unavailable" as const }
    }

    resolvedCatalogId = snapshot.catalog.id
    resolvedCurrency = snapshot.catalog.currencyCode ?? input.session.sellCurrency

    const option =
      snapshot.options.find((candidate) => candidate.id === optionId) ?? snapshot.options[0] ?? null
    if (!option) {
      return { status: "pricing_unavailable" as const }
    }

    const rule =
      snapshot.rules.find((candidate) => candidate.optionId === option.id && candidate.isDefault) ??
      snapshot.rules.find((candidate) => candidate.optionId === option.id) ??
      null
    if (!rule) {
      return { status: "pricing_unavailable" as const }
    }

    const selectedUnitId = item.optionUnitId ?? null
    const pricingCategoryId = item.pricingCategoryId ?? null
    const ruleUnitPrices = snapshot.unitPrices.filter(
      (candidate) => candidate.optionPriceRuleId === rule.id,
    )
    const unitPriceCandidates = ruleUnitPrices.filter((candidate) => {
      if (selectedUnitId && candidate.unitId !== selectedUnitId) {
        return false
      }
      if (pricingCategoryId && candidate.pricingCategoryId !== pricingCategoryId) {
        return false
      }
      if (candidate.minQuantity !== null && item.quantity < candidate.minQuantity) {
        return false
      }
      if (candidate.maxQuantity !== null && item.quantity > candidate.maxQuantity) {
        return false
      }
      return true
    })
    const fallbackUnitPrice =
      !pricingCategoryId && !selectedUnitId
        ? (ruleUnitPrices.find(
            (candidate) =>
              candidate.pricingCategoryId === null &&
              (candidate.minQuantity === null || item.quantity >= candidate.minQuantity) &&
              (candidate.maxQuantity === null || item.quantity <= candidate.maxQuantity),
          ) ?? null)
        : null
    const unitPrice = unitPriceCandidates[0] ?? fallbackUnitPrice

    if (
      (selectedUnitId || ruleUnitPrices.length > 0) &&
      !unitPrice &&
      rule.pricingMode !== "per_booking"
    ) {
      return { status: "pricing_unavailable" as const }
    }

    const unitSellAmountCents = unitPrice
      ? resolveTierAmount(unitPrice.tiers, item.quantity, unitPrice.sellAmountCents)
      : rule.baseSellAmountCents
    const pricingMode = unitPrice?.pricingMode ?? rule.pricingMode
    const totalSellAmountCents = computeLineTotal(
      pricingMode,
      unitSellAmountCents,
      item.quantity,
      rule.baseSellAmountCents,
    )

    if (totalSellAmountCents === null) {
      return { status: "pricing_unavailable" as const }
    }

    pricedItems.push({
      inputIndex: index,
      itemId: `input:${index}`,
      title: item.title,
      productId,
      optionId: option.id,
      optionUnitId: selectedUnitId,
      optionUnitName: unitPrice?.unitName ?? null,
      optionUnitType: unitPrice?.unitType ?? null,
      pricingCategoryId,
      quantity: item.quantity,
      pricingMode,
      unitSellAmountCents,
      totalSellAmountCents,
      warnings: [],
    })
  }

  return {
    status: "ok" as const,
    pricing: {
      sessionId: "pending",
      catalogId: resolvedCatalogId,
      currencyCode: resolvedCurrency,
      totalSellAmountCents: pricedItems.reduce(
        (total, item) => total + (item.totalSellAmountCents ?? 0),
        0,
      ),
      items: pricedItems,
      warnings: [],
      appliedToSession: true,
    },
  }
}

async function resolveBootstrapPaymentPolicy(
  input: StorefrontBookingSessionBootstrapInput,
  context: StorefrontBootstrapRequestContext,
  options: StorefrontBookingSessionBootstrapOptions | undefined,
) {
  return (
    (await options?.resolvePaymentPolicy?.({
      ...input,
      ...context,
    })) ??
    options?.paymentPolicy ??
    noDepositPolicy
  )
}

export async function bootstrapStorefrontBookingSession(
  context: StorefrontBootstrapRequestContext,
  input: StorefrontBookingSessionBootstrapInput,
  options: StorefrontBookingSessionBootstrapOptions | undefined,
  userId?: string,
) {
  const now = options?.today ?? new Date()
  if (isExpired(input.quote.expiresAt, now)) {
    return { status: "stale_quote" as const }
  }

  const [departure, slot] = await Promise.all([
    resolveAvailabilitySlot(context.db, input.departureId),
    resolveAvailabilitySlot(context.db, input.slotId),
  ])

  if (!departure) {
    return { status: "departure_not_found" as const }
  }

  if (!slot) {
    return { status: "slot_not_found" as const }
  }

  if (departure.id !== slot.id) {
    return { status: "invalid_slot" as const }
  }

  const mismatchedItem = input.session.items.find(
    (item) =>
      item.availabilitySlotId !== input.slotId ||
      (item.productId !== undefined &&
        item.productId !== null &&
        item.productId !== slot.productId) ||
      (slot.optionId !== null &&
        item.optionId !== undefined &&
        item.optionId !== null &&
        item.optionId !== slot.optionId),
  )
  if (mismatchedItem) {
    return { status: "invalid_slot" as const }
  }

  const preview = await previewBootstrapPricing(context.db, input, {
    productId: slot.productId,
    optionId: slot.optionId ?? null,
  })
  if (preview.status !== "ok") {
    return preview
  }

  if (
    preview.pricing.currencyCode !== input.quote.currencyCode ||
    preview.pricing.totalSellAmountCents !== input.quote.totalSellAmountCents
  ) {
    return {
      status: "stale_quote" as const,
      repricing: {
        originalQuote: input.quote,
        current: preview.pricing,
        deltaAmountCents: preview.pricing.totalSellAmountCents - input.quote.totalSellAmountCents,
        staleQuote: true,
      },
    }
  }

  const createResult = await publicBookingsService.createSession(
    context.db,
    {
      ...input.session,
      sellCurrency: preview.pricing.currencyCode,
      sellAmountCents: preview.pricing.totalSellAmountCents,
      items: input.session.items.map((item, index) => {
        const pricedItem = preview.pricing.items[index]
        return {
          ...item,
          sellCurrency: preview.pricing.currencyCode,
          productId: pricedItem?.productId ?? item.productId,
          optionId: pricedItem?.optionId ?? item.optionId,
          optionUnitId: pricedItem?.optionUnitId ?? item.optionUnitId,
          pricingCategoryId: pricedItem?.pricingCategoryId ?? item.pricingCategoryId,
          unitSellAmountCents: pricedItem?.unitSellAmountCents ?? item.unitSellAmountCents,
          totalSellAmountCents: pricedItem?.totalSellAmountCents ?? item.totalSellAmountCents,
        }
      }),
    },
    userId,
  )

  if (createResult.status !== "ok") {
    return createResult
  }
  if (!("session" in createResult)) {
    return { status: "not_found" as const }
  }

  const createdSession = createResult.session
  const policy = await resolveBootstrapPaymentPolicy(input, context, options)
  const computedSchedule = computePaymentSchedule(
    {
      totalCents: createdSession.sellAmountCents ?? preview.pricing.totalSellAmountCents,
      currency: createdSession.sellCurrency,
      departureDate: normalizeDate(slot.dateLocal) ?? normalizeDate(slot.startsAt),
      today: now,
    },
    policy,
  )
  const persistedSchedule =
    (await financeService.applyComputedPaymentSchedule(
      context.db,
      createdSession.sessionId,
      computedSchedule,
    )) ?? []
  const availability = (await resolveAvailabilitySlot(context.db, input.slotId)) ?? slot
  const currentItems = preview.pricing.items.map(({ inputIndex: _inputIndex, ...item }, index) => ({
    ...item,
    itemId: createdSession.items[index]?.id ?? item.itemId,
  }))
  const current = {
    ...preview.pricing,
    sessionId: createdSession.sessionId,
    items: currentItems,
  }

  return {
    status: "ok" as const,
    bootstrap: {
      session: createdSession,
      paymentPlan: serializePaymentPlan(
        policy,
        computedSchedule.length === 1 && computedSchedule[0]?.scheduleType === "full",
      ),
      paymentSchedule: persistedSchedule.map((schedule) => ({
        id: schedule.id,
        scheduleType: schedule.scheduleType,
        status: schedule.status,
        dueDate: normalizeDate(schedule.dueDate)!,
        currency: schedule.currency,
        amountCents: schedule.amountCents,
        notes: schedule.notes ?? null,
      })),
      repricing: {
        originalQuote: input.quote,
        current,
        deltaAmountCents: 0,
        staleQuote: false,
      },
      availability: {
        departureId: input.departureId,
        slotId: input.slotId,
        productId: availability.productId,
        optionId: availability.optionId ?? null,
        dateLocal: availability.dateLocal ?? null,
        startsAt: normalizeDateTime(availability.startsAt),
        endsAt: normalizeDateTime(availability.endsAt),
        timezone: availability.timezone,
        status: availability.status,
        capacity: availability.initialPax ?? null,
        remaining: availability.unlimited ? null : (availability.remainingPax ?? null),
      },
      allocation: createdSession.allocations,
      currency: createdSession.sellCurrency,
    },
  }
}
