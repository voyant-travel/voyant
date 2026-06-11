import { createFileRoute } from "@tanstack/react-router"
import { RemindersPreviewHost } from "@voyantjs/notifications-ui/admin"

export const Route = createFileRoute("/_workspace/notifications/preview")({
  component: RemindersPreviewHost,
})
