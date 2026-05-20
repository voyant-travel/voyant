import { createFileRoute } from "@tanstack/react-router"
import { getProductCategoriesQueryOptions } from "@voyantjs/products-react"
import { ProductCategoriesPage } from "@voyantjs/products-ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/products/categories")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getProductCategoriesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: ProductCategoriesRoute,
})

function ProductCategoriesRoute() {
  return <ProductCategoriesPage />
}
