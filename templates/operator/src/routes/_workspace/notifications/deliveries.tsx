import { createFileRoute } from "@tanstack/react-router"
import { NotificationDeliveriesPage } from "@voyantjs/ui/components/notification-deliveries-page"

export const Route = createFileRoute("/_workspace/notifications/deliveries")({
  component: NotificationDeliveriesPage,
})
