"use client"

import { useQuery } from "@tanstack/react-query"
import { lazy, Suspense, useState } from "react"

import { useVoyantTravelComposerContext } from "../provider.js"
import { getTripQueryOptions } from "../query-options.js"
import { TripRecordPage } from "./trip-detail-record.js"

const AdminTripComposerPage = lazy(() =>
  import("./admin-trip-composer-page.js").then((module) => ({
    default: module.AdminTripComposerPage,
  })),
)

/**
 * Packaged admin host for the trip detail page (packaged-admin RFC
 * Phase 3). The `"new"` pseudo-id mounts the admin trip composer directly;
 * existing trips render the read-only record page (seeded by the
 * `travel-composer-detail` contribution's loader) with an Edit toggle into
 * the composer. Cross-route links (bookings, CRM people, the trips list)
 * resolve through semantic destinations (RFC §4.7).
 */
export function TripDetailHost({ id }: { id: string }) {
  const [mode, setMode] = useState<"record" | "edit">("record")
  const { baseUrl, fetcher } = useVoyantTravelComposerContext()
  const isNew = id === "new"
  const tripQuery = useQuery({
    ...getTripQueryOptions({ baseUrl, fetcher }, id),
    enabled: !isNew,
  })
  const trip = isNew ? null : (tripQuery.data ?? null)

  if (!trip) {
    if (!isNew && tripQuery.isPending) return null
    return (
      <Suspense fallback={null}>
        <AdminTripComposerPage initialTrip={null} />
      </Suspense>
    )
  }
  if (mode === "edit") {
    return (
      <Suspense fallback={null}>
        <AdminTripComposerPage initialTrip={trip} />
      </Suspense>
    )
  }
  return <TripRecordPage trip={trip} onEdit={() => setMode("edit")} />
}
