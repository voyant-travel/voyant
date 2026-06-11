import { createFileRoute } from "@tanstack/react-router"
import { NotificationSettingsHost } from "@voyantjs/notifications-react/admin"

export const Route = createFileRoute("/_workspace/notifications/settings")({
  component: NotificationSettingsHost,
})
