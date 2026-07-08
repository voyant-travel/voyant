/**
 * Booking payment-schedule wiring for this deployment.
 *
 * The route handlers + schedule-generation orchestration now live in
 * `@voyant-travel/finance` (`createBookingScheduleAdminRoutes`,
 * `createPaymentPolicyPublicRoutes`, `generatePaymentScheduleForBooking`). This
 * file supplies the deployment-specific cascade resolvers + operator default
 * and exposes:
 *
 *   - `bookingScheduleBundle` — the `booking.confirmed` event subscriber
 *     (a plugin, NOT a route) that regenerates the schedule on confirm. It
 *     bootstraps BEFORE the legal module's auto-generate-contract subscriber so
 *     the contract template sees populated deposit/balance fields.
 *   - `createBookingScheduleExtension()` — the composed HonoExtension on the
 *     `bookings` module (admin route at `/v1/admin/bookings/...`, public route
 *     at `/v1/public/payment-policy/resolve` via the publicPath override).
 *
 * Idempotency, cascade precedence, and the activity-log entry are preserved in
 * the package; this file is now pure glue. See
 * docs/architecture/api-route-ownership-and-composition.md.
 */

import type { BookingScheduleRoutesOptions } from "@voyant-travel/finance"
import type { LazyRoutesLoader } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import type { HonoBundle } from "@voyant-travel/hono/plugin"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

interface BookingConfirmedPayload {
  bookingId: string
  bookingNumber: string
  actorId: string | null
}

/**
 * Build the deployment's booking-schedule route options — the cascade
 * resolvers (which read across vertical modules finance must not import) +
 * operator default + per-request db resolver. The bookings-schema reads and
 * action-ledger appender are handled inside the package directly.
 */
async function createBookingScheduleRoutesOptions(): Promise<BookingScheduleRoutesOptions> {
  const [settings, runtime] = await Promise.all([
    import("@voyant-travel/operator-settings"),
    import("../runtime/booking-payment-policy-runtime"),
  ])
  return {
    resolveDb: (c: Context) => c.get("db") as PostgresJsDatabase,
    resolveOperatorDefaultPaymentPolicy: settings.resolveOperatorDefaultPaymentPolicy,
    resolveSupplierPolicy: runtime.resolveSupplierPolicy,
    resolveCategoryPolicy: runtime.resolveCategoryPolicy,
    resolveListingPolicy: runtime.resolveListingPolicy,
    resolveListingPolicyForEntity: runtime.resolveListingPolicyForEntity,
    resolveCategoryPolicyForEntity: runtime.resolveCategoryPolicyForEntity,
    resolveSupplierPolicyForEntity: runtime.resolveSupplierPolicyForEntity,
    stampPolicySourceOnBooking: runtime.stampPolicySourceOnBooking,
    readPolicySourceFromInternalNotes: runtime.readPolicySourceFromInternalNotes,
  }
}

export const bookingScheduleBundle: HonoBundle = {
  name: "booking-schedule",
  bootstrap: ({ bindings, eventBus }) => {
    const env = bindings as AppBindings
    eventBus.subscribe<BookingConfirmedPayload>("booking.confirmed", async ({ data }) => {
      try {
        const [
          { generatePaymentScheduleForBooking, settleCoveredBookingPaymentSchedules },
          { withDbFromEnv },
          runtime,
          options,
        ] = await Promise.all([
          import("@voyant-travel/finance"),
          import("../lib/db"),
          import("../runtime/operator-runtime-adapter"),
          createBookingScheduleRoutesOptions(),
        ])
        await withDbFromEnv(env, async (rawDb) => {
          const db = runtime.operatorPostgresDb(rawDb)
          await generatePaymentScheduleForBooking(db, data.bookingId, options)
          await settleCoveredBookingPaymentSchedules(db, data.bookingId)
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

/**
 * Booking payment-schedule routes as a composed extension on the
 * `bookings` module.
 *
 * - admin: `POST /v1/admin/bookings/:bookingId/payment-schedule/regenerate`
 * - public: `POST /v1/public/payment-policy/resolve` (anonymous storefront
 *   preview; the public mount path is overridden to `payment-policy`).
 *
 * The handler bodies + operator-local policy cascade live in
 * `@voyant-travel/finance`; this file injects the deployment-specific
 * resolvers. See docs/architecture/api-route-ownership-and-composition.md.
 *
 * The event-subscriber bundle (`bookingScheduleBundle`) stays a separate
 * plugin — it carries no routes.
 */
export function createBookingScheduleExtension(): HonoExtension {
  return {
    extension: { name: "booking-schedule", module: "bookings" },
    lazyAdminRoutes: createBookingScheduleAdminRoutesForOperator,
    lazyPublicRoutes: createPaymentPolicyPublicRoutesForOperator,
    publicPath: "payment-policy",
  }
}

export const createBookingScheduleAdminRoutesForOperator: LazyRoutesLoader = async () => {
  const [{ createBookingScheduleAdminRoutes }, options] = await Promise.all([
    import("@voyant-travel/finance"),
    createBookingScheduleRoutesOptions(),
  ])
  return createBookingScheduleAdminRoutes(options)
}

export const createPaymentPolicyPublicRoutesForOperator: LazyRoutesLoader = async () => {
  const [{ createPaymentPolicyPublicRoutes }, options] = await Promise.all([
    import("@voyant-travel/finance"),
    createBookingScheduleRoutesOptions(),
  ])
  return createPaymentPolicyPublicRoutes(options)
}
