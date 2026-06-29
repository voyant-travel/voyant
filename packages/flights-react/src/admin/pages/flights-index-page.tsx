"use client"

import { type AdminRoutePageProps, useAdminNavigate } from "@voyant-travel/admin"

import { FlightsPage } from "../../components/flights-page.js"
import type { FlightsIndexSearchParams } from "../index.js"

/**
 * Packaged route page for the flight search surface. The contribution's
 * `validateSearch` ({@link flightsIndexSearchSchema}) already validated
 * `search`, so the cast onto the page's search contract is sound.
 *
 * Search updates default to PUSH (not replace): each leg pick / filter
 * change is a history entry, which is what makes the back button walk the
 * outbound → return → ready flow. Booking continues into the wizard through
 * the `flightBooking.start` destination (host-resolved — its href carries
 * the pax/cabin search params).
 */
// fallow-ignore-next-line unused-export
export default function FlightsIndexPage({ search, updateSearch }: AdminRoutePageProps) {
  const navigateTo = useAdminNavigate()

  return (
    <FlightsPage
      search={search as FlightsIndexSearchParams}
      onSearchChange={(next, options) =>
        updateSearch(() => next as Record<string, unknown>, {
          replace: options?.replace ?? false,
        })
      }
      onBookOffer={({ outboundOfferId, returnOfferId, passengers, cabin }) =>
        navigateTo("flightBooking.start", {
          offerId: outboundOfferId,
          ...(returnOfferId ? { returnOfferId } : {}),
          adults: passengers.adults,
          children: passengers.children ?? 0,
          infants: passengers.infants ?? 0,
          cabin,
        })
      }
    />
  )
}
