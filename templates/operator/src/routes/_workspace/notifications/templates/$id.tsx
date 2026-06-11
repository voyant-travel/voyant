import { createFileRoute } from "@tanstack/react-router"
import { NotificationTemplateDetailHost } from "@voyantjs/notifications-ui/admin"

export const Route = createFileRoute("/_workspace/notifications/templates/$id")({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <NotificationTemplateDetailHost id={id} />
}
