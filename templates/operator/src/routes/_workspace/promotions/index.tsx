import { createFileRoute } from "@tanstack/react-router"
import { VoyantPromotionsProvider } from "@voyantjs/promotions-react"
import { loadPromotionsPage, PromotionsPage } from "@voyantjs/promotions-ui"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/promotions/")({
  ssr: "data-only",
  // Pass `fetcher: operatorFetcher` — otherwise loadPromotionsPage falls back
  // to defaultFetcher inside @voyantjs/promotions-react, which cannot forward
  // the request cookie on SSR and 401s on direct loads.
  loader: ({ context }) =>
    loadPromotionsPage(context.queryClient, { baseUrl: getApiUrl(), fetcher: operatorFetcher }),
  component: PromotionsRoute,
})

function PromotionsRoute() {
  return (
    <VoyantPromotionsProvider baseUrl={getApiUrl()} fetcher={operatorFetcher}>
      <PromotionsPage />
    </VoyantPromotionsProvider>
  )
}
