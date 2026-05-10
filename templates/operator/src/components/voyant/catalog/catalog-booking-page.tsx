"use client"

import { useNavigate } from "@tanstack/react-router"
import {
  CatalogBookingPage as CatalogUiBookingPage,
  createCatalogBookingFetchers,
} from "@voyantjs/catalog-ui"
import { useMemo } from "react"
import { toast } from "sonner"

import { PassengerContactPicker } from "@/components/voyant/flights/passenger-contact-picker"
import { getApiUrl } from "@/lib/env"
import { Route } from "@/routes/_workspace/catalog_.book.$entityModule.$entityId"

export function CatalogBookingPage() {
  const navigate = useNavigate()
  const params = Route.useParams()
  const search = Route.useSearch()
  const fetchers = useMemo(() => createCatalogBookingFetchers({ baseUrl: getApiUrl() }), [])

  return (
    <CatalogUiBookingPage
      route={{
        entityModule: params.entityModule,
        entityId: params.entityId,
        sourceKind: search.sourceKind,
        sourceRef: search.sourceRef,
        name: search.name,
        supplierId: search.supplierId,
        locale: search.locale,
        departureId: search.departureId,
        departureStartsAt: search.departureStartsAt,
      }}
      fetchers={fetchers}
      onBackToCatalog={() => navigate({ to: "/catalog" })}
      onCancel={() => navigate({ to: "/catalog" })}
      onAddContact={() => window.open("/people", "_blank")}
      renderContactPicker={({ onPick, onAddContact }) => (
        <PassengerContactPicker onPick={onPick} onAddContact={onAddContact} />
      )}
      onBookingSuccess={(booking) => {
        toast.success(`Booked - order ${booking.orderRef.slice(0, 16)}... (${booking.status})`, {
          action: {
            label: "View bookings",
            onClick: () => navigate({ to: "/bookings" }),
          },
        })
        navigate({ to: "/bookings" })
      }}
      onBookingError={(message) => toast.error(`Book request failed: ${message}`)}
    />
  )
}
