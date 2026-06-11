import { createFileRoute } from "@tanstack/react-router"
import { ProductDetailHost, productDetailSearchSchema } from "@voyantjs/catalog-ui/admin"

// Thin host for the package-delivered product detail page (packaged-admin
// RFC Phase 2). Page, search contract, and booking-journey navigation
// (semantic destinations, RFC §4.7) are package-owned; this file only binds
// the route param + search context onto the host's props.
export const Route = createFileRoute("/_workspace/catalog/products/$productId")({
  validateSearch: productDetailSearchSchema,
  component: CatalogProductDetailRoute,
})

function CatalogProductDetailRoute() {
  const { productId } = Route.useParams()
  const { adults, nights, locale } = Route.useSearch()

  return <ProductDetailHost productId={productId} adults={adults} nights={nights} locale={locale} />
}
