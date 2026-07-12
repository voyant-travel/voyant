"use client"

import { createFileRoute } from "@tanstack/react-router"
import {
  StorefrontBrowsePage,
  type StorefrontUiNavigation,
  StorefrontUiProvider,
  shopSearchSchema,
} from "@voyant-travel/storefront-react/storefront"

import { getApiUrl } from "@/lib/env"
import { useStorefrontMessagesOrDefault } from "@/lib/storefront-i18n"
import { useStorefrontScope } from "@/lib/storefront-scope"

export const Route = createFileRoute("/(storefront)/shop")({
  component: StorefrontIndexRoute,
  validateSearch: shopSearchSchema,
})

function StorefrontIndexRoute(): React.ReactElement {
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
      <StorefrontBrowsePage search={Route.useSearch()} />
    </StorefrontUiProvider>
  )
}
