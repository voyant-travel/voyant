import { createFileRoute } from "@tanstack/react-router"

import { CatalogOrdersPage } from "@/components/voyant/catalog/catalog-orders-page"

export const Route = createFileRoute("/_workspace/orders/catalog")({
  component: CatalogOrdersPage,
})
