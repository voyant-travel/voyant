import { createFileRoute } from "@tanstack/react-router"
import { NotificationTemplatesPage } from "@voyantjs/ui/components/notification-templates-page"

export const Route = createFileRoute("/_workspace/notifications/templates/")({
  component: NotificationTemplatesPage,
})
