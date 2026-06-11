import { createFileRoute } from "@tanstack/react-router"
import { NotificationDeliveriesHost } from "@voyantjs/notifications-ui/admin"

export const Route = createFileRoute("/_workspace/notifications/deliveries")({
  component: NotificationDeliveriesHost,
})
