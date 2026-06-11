import { createFileRoute } from "@tanstack/react-router"
import { NotificationReminderRuleDetailHost } from "@voyantjs/notifications-react/admin"

export const Route = createFileRoute("/_workspace/notifications/reminder-rules/$id")({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <NotificationReminderRuleDetailHost id={id} />
}
