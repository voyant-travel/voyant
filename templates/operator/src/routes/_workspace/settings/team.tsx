import { createFileRoute } from "@tanstack/react-router"
import { TeamSettingsPage } from "@voyantjs/admin"

export const Route = createFileRoute("/_workspace/settings/team")({
  component: TeamSettingsPage,
})
