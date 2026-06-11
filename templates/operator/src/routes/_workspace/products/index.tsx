import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { getProductsQueryOptions } from "@voyantjs/products-react"
import { ProductsPage } from "@voyantjs/products-react/ui"
import { ProductsListSkeleton } from "@/components/voyant/products/products-list-skeleton"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// `data-only`: loader runs on the server (cookies forwarded via
// `operatorFetcher`'s server branch), but the component renders on the
// client during hydration. Step 1 of the SSR rollout — avoids hydration
// risk from the admin chrome while still cutting the client waterfall on
// first paint.
export const Route = createFileRoute("/_workspace/products/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getProductsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  pendingComponent: ProductsListSkeleton,
  component: ProductsRoute,
})

function ProductsRoute() {
  const navigate = useNavigate()

  return (
    <ProductsPage
      onProductOpen={(product) =>
        void navigate({ to: "/products/$id", params: { id: product.id } })
      }
    />
  )
}
