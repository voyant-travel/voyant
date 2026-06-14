"use client"

/**
 * Heads-up shown under the billing block when the picked lead (person for B2C,
 * organization for B2B) already has a booking on the selected departure — with
 * a link to each. Helps operators avoid accidental duplicate bookings.
 */

import { useAdminNavigate, useOperatorAdminMessages } from "@voyant-travel/admin"

import { useBookings } from "../hooks/use-bookings.js"
import type { BillingExtrasContext } from "../journey/index.js"

export function JourneyBillingDuplicateWarning({
  buyerType,
  personId,
  organizationId,
  productId,
  departureSlotId,
}: BillingExtrasContext): React.ReactElement | null {
  const t = useOperatorAdminMessages().bookings.detail.bookingJourney
  const navigate = useAdminNavigate()

  const leadId = buyerType === "B2B" ? organizationId : personId
  // Only a scheduled departure (slot) gives a precise duplicate match.
  const enabled = Boolean(leadId && departureSlotId)

  const query = useBookings({
    ...(buyerType === "B2B" ? { organizationId } : { personId }),
    productId,
    availabilitySlotId: departureSlotId,
    enabled,
  })

  const existing = (query.data?.data ?? []).filter((booking) => booking.status !== "cancelled")
  if (!enabled || existing.length === 0) return null

  return (
    <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <p>⚠ {t.duplicateDepartureWarning}</p>
      <ul className="space-y-0.5">
        {existing.map((booking) => (
          <li key={booking.id}>
            <button
              type="button"
              className="font-medium underline underline-offset-2 hover:opacity-80"
              onClick={() => navigate("booking.detail", { bookingId: booking.id })}
            >
              {booking.bookingNumber}
            </button>
            {booking.items?.[0]?.title ? (
              <span className="text-amber-900/80 dark:text-amber-100/80">
                {" "}
                · {booking.items[0].title}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
