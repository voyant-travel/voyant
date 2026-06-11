import { createFileRoute } from "@tanstack/react-router"
import { NotificationTemplatesHost } from "@voyantjs/notifications-ui/admin"

export const Route = createFileRoute("/_workspace/notifications/templates/")({
  component: NotificationTemplatesHost,
})
