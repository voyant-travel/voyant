import { createFileRoute } from "@tanstack/react-router"
import { NotificationReminderRulesPage } from "@voyantjs/ui/components/notification-reminder-rules-page"

export const Route = createFileRoute("/_workspace/notifications/reminder-rules")({
  component: NotificationReminderRulesPage,
})
