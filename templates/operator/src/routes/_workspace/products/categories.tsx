import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getProductCategoriesQueryOptions } from "@voyantjs/products-react"
import { ProductCategoriesPage } from "@voyantjs/products-ui"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/products/categories")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getProductCategoriesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: ProductCategoriesRoute,
})

function ProductCategoriesRoute() {
  return <ProductCategoriesPage />
}
