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

import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
} from "@voyant-travel/action-ledger"
import { bookingActivityLog, bookings } from "@voyant-travel/bookings/schema"
import {
  bookingPaymentSchedules,
  computePaymentSchedule,
  financeService,
  noDepositPolicy,
  type PaymentPolicy,
  resolveEffectivePaymentPolicy,
} from "@voyant-travel/finance"
import { parseJsonBody } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import type { HonoBundle } from "@voyant-travel/hono/plugin"
import { asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"
import { z } from "zod"

import {
  readPolicySourceFromInternalNotes,
  resolveCategoryPolicy,
  resolveCategoryPolicyForEntity,
  resolveListingPolicy,
  resolveListingPolicyForEntity,
  resolveSupplierPolicy,
  resolveSupplierPolicyForEntity,
  stampPolicySourceOnBooking,
} from "./booking-payment-policy-runtime"
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
          await generatePaymentScheduleForBooking(db as PostgresJsDatabase, data.bookingId)
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

// Admin route mounted via the booking-schedule extension below.

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
 * Booking payment-schedule routes as a composed extension on the
 * `bookings` module.
 *
 * - admin: `POST /v1/admin/bookings/:bookingId/payment-schedule/regenerate`
 * - public: `POST /v1/public/payment-policy/resolve` (anonymous storefront
 *   preview; the public mount path is overridden to `payment-policy`).
 *
 * Replaces the former `mountBookingPaymentScheduleRoutes(...)` /
 * `mountPublicPaymentPolicyRoutes(...)` additionalRoutes hops; the handler
 * bodies and operator-local policy cascade are unchanged. See
 * docs/architecture/api-route-ownership-and-composition.md.
 *
 * The event-subscriber bundle (`bookingScheduleBundle`) stays a separate
 * plugin — it carries no routes.
 */
export function createBookingScheduleExtension(): HonoExtension {
  const adminRoutes = new Hono()
  adminRoutes.post("/:bookingId/payment-schedule/regenerate", handleRegenerateSchedule)

  const publicRoutes = new Hono()
  publicRoutes.post("/resolve", handleResolvePolicy)

  return {
    extension: { name: "booking-schedule", module: "bookings" },
    adminRoutes,
    publicRoutes,
    publicPath: "payment-policy",
  }
}
