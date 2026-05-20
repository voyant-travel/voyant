import { createFileRoute } from "@tanstack/react-router"
import { VoyantPromotionsProvider } from "@voyantjs/promotions-react"
import { loadPromotionsPage, PromotionsPage } from "@voyantjs/promotions-ui"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/promotions/")({
  ssr: "data-only",
  loader: ({ context }) => loadPromotionsPage(context.queryClient, { baseUrl: getApiUrl() }),
  component: PromotionsRoute,
})

function PromotionsRoute() {
  return (
    <VoyantPromotionsProvider baseUrl={getApiUrl()}>
      <PromotionsPage />
    </VoyantPromotionsProvider>
  )
}
