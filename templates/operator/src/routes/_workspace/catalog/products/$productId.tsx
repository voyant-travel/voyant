import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { OperatorProductDetail } from "@/components/voyant/catalog/operator-product-detail"

// Search context carried onto the detail page so live offers match what the
// operator searched (occupancy + length of stay) and the right locale loads.
const productDetailSearchSchema = z.object({
  adults: z.coerce.number().int().min(1).optional(),
  nights: z.coerce.number().int().min(1).optional(),
  locale: z.string().optional(),
})

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
