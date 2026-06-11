import { createFileRoute } from "@tanstack/react-router"
import { NotificationReminderRunsHost } from "@voyantjs/notifications-ui/admin"

export const Route = createFileRoute("/_workspace/notifications/reminder-runs")({
  component: NotificationReminderRunsHost,
})
