import { createFileRoute } from "@tanstack/react-router"
import { getProductTagsQueryOptions } from "@voyantjs/products-react"
import { ProductTagsPage } from "@voyantjs/products-react/ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/settings/product-tags")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getProductTagsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: ProductTagsRoute,
})

function ProductTagsRoute() {
  return <ProductTagsPage />
}
