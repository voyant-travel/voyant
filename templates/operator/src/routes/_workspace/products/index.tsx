import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { defaultFetcher, getProductsQueryOptions } from "@voyantjs/products-react"
import { ProductsPage } from "@voyantjs/products-ui"
import { ProductsListSkeleton } from "@/components/voyant/products/products-list-skeleton"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/products/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getProductsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
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
