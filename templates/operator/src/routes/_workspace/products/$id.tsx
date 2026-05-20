import { createFileRoute } from "@tanstack/react-router"
import { getProductQueryOptions } from "@voyantjs/products-react"
import { ProductDetailPage } from "@/components/voyant/products/product-detail-page"
import {
  getChannelsQueryOptions,
  getProductChannelMappingsQueryOptions,
  getProductMediaQueryOptions,
  getProductRulesQueryOptions,
  getProductSlotsQueryOptions,
} from "@/components/voyant/products/product-detail-shared"
import { ProductDetailSkeleton } from "@/components/voyant/products/product-detail-skeleton"
import {
  getPricingCategoriesQueryOptions,
  getProductOptionsQueryOptions,
} from "@/components/voyant/products/product-options-shared"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Critical path only: await the product itself so the header has data and
// the loader unblocks after one round-trip. Everything else is fired as a
// background prefetch — the corresponding `useQuery` calls in the page's
// sections light up as data arrives instead of blocking the whole route
// on the slowest of ~15 nested queries. Nested option pricing rules now
// load lazily when the Pricing tab opens; the old eager prefetch chain
// was the main cause of the multi-second wait on this route.
export const Route = createFileRoute("/_workspace/products/$id")({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

    await context.queryClient.ensureQueryData(getProductQueryOptions(client, params.id))

    void context.queryClient.prefetchQuery(getProductOptionsQueryOptions(params.id))
    void context.queryClient.prefetchQuery(getProductSlotsQueryOptions(params.id))
    void context.queryClient.prefetchQuery(getProductRulesQueryOptions(params.id))
    void context.queryClient.prefetchQuery(getChannelsQueryOptions())
    void context.queryClient.prefetchQuery(getProductChannelMappingsQueryOptions(params.id))
    void context.queryClient.prefetchQuery(getProductMediaQueryOptions(params.id))
    void context.queryClient.prefetchQuery(getPricingCategoriesQueryOptions())
  },
  pendingComponent: ProductDetailSkeleton,
  component: ProductDetailRoute,
})

function ProductDetailRoute() {
  const { id } = Route.useParams()
  return <ProductDetailPage id={id} />
}
