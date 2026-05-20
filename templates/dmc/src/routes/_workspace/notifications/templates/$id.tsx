import { createFileRoute } from "@tanstack/react-router"
import { NotificationTemplateDetailPage } from "@voyantjs/ui/components/notification-template-detail-page"

export const Route = createFileRoute("/_workspace/notifications/templates/$id")({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <NotificationTemplateDetailPage id={id} />
}
