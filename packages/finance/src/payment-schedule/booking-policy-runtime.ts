/**
 * Reach the injected policy cascade from a route that isn't the
 * booking-schedule route module.
 *
 * The cascade readers are deployment-supplied and land in the module
 * container under {@link BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY} (the
 * booking-schedule extension's bootstrap registers them there for the
 * `booking.confirmed` subscriber). The `default-plan` route and the checkout
 * collection runtime need the same answer, so they read the same registration
 * instead of growing a second injection point that a deployment could wire
 * differently — which is how voyant#4744 happened in the first place.
 */

import type { ModuleContainer } from "@voyant-travel/core"

import {
  BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY,
  type BookingScheduleSubscriberRuntime,
} from "../booking-schedule/subscriber-runtime.js"
import type { BookingPaymentPolicyCascadeReaders } from "./booking-policy.js"

/**
 * The cascade readers this deployment composed, or `null` when it composes no
 * booking-schedule extension.
 *
 * `null` is not a fallback to some other plan — callers treat an absent
 * cascade as `noDepositPolicy`, the documented safe default for an
 * unconfigured operator. A deployment that never configured a deposit gets
 * "pay in full", not someone's guess at 30%.
 */
export async function resolveBookingPaymentPolicyCascade(
  container: ModuleContainer | undefined,
  bindings: unknown,
): Promise<BookingPaymentPolicyCascadeReaders | null> {
  // `c.var.container` is whatever the host put there. A test harness or a
  // partially-composed app can leave a plain object in that slot, so the shape
  // is checked rather than assumed — a payment plan must not 500 because the
  // deployment declined to register a container.
  if (typeof container?.has !== "function" || typeof container.resolve !== "function") return null

  try {
    if (!container.has(BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY)) return null
    const runtime = container.resolve<BookingScheduleSubscriberRuntime>(
      BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY,
    )
    const readers = await runtime?.resolveRoutesOptions?.(bindings)
    return isCascadeReaders(readers) ? readers : null
  } catch {
    return null
  }
}

/**
 * A registration only counts when it can answer the whole cascade. Half a
 * cascade would resolve a policy from whichever layers happened to be present,
 * which is a quieter version of the bug this replaced.
 */
function isCascadeReaders(value: unknown): value is BookingPaymentPolicyCascadeReaders {
  if (!value || typeof value !== "object") return false
  const readers = value as Partial<BookingPaymentPolicyCascadeReaders>
  return (
    typeof readers.resolveOperatorDefaultPaymentPolicy === "function" &&
    typeof readers.resolveSupplierPolicy === "function" &&
    typeof readers.resolveCategoryPolicy === "function" &&
    typeof readers.resolveListingPolicy === "function"
  )
}
