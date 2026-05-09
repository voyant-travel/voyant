import { createFileRoute } from "@tanstack/react-router"
import { loadPromotionsPage, PromotionsPage } from "@voyantjs/promotions-ui"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/promotions/")({
  loader: ({ context }) => loadPromotionsPage(context.queryClient, { baseUrl: getApiUrl() }),
  component: PromotionsPage,
})
