import { createFileRoute } from "@tanstack/react-router"
import { ApiTokensPage } from "@voyantjs/auth-react/ui"

export const Route = createFileRoute("/_workspace/settings/api-tokens")({
  component: ApiTokensSettingsPage,
})

function ApiTokensSettingsPage() {
  return <ApiTokensPage />
}
