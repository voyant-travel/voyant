"use client"

import { useNavigate } from "@tanstack/react-router"
import {
  CatalogBookingPage as CatalogUiBookingPage,
  createCatalogBookingFetchers,
} from "@voyantjs/catalog-ui"
import { formatMessage } from "@voyantjs/i18n"
import { useMemo } from "react"
import { toast } from "sonner"

import { PassengerContactPicker } from "@/components/voyant/flights/passenger-contact-picker"
import { useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"
import { Route } from "@/routes/_workspace/catalog_.book.$entityModule.$entityId"
import { catalogVerticalPath } from "./catalog-route-state"

export function CatalogBookingPage() {
  const navigate = useNavigate()
  const t = useAdminMessages().products.operations.catalogBookingToasts
  const params = Route.useParams()
  const search = Route.useSearch()
  const fetchers = useMemo(() => createCatalogBookingFetchers({ baseUrl: getApiUrl() }), [])
  const backToCatalogPath = catalogVerticalPath(params.entityModule)

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
      onBackToCatalog={() => navigate({ to: backToCatalogPath })}
      onCancel={() => navigate({ to: backToCatalogPath })}
      onAddContact={() => window.open("/people", "_blank")}
      renderContactPicker={({ onPick, onAddContact }) => (
        <PassengerContactPicker onPick={onPick} onAddContact={onAddContact} />
      )}
      onBookingSuccess={(booking) => {
        toast.success(
          formatMessage(t.bookedSuccess, {
            ref: booking.orderRef.slice(0, 16),
            status: booking.status,
          }),
          {
            action: {
              label: t.viewBookings,
              onClick: () => navigate({ to: "/bookings" }),
            },
          },
        )
        navigate({ to: "/bookings" })
      }}
      onBookingError={(message) => toast.error(formatMessage(t.bookFailed, { message }))}
    />
  )
}
