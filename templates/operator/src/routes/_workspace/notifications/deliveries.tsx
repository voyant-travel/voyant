import { createFileRoute } from "@tanstack/react-router"
import { NotificationDeliveriesHost } from "@voyantjs/notifications-react/admin"

export const Route = createFileRoute("/_workspace/notifications/deliveries")({
  component: NotificationDeliveriesHost,
})
