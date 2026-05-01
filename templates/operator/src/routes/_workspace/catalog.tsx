import { createFileRoute } from "@tanstack/react-router"
import { CatalogPage } from "@/components/voyant/catalog/catalog-page"

export const Route = createFileRoute("/_workspace/catalog")({
  component: CatalogPage,
})
