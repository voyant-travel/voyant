"use client"

import { createFileRoute, redirect } from "@tanstack/react-router"
import {
  StorefrontBookingPage,
  storefrontBookingSearchSchema,
} from "@voyant-travel/bookings-react/storefront"
import { getStorefrontCustomerProductDetailRoute } from "@voyant-travel/storefront-react"
import {
  type StorefrontUiNavigation,
  StorefrontUiProvider,
  useStorefrontMessagesOrDefault,
  useStorefrontScope,
} from "@voyant-travel/storefront-react/storefront"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/(storefront)/shop_/book/$entityModule/$entityId")({
  beforeLoad: ({ params }) => {
    if (!getStorefrontCustomerProductDetailRoute(params.entityModule, params.entityId)) {
      throw redirect({ to: "/shop" })
    }
  },
  component: ShopBookRoute,
  validateSearch: storefrontBookingSearchSchema,
})

function ShopBookRoute(): React.ReactElement {
  const { entityModule, entityId } = Route.useParams()
  const search = Route.useSearch()
  const messages = useStorefrontMessagesOrDefault()
  const scope = useStorefrontScope()
  const navigate = Route.useNavigate()

  return (
    <StorefrontUiProvider
      value={{
        apiUrl: getApiUrl(),
        messages,
        scope,
        navigate: (navigation: StorefrontUiNavigation) => navigate(navigation as never),
      }}
    >
      <StorefrontBookingPage
        entityModule={entityModule}
        entityId={entityId}
        messages={messages.bookingJourney}
        search={search}
      />
    </StorefrontUiProvider>
  )
}
