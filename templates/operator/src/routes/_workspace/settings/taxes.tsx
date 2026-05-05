import { createFileRoute } from "@tanstack/react-router"

import { TaxesPage } from "@/components/voyant/settings/taxes-page"

export const Route = createFileRoute("/_workspace/settings/taxes")({
  component: TaxesPage,
})
