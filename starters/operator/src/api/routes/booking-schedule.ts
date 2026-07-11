/**
 * Booking payment-schedule wiring for this deployment.
 *
 * The route handlers + schedule-generation orchestration now live in
 * `@voyant-travel/finance` (`createBookingScheduleAdminRoutes`,
 * `createPaymentPolicyPublicRoutes`, `generatePaymentScheduleForBooking`). This
 * file supplies the deployment-specific cascade resolvers + operator default
 * and exposes `createBookingScheduleExtension()`, the composed HonoExtension on
 * the `bookings` module (admin route at `/v1/admin/bookings/...`, public route
 * at `/v1/public/payment-policy/resolve` via the publicPath override).
 *
 * Idempotency, cascade precedence, and the activity-log entry are preserved in
 * the package; this file is now pure glue. See
 * docs/architecture/api-route-ownership-and-composition.md.
 */

import type { BookingScheduleRoutesOptions } from "@voyant-travel/finance"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

/**
 * Build the deployment's booking-schedule route options — the cascade
 * resolvers (which read across vertical modules finance must not import) +
 * operator default + per-request db resolver. The bookings-schema reads and
 * action-ledger appender are handled inside the package directly.
 */
export async function createBookingScheduleRoutesOptions(): Promise<BookingScheduleRoutesOptions> {
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
