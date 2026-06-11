import { createFileRoute } from "@tanstack/react-router"
import { NotificationReminderRulesHost } from "@voyantjs/notifications-ui/admin"

export const Route = createFileRoute("/_workspace/notifications/reminder-rules")({
  component: NotificationReminderRulesHost,
})
