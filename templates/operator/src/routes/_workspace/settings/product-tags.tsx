import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getProductTagsQueryOptions } from "@voyantjs/products-react"
import { ProductTagsPage } from "@voyantjs/products-ui"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/settings/product-tags")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getProductTagsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: ProductTagsRoute,
})

function ProductTagsRoute() {
  return (
    <div className="p-6">
      <ProductTagsPage />
    </div>
  )
}
