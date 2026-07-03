"use client"

import { createFileRoute, useParams } from "@tanstack/react-router"
import { getStorefrontCustomerProductDetailRoute } from "@voyant-travel/storefront-react"
import { Card, CardContent, CardHeader, CardTitle } from "@voyant-travel/ui/components/card"
import type React from "react"

import { useStorefrontMessagesOrDefault } from "@/lib/storefront-i18n"
import { AccommodationDetailPage } from "./shop-product-detail-accommodations"
import { ProductDetailPageProducts } from "./shop-product-detail-products"

export const Route = createFileRoute("/(storefront)/shop_/products/$entityModule/$entityId")({
  component: DetailPage,
})

function DetailPage(): React.ReactElement {
  const { entityModule, entityId } = useParams({
    from: "/(storefront)/shop_/products/$entityModule/$entityId",
  })
  const t = useStorefrontMessagesOrDefault().shop

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

  if (entityModule === "accommodations") {
    return <AccommodationDetailPage entityId={entityId} />
  }
  return <ProductDetailPageProducts entityModule={entityModule} entityId={entityId} />
}

function formatVerticalLabel(
  vertical: string,
  messages: ReturnType<typeof useStorefrontMessagesOrDefault>["shop"],
): string {
  if (vertical === "products") return messages.verticalProducts
  if (vertical === "cruises") return messages.verticalCruises
  if (vertical === "accommodations") return messages.verticalAccommodations
  if (vertical === "charters") return messages.verticalCharters
  return vertical
}
