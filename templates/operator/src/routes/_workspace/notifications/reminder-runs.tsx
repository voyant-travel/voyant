import { createFileRoute } from "@tanstack/react-router"
import { NotificationReminderRunsHost } from "@voyantjs/notifications-react/admin"

export const Route = createFileRoute("/_workspace/notifications/reminder-runs")({
  component: NotificationReminderRunsHost,
})
