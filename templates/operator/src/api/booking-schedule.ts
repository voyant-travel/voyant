/**
 * Booking payment-schedule generator.
 *
 * Subscribes to `booking.confirmed`. On fire, resolves the effective
 * customer payment policy (cascade: booking → listing → category →
 * supplier -> operator default), runs `computePaymentSchedule()`, and
 * persists the resulting deposit / balance rows into
 * `booking_payment_schedules`.
 *
 * Registered as a plugin so it bootstraps BEFORE the legal module's
 * auto-generate-contract subscriber — that subscriber renders the
 * contract template, which references `booking.depositAmountCents` /
 * `booking.balanceAmountCents` / `booking.balanceDueDate` /
 * `payment.schedule[]`, all of which are populated by us.
 *
 * Idempotent: clearing pending/due rows + reinserting on every fire
 * is safe so a manually re-fired event doesn't double-up the
 * schedule.
 *
 * Phase 1 only consults the operator default. Phases 2-5 plug in the
 * supplier / category / listing / booking layers; the resolver call
 * already pre-supports them via {@link resolveEffectivePaymentPolicy}.
 */

import { ratePlans, stayBookingItems } from "@voyantjs/accommodations/schema"
import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
} from "@voyantjs/action-ledger"
import {
  bookingActivityLog,
  bookingItems,
  bookingSupplierStatuses,
  bookings,
} from "@voyantjs/bookings/schema"
import { bookingCruiseDetails } from "@voyantjs/cruises/booking-extension"
import { cruiseCabinCategories, cruiseSailings, cruises } from "@voyantjs/cruises/schema"
import {
  bookingPaymentSchedules,
  computePaymentSchedule,
  financeService,
  noDepositPolicy,
  type PaymentPolicy,
  type PaymentPolicySource,
  resolveEffectivePaymentPolicy,
} from "@voyantjs/finance"
import { parseJsonBody } from "@voyantjs/hono"
import type { HonoBundle } from "@voyantjs/hono/plugin"
import { productCategories, productCategoryProducts, products } from "@voyantjs/products/schema"
import { supplierServices, suppliers } from "@voyantjs/suppliers/schema"
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"
import { z } from "zod"

import { withDbFromEnv } from "./lib/db"
import { resolveOperatorDefaultPaymentPolicy } from "./settings"

interface BookingConfirmedPayload {
  bookingId: string
  bookingNumber: string
  actorId: string | null
}

export const bookingScheduleBundle: HonoBundle = {
  name: "booking-schedule",
  bootstrap: ({ bindings, eventBus }) => {
    const env = bindings as CloudflareBindings
    eventBus.subscribe<BookingConfirmedPayload>("booking.confirmed", async ({ data }) => {
      try {
        await withDbFromEnv(env, async (db) => {
          await generatePaymentScheduleForBooking(
            db as unknown as PostgresJsDatabase,
            data.bookingId,
          )
        })
      } catch (err) {
        console.error("[booking-schedule] failed to generate schedule", {
          bookingId: data.bookingId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })
  },
}

async function generatePaymentScheduleForBooking(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<void> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  if (!booking) return
  if (!booking.sellAmountCents || booking.sellAmountCents <= 0) return

  // Idempotency: this subscriber fires on every `booking.confirmed`
  // emission, which includes re-confirmations during the
  // checkout-finalize workflow when an existing booking transitions
  // to confirmed after a late payment. If a schedule already exists
  // (in any status — pending/due/paid/etc.), regenerating would wipe
  // the outstanding rows and insert a fresh full-amount plan as if
  // the booking had never been touched, double-billing the customer
  // on paper.
  const [existingSchedule] = await db
    .select({ id: bookingPaymentSchedules.id })
    .from(bookingPaymentSchedules)
    .where(eq(bookingPaymentSchedules.bookingId, bookingId))
    .limit(1)
  if (existingSchedule) return

  const operatorDefault = (await resolveOperatorDefaultPaymentPolicy(db)) ?? noDepositPolicy

  // Phase 2: supplier-layer override. Falls back to operator
  // default when the booking has no supplier link or the supplier
  // hasn't configured a custom policy.
  const supplierPolicy = await resolveSupplierPolicy(db, bookingId)

  // Phase 3: product-category override. Walks the booking's
  // products → categories and picks the first category (by
  // productCategoryProducts.sortOrder ascending) that defines a
  // policy. Wins over supplier per the cascade order.
  const categoryPolicy = await resolveCategoryPolicy(db, bookingId)

  // Phase 4: per-listing override. The first booking-item's product
  // with a non-null customerPaymentPolicy wins. Most specific catalog
  // layer — beats category, supplier, and operator default.
  const listingPolicy = await resolveListingPolicy(db, bookingId)

  // Phase 5: booking-level override. The booking's own
  // customerPaymentPolicy column wins over every catalog layer.
  // Reserved for ops adjustments — most bookings leave this null.
  const bookingPolicy = (booking.customerPaymentPolicy as PaymentPolicy | null | undefined) ?? null

  const { policy, source } = resolveEffectivePaymentPolicy({
    bookingPolicy,
    listingPolicy,
    categoryPolicy,
    supplierPolicy,
    operatorDefault,
  })

  const entries = computePaymentSchedule(
    {
      totalCents: booking.sellAmountCents,
      currency: booking.sellCurrency,
      departureDate: booking.startDate,
    },
    policy,
  )

  await financeService.applyComputedPaymentSchedule(db, bookingId, entries, { replace: true })

  // Stash the source on the booking's internalNotes so the contract
  // resolver can echo it via `booking.paymentPolicy.source`. The
  // source enum is small (booking | listing | category | supplier |
  // operator_default) so a single marker line is enough.
  await stampPolicySourceOnBooking(db, bookingId, source)

  // Audit trail — record what cascade layer applied, which policy
  // was used, and the resulting schedule snapshot. Lets ops trace
  // why a particular schedule was generated. The structured metadata
  // (`kind: payment_schedule_regenerated`) distinguishes this row
  // from other system-issued activity entries.
  await db.insert(bookingActivityLog).values({
    bookingId,
    actorId: "system",
    activityType: "system_action",
    description: `Payment schedule regenerated from ${source} policy (${entries.length} row${
      entries.length === 1 ? "" : "s"
    })`,
    metadata: {
      kind: "payment_schedule_regenerated",
      policySource: source,
      policy,
      entries,
    },
  })
}

/**
 * Resolve the supplier (if any) of a booking. Picks the first
 * `booking_supplier_statuses` row by creation order and walks
 * `supplier_services.supplier_id` → `suppliers.customer_payment_policy`.
 *
 * Returns `null` when:
 *   - the booking has no supplier-status rows (most owned bookings)
 *   - the supplier service can't be resolved
 *   - the supplier has no customer-policy override (`null` jsonb)
 *
 * Multi-supplier bookings (rare) only get the first supplier's
 * policy. A future iteration could resolve per-line policies if the
 * use case shows up.
 */
async function resolveSupplierPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [row] = await db
    .select({
      policy: suppliers.customerPaymentPolicy,
    })
    .from(bookingSupplierStatuses)
    .innerJoin(supplierServices, eq(supplierServices.id, bookingSupplierStatuses.supplierServiceId))
    .innerJoin(suppliers, eq(suppliers.id, supplierServices.supplierId))
    .where(eq(bookingSupplierStatuses.bookingId, bookingId))
    .orderBy(asc(bookingSupplierStatuses.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

/**
 * Resolve the product-category policy (if any) for a booking.
 *
 * Walks `booking_items.product_id` → `product_category_products` →
 * `product_categories` and picks the FIRST category by
 * `productCategoryProducts.sortOrder` ascending that has a non-null
 * `customer_payment_policy`. Multi-product bookings consider every
 * product's categories merged into a single sort order.
 *
 * Returns `null` when:
 *   - the booking has no product items linked to categories
 *   - none of the matched categories have a policy override
 */
async function resolveCategoryPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const productIds = await db
    .select({ productId: bookingItems.productId })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))

  const ids = productIds.map((r) => r.productId).filter((id): id is string => Boolean(id))
  if (ids.length === 0) return null

  const [row] = await db
    .select({
      policy: productCategories.customerPaymentPolicy,
    })
    .from(productCategoryProducts)
    .innerJoin(productCategories, eq(productCategories.id, productCategoryProducts.categoryId))
    .where(
      and(
        inArray(productCategoryProducts.productId, ids),
        isNotNull(productCategories.customerPaymentPolicy),
      ),
    )
    .orderBy(asc(productCategoryProducts.sortOrder), asc(productCategoryProducts.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

/**
 * Resolve the per-listing policy (if any) for a booking. Tries each
 * vertical's listing-shape in order:
 *
 *   1. Cruise — cabin category > sailing > cruise (most-specific
 *      first, since cabin-category overrides are common in cruise
 *      pricing).
 *   2. Accommodation — the booking's selected rate-plan policy.
 *   3. Product — the booking's first non-null product policy.
 *
 * Returns the first non-null policy found across the verticals.
 * `null` falls through to the category / supplier / operator
 * default in the cascade.
 */
async function resolveListingPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const cruisePolicy = await resolveCruiseListingPolicy(db, bookingId)
  if (cruisePolicy) return cruisePolicy

  const stayPolicy = await resolveAccommodationListingPolicy(db, bookingId)
  if (stayPolicy) return stayPolicy

  return resolveProductListingPolicy(db, bookingId)
}

/**
 * Accommodation-vertical listing resolver.
 *
 * Walks `stay_booking_items.rate_plan_id` → `rate_plans` and returns
 * the first non-null `customerPaymentPolicy`. Accommodation bookings
 * link from the generic `booking_items` row through
 * `stay_booking_items` to a `rate_plans` row — non-refundable
 * advance-purchase rates carry stricter terms than flexible best-
 * available rates at the same property.
 *
 * Returns `null` when this isn't an accommodations booking (no
 * stay_booking_items row) or none of the matched rate plans carry a
 * policy override.
 *
 * Multi-room bookings (rare for direct customer bookings, common
 * for groups) take the first stay_booking_items row by
 * createdAt — same heuristic as products.
 */
async function resolveAccommodationListingPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [row] = await db
    .select({ policy: ratePlans.customerPaymentPolicy })
    .from(stayBookingItems)
    .innerJoin(bookingItems, eq(bookingItems.id, stayBookingItems.bookingItemId))
    .innerJoin(ratePlans, eq(ratePlans.id, stayBookingItems.ratePlanId))
    .where(and(eq(bookingItems.bookingId, bookingId), isNotNull(ratePlans.customerPaymentPolicy)))
    .orderBy(asc(stayBookingItems.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

/**
 * Cruise-vertical listing resolver.
 *
 * Reads `booking_cruise_details.{sailingId, cabinCategoryId}` and
 * walks the three cruise layers in most-specific order:
 *
 *   cabin_category.customerPaymentPolicy
 *     ↓ falls back to
 *   cruise_sailings.customerPaymentPolicy
 *     ↓ falls back to
 *   cruises.customerPaymentPolicy
 *
 * Returns `null` when this isn't a cruise booking (no
 * booking_cruise_details row) or when none of the three cruise
 * layers carry a policy — letting the caller fall through to the
 * product / category / supplier / operator-default cascade.
 */
async function resolveCruiseListingPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [details] = await db
    .select({
      sailingId: bookingCruiseDetails.sailingId,
      cabinCategoryId: bookingCruiseDetails.cabinCategoryId,
    })
    .from(bookingCruiseDetails)
    .where(eq(bookingCruiseDetails.bookingId, bookingId))
    .limit(1)
  if (!details) return null

  // Cabin-category — most specific. Suite vs. balcony vs. interior
  // can carry distinct deposit / cancellation terms at the same
  // sailing.
  if (details.cabinCategoryId) {
    const [cabin] = await db
      .select({ policy: cruiseCabinCategories.customerPaymentPolicy })
      .from(cruiseCabinCategories)
      .where(eq(cruiseCabinCategories.id, details.cabinCategoryId))
      .limit(1)
    const cabinPolicy = (cabin?.policy as PaymentPolicy | null | undefined) ?? null
    if (cabinPolicy) return cabinPolicy
  }

  // Sailing — gala / holiday-week premiums.
  if (details.sailingId) {
    const [sailing] = await db
      .select({
        policy: cruiseSailings.customerPaymentPolicy,
        cruiseId: cruiseSailings.cruiseId,
      })
      .from(cruiseSailings)
      .where(eq(cruiseSailings.id, details.sailingId))
      .limit(1)
    const sailingPolicy = (sailing?.policy as PaymentPolicy | null | undefined) ?? null
    if (sailingPolicy) return sailingPolicy

    // Cruise (parent of the sailing).
    if (sailing?.cruiseId) {
      const [cruise] = await db
        .select({ policy: cruises.customerPaymentPolicy })
        .from(cruises)
        .where(eq(cruises.id, sailing.cruiseId))
        .limit(1)
      return (cruise?.policy as PaymentPolicy | null | undefined) ?? null
    }
  }

  return null
}

/**
 * Products-vertical listing resolver.
 *
 * Multi-product bookings: takes the first product (ordered by
 * `booking_items.createdAt` ascending) with a non-null policy.
 * Mixed-product bookings (e.g. tour + add-on transfer) typically
 * have one "primary" product driving the booking total, so first-by-
 * creation is a sensible default. Operators with mixed-vertical
 * bookings can promote the per-booking override when this default
 * doesn't fit.
 */
async function resolveProductListingPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [row] = await db
    .select({
      policy: products.customerPaymentPolicy,
    })
    .from(bookingItems)
    .innerJoin(products, eq(products.id, bookingItems.productId))
    .where(and(eq(bookingItems.bookingId, bookingId), isNotNull(products.customerPaymentPolicy)))
    .orderBy(asc(bookingItems.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

const POLICY_SOURCE_MARKER_PREFIX = "__payment_policy_source__:"

async function stampPolicySourceOnBooking(
  db: PostgresJsDatabase,
  bookingId: string,
  source: PaymentPolicySource,
): Promise<void> {
  const [row] = await db
    .select({ internalNotes: bookings.internalNotes })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!row) return

  // Strip any prior marker line so re-fires don't accumulate.
  const filtered = (row.internalNotes ?? "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(POLICY_SOURCE_MARKER_PREFIX))
    .join("\n")

  const marker = `${POLICY_SOURCE_MARKER_PREFIX}${source}`
  const next = filtered.length > 0 ? `${filtered}\n${marker}` : marker

  await db
    .update(bookings)
    .set({ internalNotes: next, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
}

/**
 * Read the policy-source marker stamped onto a booking by the
 * schedule subscriber. Used by the contract resolver so
 * `booking.paymentPolicy.source` reflects the actual cascade layer
 * (`supplier`, `operator_default`, etc.) rather than always echoing
 * `"operator_default"`.
 */
export function readPolicySourceFromInternalNotes(
  internalNotes: string | null | undefined,
): PaymentPolicySource | null {
  if (!internalNotes) return null
  for (const line of internalNotes.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith(POLICY_SOURCE_MARKER_PREFIX)) {
      const value = trimmed.slice(POLICY_SOURCE_MARKER_PREFIX.length).trim()
      switch (value) {
        case "booking":
        case "listing":
        case "category":
        case "supplier":
        case "operator_default":
          return value
        default:
          return null
      }
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────
// Admin route: update booking-level policy + regenerate schedule
// ─────────────────────────────────────────────────────────────────

const depositRuleApiSchema = z.object({
  kind: z.enum(["none", "percent", "fixed_cents"]),
  percent: z.number().min(0).max(100).optional(),
  amountCents: z.number().int().min(0).optional(),
})

const policyApiSchema = z.object({
  deposit: depositRuleApiSchema,
  minDaysBeforeDepartureForDeposit: z.number().int().min(0),
  balanceDueDaysBeforeDeparture: z.number().int().min(0),
  balanceDueMinDaysFromNow: z.number().int().min(0),
})

const regenerateScheduleBodySchema = z.object({
  /**
   * Optional booking-level override. When provided, persists onto
   * `bookings.customerPaymentPolicy` before running the resolver.
   * Pass `null` to clear an existing override (cascade falls back
   * to listing/category/supplier/operator default).
   */
  customerPaymentPolicy: policyApiSchema.nullable().optional(),
})

async function handleRegenerateSchedule(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const bookingId = c.req.param("bookingId")
  if (!bookingId) {
    return c.json({ error: "missing_booking_id" }, 400)
  }

  let body: z.infer<typeof regenerateScheduleBodySchema>
  try {
    body = await parseJsonBody(c, regenerateScheduleBodySchema)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "invalid_body" }, 400)
  }

  // Persist the override (or clear it) before running the resolver.
  if (Object.hasOwn(body, "customerPaymentPolicy")) {
    const [before] = await db
      .select({ customerPaymentPolicy: bookings.customerPaymentPolicy })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    await db
      .update(bookings)
      .set({
        customerPaymentPolicy: (body.customerPaymentPolicy ?? null) as unknown,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))

    const overrideChanged =
      JSON.stringify(before?.customerPaymentPolicy ?? null) !==
      JSON.stringify(body.customerPaymentPolicy ?? null)
    if (overrideChanged) {
      await appendActionLedgerMutation(db, {
        context: getPaymentScheduleActionLedgerRequestContext(c),
        actionName: "booking.payment_policy.override",
        actionVersion: "v1",
        actionKind: "update",
        evaluatedRisk: "high",
        targetType: "booking",
        targetId: bookingId,
        routeOrToolName: "bookings.payment-schedule.regenerate",
        authorizationSource: "operator.booking-schedule.route",
        mutationDetail: {
          summary:
            body.customerPaymentPolicy === null
              ? "Cleared booking payment policy override"
              : "Updated booking payment policy override",
          reversalKind: "none",
        },
      })
    }
  }

  await generatePaymentScheduleForBooking(db, bookingId)

  const rows = await db
    .select()
    .from(bookingPaymentSchedules)
    .where(eq(bookingPaymentSchedules.bookingId, bookingId))
    .orderBy(asc(bookingPaymentSchedules.dueDate), asc(bookingPaymentSchedules.createdAt))

  const [updatedBooking] = await db
    .select({
      customerPaymentPolicy: bookings.customerPaymentPolicy,
      internalNotes: bookings.internalNotes,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)

  return c.json({
    data: {
      schedule: rows,
      bookingPolicy: updatedBooking?.customerPaymentPolicy ?? null,
      cascadeSource:
        readPolicySourceFromInternalNotes(updatedBooking?.internalNotes ?? "") ??
        "operator_default",
    },
  })
}

function getPaymentScheduleActionLedgerRequestContext(
  c: Context,
): ActionLedgerRequestContextValues {
  return {
    userId: c.get("userId") ?? null,
    agentId: c.get("agentId") ?? null,
    workflowPrincipalId: c.get("workflowPrincipalId") ?? null,
    principalSubtype: c.get("principalSubtype") ?? null,
    sessionId: c.get("sessionId") ?? null,
    apiTokenId: c.get("apiTokenId") ?? c.get("apiKeyId") ?? null,
    callerType: c.get("callerType") ?? null,
    actor: c.get("actor") ?? null,
    isInternalRequest: c.get("isInternalRequest") ?? false,
    organizationId: c.get("organizationId") ?? null,
    workflowRunId: c.get("workflowRunId") ?? null,
    workflowStepId: c.get("workflowStepId") ?? null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }
}

export function mountBookingPaymentScheduleRoutes(hono: Hono): void {
  hono.post("/v1/admin/bookings/:bookingId/payment-schedule/regenerate", handleRegenerateSchedule)
}

// ─────────────────────────────────────────────────────────────────
// Public route: resolve policy for an entity (storefront preview)
// ─────────────────────────────────────────────────────────────────

const resolvePolicyBodySchema = z.object({
  entityModule: z.string(),
  entityId: z.string(),
  /** Cruise journey selections — resolver walks cabin → sailing →
   *  cruise once these are picked. Optional because the customer
   *  may not have selected a cabin yet. */
  sailingId: z.string().optional(),
  cabinCategoryId: z.string().optional(),
  /** Accommodation journey selection — resolver picks the rate plan's
   *  policy when present. */
  ratePlanId: z.string().optional(),
})

async function handleResolvePolicy(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase

  let body: z.infer<typeof resolvePolicyBodySchema>
  try {
    body = await parseJsonBody(c, resolvePolicyBodySchema)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "invalid_body" }, 400)
  }

  const operatorDefault = (await resolveOperatorDefaultPaymentPolicy(db)) ?? noDepositPolicy

  // Vertical-specific listing lookups — same source-of-truth queries
  // as the booking-confirmed path, just keyed off the journey
  // selections instead of a persisted booking_items row.
  const listingPolicy = await resolveListingPolicyForEntity(db, body)
  const categoryPolicy = await resolveCategoryPolicyForEntity(db, body)
  const supplierPolicy = await resolveSupplierPolicyForEntity(db, body)

  const { policy, source } = resolveEffectivePaymentPolicy({
    listingPolicy,
    categoryPolicy,
    supplierPolicy,
    operatorDefault,
  })

  return c.json({
    data: {
      policy,
      source,
    },
  })
}

/**
 * Per-entity listing resolver — used at storefront-preview time
 * before a booking exists. Mirrors `resolveListingPolicy` but keyed
 * off journey-level selections.
 */
async function resolveListingPolicyForEntity(
  db: PostgresJsDatabase,
  ctx: z.infer<typeof resolvePolicyBodySchema>,
): Promise<PaymentPolicy | null> {
  if (ctx.entityModule === "cruises") {
    // cabin-category > sailing > cruise
    if (ctx.cabinCategoryId) {
      const [cabin] = await db
        .select({ policy: cruiseCabinCategories.customerPaymentPolicy })
        .from(cruiseCabinCategories)
        .where(eq(cruiseCabinCategories.id, ctx.cabinCategoryId))
        .limit(1)
      const cabinPolicy = (cabin?.policy as PaymentPolicy | null | undefined) ?? null
      if (cabinPolicy) return cabinPolicy
    }
    if (ctx.sailingId) {
      const [sailing] = await db
        .select({ policy: cruiseSailings.customerPaymentPolicy })
        .from(cruiseSailings)
        .where(eq(cruiseSailings.id, ctx.sailingId))
        .limit(1)
      const sailingPolicy = (sailing?.policy as PaymentPolicy | null | undefined) ?? null
      if (sailingPolicy) return sailingPolicy
    }
    const [cruise] = await db
      .select({ policy: cruises.customerPaymentPolicy })
      .from(cruises)
      .where(eq(cruises.id, ctx.entityId))
      .limit(1)
    return (cruise?.policy as PaymentPolicy | null | undefined) ?? null
  }

  if (ctx.entityModule === "accommodations") {
    if (ctx.ratePlanId) {
      const [plan] = await db
        .select({ policy: ratePlans.customerPaymentPolicy })
        .from(ratePlans)
        .where(eq(ratePlans.id, ctx.ratePlanId))
        .limit(1)
      return (plan?.policy as PaymentPolicy | null | undefined) ?? null
    }
    return null
  }

  if (ctx.entityModule === "products") {
    const [product] = await db
      .select({ policy: products.customerPaymentPolicy })
      .from(products)
      .where(eq(products.id, ctx.entityId))
      .limit(1)
    return (product?.policy as PaymentPolicy | null | undefined) ?? null
  }

  return null
}

/**
 * Per-entity category resolver. Currently only products carry
 * categories — cruises and accommodations fall through.
 */
async function resolveCategoryPolicyForEntity(
  db: PostgresJsDatabase,
  ctx: z.infer<typeof resolvePolicyBodySchema>,
): Promise<PaymentPolicy | null> {
  if (ctx.entityModule !== "products") return null

  const [row] = await db
    .select({ policy: productCategories.customerPaymentPolicy })
    .from(productCategoryProducts)
    .innerJoin(productCategories, eq(productCategories.id, productCategoryProducts.categoryId))
    .where(
      and(
        eq(productCategoryProducts.productId, ctx.entityId),
        isNotNull(productCategories.customerPaymentPolicy),
      ),
    )
    .orderBy(asc(productCategoryProducts.sortOrder), asc(productCategoryProducts.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

/**
 * Per-entity supplier resolver. Reads the supplier id off the entity
 * row directly (products.supplierId, cruises.lineSupplierId, etc.)
 * and looks up the supplier's policy. Owned products may have a null
 * supplier — falls through.
 */
async function resolveSupplierPolicyForEntity(
  db: PostgresJsDatabase,
  ctx: z.infer<typeof resolvePolicyBodySchema>,
): Promise<PaymentPolicy | null> {
  let supplierId: string | null = null

  if (ctx.entityModule === "products") {
    const [row] = await db
      .select({ supplierId: products.supplierId })
      .from(products)
      .where(eq(products.id, ctx.entityId))
      .limit(1)
    supplierId = row?.supplierId ?? null
  } else if (ctx.entityModule === "cruises") {
    const [row] = await db
      .select({ supplierId: cruises.lineSupplierId })
      .from(cruises)
      .where(eq(cruises.id, ctx.entityId))
      .limit(1)
    supplierId = row?.supplierId ?? null
  }

  if (!supplierId) return null

  const [supplier] = await db
    .select({ policy: suppliers.customerPaymentPolicy })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1)

  return (supplier?.policy as PaymentPolicy | null | undefined) ?? null
}

export function mountPublicPaymentPolicyRoutes(hono: Hono): void {
  hono.post("/v1/public/payment-policy/resolve", handleResolvePolicy)
}
