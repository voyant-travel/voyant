import { createFileRoute } from "@tanstack/react-router"
import { TaxesPage } from "@voyantjs/finance-react/ui"

export const Route = createFileRoute("/_workspace/settings/taxes")({
  component: TaxesPage,
})
