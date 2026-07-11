"use client"

import { type AdminRoutePageProps, AdminWidgetSlotRenderer } from "@voyant-travel/admin"

import { BookingsHost } from "../bookings-host.js"
import {
  type BookingsIndexSearchParams,
  bookingsFiltersToSearch,
  bookingsListHeaderActionsSlot,
  bookingsSearchToFilters,
} from "../index.js"

/**
 * Packaged bookings list page (packaged-admin RFC §4.8): binds the route's
 * URL search state onto {@link BookingsHost}'s filter props. The search shape
 * is the package-owned contract the contribution's `validateSearch` parses
 * (`bookingsIndexSearchSchema`), so the cast below narrows to a shape the
 * router already validated.
 */
export default function BookingsIndexPage({ search, updateSearch }: AdminRoutePageProps) {
  return (
    <BookingsHost
      headerActions={<AdminWidgetSlotRenderer slot={bookingsListHeaderActionsSlot} />}
      initialFilters={bookingsSearchToFilters(search as BookingsIndexSearchParams)}
      onFiltersChange={(filters) =>
        // Full search replace on purpose: the projection re-derives the WHOLE
        // search state from the filter snapshot, so the updater ignores
        // `prev` instead of merging stale params back in.
        updateSearch(() => bookingsFiltersToSearch(filters), { replace: true })
      }
    />
  )
}
