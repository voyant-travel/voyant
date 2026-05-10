import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getProductTypesQueryOptions } from "@voyantjs/products-react"
import { ProductTypesPage } from "@voyantjs/products-ui"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/settings/product-types")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getProductTypesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: ProductTypesRoute,
})

function ProductTypesRoute() {
  return (
    <div className="p-6">
      <ProductTypesPage />
    </div>
  )
}
