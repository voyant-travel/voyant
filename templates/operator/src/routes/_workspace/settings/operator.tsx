import { createFileRoute } from "@tanstack/react-router"

import { OperatorSettingsPage } from "@/components/voyant/settings/operator-settings-page"

export const Route = createFileRoute("/_workspace/settings/operator")({
  component: OperatorSettingsPage,
})
