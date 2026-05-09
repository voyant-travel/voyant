import { createFileRoute } from "@tanstack/react-router"
import { loadPromotionsPage, PromotionsPage } from "@/components/voyant/promotions/promotions-page"

export const Route = createFileRoute("/_workspace/promotions/")({
  loader: ({ context }) => loadPromotionsPage(context.queryClient),
  component: PromotionsPage,
})
