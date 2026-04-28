import { createFileRoute } from "@tanstack/react-router"
import { NotificationDeliveriesPage } from "@voyantjs/ui/components"

export const Route = createFileRoute("/_workspace/notifications/deliveries")({
  component: NotificationDeliveriesPage,
})
