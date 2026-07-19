// agent-quality: file-size exception -- owner: storefront; the bootstrap pricing/derivation helpers stay co-located with the sync + compat bootstrap paths until a dedicated split preserves behavior and tests.
import {
  type PublicBookingOwner,
  publicBookingsService,
  resolveSessionPricingSnapshot,
} from "@voyant-travel/bookings"
import {
  computePaymentSchedule,
  financeService,
  noDepositPolicy,
  type PaymentPolicy,
} from "@voyant-travel/finance"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  listOptionUnitFacts,
  loadProductOptionFacts,
  loadProductPricingFacts,
  loadStorefrontAvailabilitySlot,
} from "./service-boundary-sql.js"
import type {
  StorefrontBookingBootstrapErrorCode,
  StorefrontBookingSessionBootstrapInput,
  StorefrontBookingSessionCompatBootstrapInput,
} from "./validation.js"

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

export interface StorefrontBootstrapErrorDescriptor {
  code: StorefrontBookingBootstrapErrorCode
  httpStatus: 400 | 404 | 409
  /** True when the caller can sensibly retry (e.g. re-fetch a fresh price). */
  retryable: boolean
  message: string
}

/**
 * Single source of truth mapping internal bootstrap statuses to the
 * machine-readable, user-actionable error contract documented in issue
 * voyant#1984. Both the native and compatibility bootstrap routes derive their
 * HTTP status, error code, and retryability from this table.
 *
 * `QUOTE_STALE` is the one expected, retryable rejection: it means the price
 * the caller quoted no longer matches the server-derived price (the response
 * carries a `repricing` snapshot so the host can re-quote and retry). The
 * compatibility bootstrap derives the price server-side, so it never returns
 * `QUOTE_STALE`.
 */
export const STOREFRONT_BOOTSTRAP_ERROR_CODES: Record<string, StorefrontBootstrapErrorDescriptor> =
  {
    departure_not_found: {
      code: "DEPARTURE_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
      message: "Storefront departure not found",
    },
    slot_not_found: {
      code: "SLOT_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
      message: "Availability slot not found",
    },
    product_mismatch: {
      code: "PRODUCT_MISMATCH",
      httpStatus: 409,
      retryable: false,
      message: "Departure does not belong to the requested product",
    },
    slot_product_mismatch: {
      code: "SLOT_PRODUCT_MISMATCH",
      httpStatus: 409,
      retryable: false,
      message: "Availability slot does not belong to the requested product",
    },
    slot_option_mismatch: {
      code: "SLOT_OPTION_MISMATCH",
      httpStatus: 409,
      retryable: false,
      message: "Availability slot does not match the requested option",
    },
    invalid_slot: {
      code: "SLOT_DEPARTURE_MISMATCH",
      httpStatus: 400,
      retryable: false,
      message: "Booking session slot does not match the requested departure",
    },
    pricing_unavailable: {
      code: "PRICING_UNAVAILABLE",
      httpStatus: 409,
      retryable: false,
      message: "Pricing is not available for the selected booking session items",
    },
    stale_quote: {
      code: "QUOTE_STALE",
      httpStatus: 409,
      retryable: true,
      message: "Booking session quote is stale",
    },
    slot_unavailable: {
      code: "SLOT_UNAVAILABLE",
      httpStatus: 409,
      retryable: false,
      message: "Availability slot is not bookable",
    },
    insufficient_capacity: {
      code: "INSUFFICIENT_CAPACITY",
      httpStatus: 409,
      retryable: false,
      message: "Insufficient slot capacity",
    },
  }

const FALLBACK_BOOTSTRAP_ERROR: StorefrontBootstrapErrorDescriptor = {
  code: "BOOTSTRAP_FAILED",
  httpStatus: 409,
  retryable: false,
  message: "Unable to bootstrap booking session",
}

export function describeStorefrontBootstrapError(
  status: string,
): StorefrontBootstrapErrorDescriptor {
  return STOREFRONT_BOOTSTRAP_ERROR_CODES[status] ?? FALLBACK_BOOTSTRAP_ERROR
}

export async function bootstrapStorefrontBookingSession(
  context: StorefrontBootstrapRequestContext,
  input: StorefrontBookingSessionBootstrapInput,
  options: StorefrontBookingSessionBootstrapOptions | undefined,
  userId?: string,
  owner: PublicBookingOwner | null = null,
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
    {},
    owner,
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

/**
 * Compatibility bootstrap (issue voyant#1984).
 *
 * Accepts the minimal `{ productId, departureId, pax, currency, locale }`
 * contract a storefront host can always supply for an imported catalog
 * departure, derives the current slot / option / price server-side, then funnels
 * through the same {@link bootstrapStorefrontBookingSession} machinery. Because
 * the quote is derived (not caller-supplied), this path never fails with
 * `stale_quote` — it returns either a real booking session or a structured
 * rejection whose status maps to {@link STOREFRONT_BOOTSTRAP_ERROR_CODES}.
 */
export async function bootstrapStorefrontBookingSessionCompat(
  context: StorefrontBootstrapRequestContext & { db: PostgresJsDatabase },
  input: StorefrontBookingSessionCompatBootstrapInput,
  options: StorefrontBookingSessionBootstrapOptions | undefined,
  userId?: string,
  owner: PublicBookingOwner | null = null,
): Promise<
  Awaited<ReturnType<typeof bootstrapStorefrontBookingSession>> | { status: "product_mismatch" }
> {
  const now = options?.today ?? new Date()
  // Native package departures are 1:1 with their availability slot, so the
  // departure id IS the slot id unless the host overrides it explicitly.
  const slotId = input.slotId ?? input.departureId

  const slot = await resolveAvailabilitySlot(context.db, slotId)
  if (!slot) {
    return { status: "departure_not_found" as const }
  }
  if (slot.productId !== input.productId) {
    return { status: "product_mismatch" as const }
  }

  const optionId = input.optionId ?? slot.optionId ?? null

  let optionUnitId = input.optionUnitId ?? null
  if (!optionUnitId && optionId) {
    const units = await listOptionUnitFacts(context.db, optionId)
    optionUnitId = units.find((unit) => unit.isRequired)?.id ?? units[0]?.id ?? null
  }

  const sellCurrency =
    input.currency ??
    (await loadProductPricingFacts(context.db, input.productId))?.sellCurrency ??
    "USD"

  const title =
    input.title ??
    (await loadProductOptionFacts(context.db, { productId: input.productId, optionId }))?.name ??
    "Booking"

  const session = {
    sellCurrency,
    communicationLanguage: input.locale ?? null,
    pax: input.pax,
    startDate: normalizeDate(slot.dateLocal) ?? normalizeDate(slot.startsAt),
    endDate: normalizeDate(slot.endsAt) ?? normalizeDate(slot.dateLocal),
    ...(input.holdMinutes ? { holdMinutes: input.holdMinutes } : {}),
    items: [
      {
        title,
        itemType: "unit" as const,
        allocationType: "unit" as const,
        // Map party size onto line quantity: per-person / per-unit pricing
        // multiplies by it, while per-booking modes ignore it — so `pax` is the
        // broadly-correct single choice for a derived session.
        quantity: input.pax,
        availabilitySlotId: slotId,
        productId: input.productId,
        optionId,
        optionUnitId,
        pricingCategoryId: input.pricingCategoryId ?? null,
      },
    ],
    travelers: input.travelers ?? [],
  } satisfies StorefrontBookingSessionBootstrapInput["session"]

  const derivedInput = {
    // The native bootstrap resolves `departureId` and `slotId` as availability
    // slots and rejects unless they are identical, so we hand it the canonical
    // slot id for BOTH. The caller's external `departureId` (which need not be
    // the native slot id for an imported departure) is echoed back into the
    // response snapshot below.
    departureId: slotId,
    slotId,
    catalogId: input.catalogId,
    session,
    // Placeholder quote; replaced below with the server-derived price so the
    // stale-quote guard inside bootstrapStorefrontBookingSession always passes.
    quote: {
      currencyCode: sellCurrency,
      totalSellAmountCents: 0,
      quotedAt: now.toISOString(),
      expiresAt: null,
    },
  } satisfies StorefrontBookingSessionBootstrapInput

  const preview = await previewBootstrapPricing(context.db, derivedInput, {
    productId: slot.productId,
    optionId,
  })
  if (preview.status !== "ok") {
    return preview
  }

  const result = await bootstrapStorefrontBookingSession(
    context,
    {
      ...derivedInput,
      quote: {
        currencyCode: preview.pricing.currencyCode,
        totalSellAmountCents: preview.pricing.totalSellAmountCents,
        quotedAt: now.toISOString(),
        expiresAt: null,
      },
    },
    options,
    userId,
    owner,
  )

  // Preserve the caller's external departure id in the availability snapshot
  // when it differs from the canonical availability-slot id.
  if (result.status === "ok" && "bootstrap" in result && input.departureId !== slotId) {
    result.bootstrap.availability.departureId = input.departureId
  }

  return result
}
