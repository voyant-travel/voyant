import { createFileRoute } from "@tanstack/react-router"
import { productDetailSearchSchema } from "@voyantjs/catalog-ui/admin"
import { OperatorProductDetail } from "@/components/voyant/catalog/operator-product-detail"

// Search context carried onto the detail page so live offers match what the
// operator searched (occupancy + length of stay) and the right locale loads.
// The search contract is package-owned (packaged-admin RFC Phase 2 seam); the
// page itself stays app-hosted because OperatorProductDetail binds the
// operator's router navigation into the booking journey.
export const Route = createFileRoute("/_workspace/catalog/products/$productId")({
  validateSearch: productDetailSearchSchema,
  component: CatalogProductDetailRoute,
})

function CatalogProductDetailRoute() {
  const { productId } = Route.useParams()
  const { adults, nights, locale } = Route.useSearch()

  return (
    <OperatorProductDetail productId={productId} adults={adults} nights={nights} locale={locale} />
  )
}
