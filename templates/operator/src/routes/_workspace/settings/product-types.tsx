import { createFileRoute } from "@tanstack/react-router"
import { getProductTypesQueryOptions } from "@voyantjs/products-react"
import { ProductTypesPage } from "@voyantjs/products-react/ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/settings/product-types")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getProductTypesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: ProductTypesRoute,
})

function ProductTypesRoute() {
  return <ProductTypesPage />
}
