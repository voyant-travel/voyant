import { createFileRoute } from "@tanstack/react-router"
import { NotificationTemplatesHost } from "@voyantjs/notifications-react/admin"

export const Route = createFileRoute("/_workspace/notifications/templates/")({
  component: NotificationTemplatesHost,
})
