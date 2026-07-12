import { createFileRoute } from "@tanstack/react-router"
import { storefrontPresentationContribution } from "@/lib/storefront-messages"

export const DetailPage = storefrontPresentationContribution.routes.productDetail.component
export const Route = createFileRoute("/(storefront)/shop_/products/$entityModule/$entityId")(
  storefrontPresentationContribution.routes.productDetail,
)
