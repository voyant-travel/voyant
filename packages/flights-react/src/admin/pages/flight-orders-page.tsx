"use client"

import { type AdminRoutePageProps, useAdminNavigate } from "@voyant-travel/admin"

import {
  FlightOrdersPage,
  type FlightOrdersPageSearchParams,
} from "../../components/flight-orders-page.js"

/**
 * Packaged route page for the flights orders list. Filters live in the route
 * search (validated by {@link flightsOrdersSearchSchema}); opening a row
 * navigates to the order detail through the `flightOrder.detail` destination.
 *
 * Filter changes REPLACE (not push) so the back button leaves the orders list
 * rather than walking every keystroke of the search box.
 */
// fallow-ignore-next-line unused-export
export default function FlightOrdersRoutePage({ search, updateSearch }: AdminRoutePageProps) {
  const navigateTo = useAdminNavigate()

  return (
    <FlightOrdersPage
      search={search as FlightOrdersPageSearchParams}
      onSearchChange={(next) =>
        updateSearch(() => next as Record<string, unknown>, { replace: true })
      }
      onOpenOrder={(orderId) => navigateTo("flightOrder.detail", { orderId })}
    />
  )
}
