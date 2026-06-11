import { createFileRoute } from "@tanstack/react-router"
import { CostCategoriesPage } from "@voyantjs/finance-react/ui"

export const Route = createFileRoute("/_workspace/settings/cost-categories")({
  component: CostCategoriesPage,
})
