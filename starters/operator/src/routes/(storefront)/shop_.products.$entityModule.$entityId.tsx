"use client"

import { createFileRoute, useParams } from "@tanstack/react-router"
import { CruiseDetailPage } from "@voyant-travel/cruises-react/storefront"
import { ProductDetailPageProducts } from "@voyant-travel/inventory-react/storefront"
import { getStorefrontCustomerProductDetailRoute } from "@voyant-travel/storefront-react"
import {
  AccommodationDetailPage,
  type StorefrontUiNavigation,
  StorefrontUiProvider,
  useStorefrontMessagesOrDefault,
  useStorefrontScope,
} from "@voyant-travel/storefront-react/storefront"
import { Card, CardContent, CardHeader, CardTitle } from "@voyant-travel/ui/components/card"
import type React from "react"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/(storefront)/shop_/products/$entityModule/$entityId")({
  component: DetailPage,
})

export function DetailPage(): React.ReactElement {
  const { entityModule, entityId } = useParams({
    from: "/(storefront)/shop_/products/$entityModule/$entityId",
  })
  const messages = useStorefrontMessagesOrDefault()
  const scope = useStorefrontScope()
  const navigate = Route.useNavigate()
  const t = messages.shop

  if (!getStorefrontCustomerProductDetailRoute(entityModule, entityId)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.nonBookableTitle}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {t.nonBookableBody.replace("{vertical}", formatVerticalLabel(entityModule, t))}
        </CardContent>
      </Card>
    )
  }

  const detail =
    entityModule === "accommodations" ? (
      <AccommodationDetailPage entityId={entityId} />
    ) : entityModule === "cruises" ? (
      <CruiseDetailPage entityId={entityId} />
    ) : (
      <ProductDetailPageProducts entityModule={entityModule} entityId={entityId} />
    )

  return (
    <StorefrontUiProvider
      value={{
        apiUrl: getApiUrl(),
        messages,
        scope,
        navigate: (navigation: StorefrontUiNavigation) => navigate(navigation as never),
      }}
    >
      {detail}
    </StorefrontUiProvider>
  )
}

function formatVerticalLabel(vertical: string, messages: Record<string, string>): string {
  if (vertical === "products") return messages.verticalProducts
  if (vertical === "cruises") return messages.verticalCruises
  if (vertical === "accommodations") return messages.verticalAccommodations
  if (vertical === "charters") return messages.verticalCharters
  return vertical
}
