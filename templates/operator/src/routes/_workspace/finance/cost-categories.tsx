import { createFileRoute } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { CostCategoriesPage } from "@voyantjs/finance-ui"

export const Route = createFileRoute("/_workspace/finance/cost-categories")({
  component: CostCategoriesRoute,
})

function CostCategoriesRoute() {
  useAdminBreadcrumbs([{ label: "Cost categories" }])
  return <CostCategoriesPage />
}
