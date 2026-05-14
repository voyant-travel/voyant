import { availabilitySlots } from "@voyantjs/availability/schema"
import { publicBookingsService } from "@voyantjs/bookings"
import {
  type CheckoutCapabilityAction,
  checkoutCapabilityActions,
  issueCheckoutCapability,
} from "@voyantjs/bookings/checkout-capability"
import {
  computePaymentSchedule,
  noDepositPolicy,
  type PaymentPolicy,
  type PaymentPolicySource,
  publicFinanceService,
} from "@voyantjs/finance"
import type { PublicBookingPaymentOptions } from "@voyantjs/finance/public-validation"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { StorefrontRequestContext } from "./service.js"
import type {
  StorefrontBookingSessionBootstrapInput,
  StorefrontBookingSessionBootstrapResult,
} from "./validation-booking-bootstrap.js"

type PublicBookingSession = NonNullable<
  Awaited<ReturnType<typeof publicBookingsService.getSessionById>>
>

export interface StorefrontBookingBootstrapPaymentPolicy {
  policy: PaymentPolicy
  source: PaymentPolicySource
}

export interface StorefrontBookingBootstrapOptions {
  resolvePaymentPolicy?: (
    input: {
      session: PublicBookingSession
      body: StorefrontBookingSessionBootstrapInput
    } & StorefrontRequestContext,
  ) =>
    | Promise<StorefrontBookingBootstrapPaymentPolicy | null | undefined>
    | StorefrontBookingBootstrapPaymentPolicy
    | null
    | undefined
}

type BootstrapOkResult = {
  status: "ok"
  data: StorefrontBookingSessionBootstrapResult
  checkoutCapability: {
    token: string
    expiresAt: Date
  }
}

export type StorefrontBookingBootstrapResult =
  | BootstrapOkResult
  | { status: "quote_expired" }
  | { status: "departure_not_found" }
  | { status: "slot_not_found" }
  | { status: "slot_mismatch" }
  | { status: "pricing_unavailable" }
  | { status: "invalid_selection" }
  | { status: "quantity_change_requires_reallocation" }
  | { status: "session_conflict"; reason: string }

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function normalizeDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function resolveRuntimeEnv(env: unknown): Record<string, string | undefined> {
  const processEnv =
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> }
      }
    ).process?.env ?? {}

  return {
    ...processEnv,
    ...(env && typeof env === "object" ? (env as Record<string, string | undefined>) : {}),
  }
}

function getSessionAmount(session: PublicBookingSession) {
  return (
    session.sellAmountCents ??
    session.items.reduce((total, item) => total + (item.totalSellAmountCents ?? 0), 0)
  )
}

function buildCurrentPricingSnapshot(input: {
  session: PublicBookingSession
  originalTotalSellAmountCents: number
  currentTotalSellAmountCents: number
}) {
  return {
    sessionId: input.session.sessionId,
    catalogId: null,
    currencyCode: input.session.sellCurrency,
    originalTotalSellAmountCents: input.originalTotalSellAmountCents,
    currentTotalSellAmountCents: input.currentTotalSellAmountCents,
    deltaSellAmountCents: input.currentTotalSellAmountCents - input.originalTotalSellAmountCents,
    items: input.session.items.map((item) => ({
      itemId: item.id,
      title: item.title,
      productId: item.productId,
      optionId: item.optionId,
      optionUnitId: item.optionUnitId,
      optionUnitName: null,
      optionUnitType: null,
      pricingCategoryId: item.pricingCategoryId,
      quantity: item.quantity,
      pricingMode: "session_snapshot",
      unitSellAmountCents: item.unitSellAmountCents,
      totalSellAmountCents: item.totalSellAmountCents,
      warnings: [],
    })),
    warnings: [],
    appliedToSession: false,
  }
}

function buildPaymentPlan(input: {
  session: PublicBookingSession
  finance: PublicBookingPaymentOptions | null
  paymentPolicy: StorefrontBookingBootstrapPaymentPolicy | null
}) {
  const persistedSchedules = input.finance?.schedules ?? []
  if (persistedSchedules.length > 0) {
    return {
      source: "persisted_schedule" as const,
      policySource: null,
      schedules: persistedSchedules,
      recommendedTarget: input.finance?.recommendedTarget ?? null,
    }
  }

  const paymentPolicy = input.paymentPolicy ?? {
    policy: noDepositPolicy,
    source: "operator_default" as const,
  }
  const schedules = computePaymentSchedule(
    {
      totalCents: getSessionAmount(input.session),
      currency: input.session.sellCurrency,
      departureDate: input.session.startDate,
    },
    paymentPolicy.policy,
  ).map((entry) => ({
    id: null,
    scheduleType: entry.scheduleType,
    status: "pending" as const,
    dueDate: entry.dueDate,
    currency: entry.currency,
    amountCents: entry.amountCents,
    notes: null,
  }))

  return {
    source: "computed_policy" as const,
    policySource: paymentPolicy.source,
    schedules,
    recommendedTarget: null,
  }
}

export async function bootstrapStorefrontBookingSession(
  input: {
    context: StorefrontRequestContext & { db: PostgresJsDatabase }
    body: StorefrontBookingSessionBootstrapInput
  },
  options: StorefrontBookingBootstrapOptions = {},
): Promise<StorefrontBookingBootstrapResult> {
  const { context, body } = input
  const quoteExpiresAt = body.quote.expiresAt ? new Date(body.quote.expiresAt) : null
  if (quoteExpiresAt && quoteExpiresAt.getTime() <= Date.now()) {
    return { status: "quote_expired" }
  }

  const [departure] = await context.db
    .select()
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, body.departureId))
    .limit(1)

  if (!departure) {
    return { status: "departure_not_found" }
  }

  const [slot] = await context.db
    .select()
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.id, body.slotId),
        eq(availabilitySlots.productId, departure.productId),
      ),
    )
    .limit(1)

  if (!slot) {
    return { status: "slot_not_found" }
  }

  const requestedItemsMatchSlot = body.session.items.every(
    (item) =>
      (!item.availabilitySlotId || item.availabilitySlotId === body.slotId) &&
      (!item.productId || item.productId === slot.productId),
  )
  if (!requestedItemsMatchSlot) {
    return { status: "slot_mismatch" }
  }

  const sessionInput = {
    ...body.session,
    sellCurrency: body.quote.currency,
    sellAmountCents: body.quote.totalSellAmountCents,
    startDate: body.session.startDate ?? normalizeDate(departure.dateLocal),
    endDate:
      body.session.endDate ?? normalizeDate(departure.endsAt) ?? normalizeDate(departure.dateLocal),
    items: body.session.items.map((item) => ({
      ...item,
      availabilitySlotId: item.availabilitySlotId || body.slotId,
      productId: item.productId ?? slot.productId,
      optionId: item.optionId ?? slot.optionId ?? null,
      sellCurrency: item.sellCurrency ?? body.quote.currency,
    })),
  }

  const created = await publicBookingsService.createSession(context.db, sessionInput)

  if (created.status === "slot_not_found") return { status: "slot_not_found" }
  if (created.status === "pricing_unavailable") return { status: "pricing_unavailable" }
  if (created.status !== "ok" || !("session" in created)) {
    return { status: "session_conflict", reason: created.status }
  }

  let session = created.session
  const hasMismatchedItem = session.items.some((item) => item.productId !== slot.productId)
  const hasRequestedSlot = session.allocations.some(
    (allocation) => allocation.availabilitySlotId === body.slotId,
  )

  if (hasMismatchedItem || !hasRequestedSlot) {
    return { status: "slot_mismatch" }
  }

  const repriceResult = body.reprice
    ? await publicBookingsService.repriceSession(context.db, session.sessionId, {
        catalogId: body.reprice.catalogId,
        applyToSession: body.reprice.applyToSession ?? false,
        selections: body.reprice.selections.map((selection) => ({
          itemId: selection.itemId ?? session.items[selection.itemIndex]?.id ?? "",
          optionId: selection.optionId,
          optionUnitId: selection.optionUnitId,
          pricingCategoryId: selection.pricingCategoryId,
          quantity: selection.quantity,
        })),
      })
    : null

  if (repriceResult) {
    if (repriceResult.status === "invalid_selection") return { status: "invalid_selection" }
    if (repriceResult.status === "pricing_unavailable") return { status: "pricing_unavailable" }
    if (repriceResult.status === "quantity_change_requires_reallocation") {
      return { status: "quantity_change_requires_reallocation" }
    }
    if (repriceResult.status !== "ok") {
      return { status: "session_conflict", reason: repriceResult.status }
    }
    if (repriceResult.session) {
      session = repriceResult.session
    }
  }

  const [finance, paymentPolicy] = await Promise.all([
    publicFinanceService.getBookingPaymentOptions(context.db, session.sessionId, {
      includeInactive: false,
    }),
    options.resolvePaymentPolicy?.({
      ...context,
      session,
      body,
    }) ?? null,
  ])
  const paymentPlan = buildPaymentPlan({
    session,
    finance,
    paymentPolicy: paymentPolicy ?? null,
  })

  const currentTotalSellAmountCents =
    repriceResult?.status === "ok"
      ? repriceResult.pricing.totalSellAmountCents
      : getSessionAmount(session)
  const pricing =
    repriceResult?.status === "ok"
      ? {
          ...repriceResult.pricing,
          originalTotalSellAmountCents: body.quote.totalSellAmountCents,
          currentTotalSellAmountCents: repriceResult.pricing.totalSellAmountCents,
          deltaSellAmountCents:
            repriceResult.pricing.totalSellAmountCents - body.quote.totalSellAmountCents,
        }
      : buildCurrentPricingSnapshot({
          session,
          originalTotalSellAmountCents: body.quote.totalSellAmountCents,
          currentTotalSellAmountCents,
        })

  const checkoutCapability = await issueCheckoutCapability(
    session.sessionId,
    resolveRuntimeEnv(context.env),
  )
  const sessionWithCapability = {
    ...session,
    checkoutCapability: {
      token: checkoutCapability.token,
      expiresAt: checkoutCapability.expiresAt.toISOString(),
      actions: [...checkoutCapabilityActions] as CheckoutCapabilityAction[],
    },
  } as StorefrontBookingSessionBootstrapResult["session"]

  return {
    status: "ok",
    checkoutCapability,
    data: {
      session: sessionWithCapability,
      quote: {
        currency: body.quote.currency,
        totalSellAmountCents: body.quote.totalSellAmountCents,
        quotedAt: body.quote.quotedAt ?? null,
        expiresAt: body.quote.expiresAt ?? null,
      },
      pricing,
      availability: {
        departureId: departure.id,
        slotId: slot.id,
        productId: slot.productId,
        optionId: slot.optionId ?? null,
        dateLocal: slot.dateLocal,
        startsAt: normalizeDateTime(slot.startsAt),
        endsAt: normalizeDateTime(slot.endsAt),
        timezone: slot.timezone,
        status: slot.status,
        unlimited: slot.unlimited,
        initialPax: slot.initialPax ?? null,
        remainingPax: slot.remainingPax ?? null,
        remainingResources: slot.remainingResources ?? null,
        pastCutoff: slot.pastCutoff,
        tooEarly: slot.tooEarly,
      },
      paymentPlan,
      currency: pricing.currencyCode,
      dueDates: paymentPlan.schedules.map((schedule) => ({
        scheduleType: schedule.scheduleType,
        dueDate: schedule.dueDate,
        amountCents: schedule.amountCents,
        currency: schedule.currency,
      })),
    },
  }
}
