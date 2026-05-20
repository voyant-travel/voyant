import { createFileRoute } from "@tanstack/react-router"
import { NotificationReminderRunsPage } from "@voyantjs/ui/components/notification-reminder-runs-page"

export const Route = createFileRoute("/_workspace/notifications/reminder-runs")({
  component: NotificationReminderRunsPage,
})
