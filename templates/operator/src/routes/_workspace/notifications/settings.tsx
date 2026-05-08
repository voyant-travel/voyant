import { createFileRoute } from "@tanstack/react-router"
import { NotificationSettingsForm } from "@voyantjs/notifications-ui"

export const Route = createFileRoute("/_workspace/notifications/settings")({
  component: NotificationSettingsPage,
})

function NotificationSettingsPage() {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Notification settings</h1>
        <p className="text-sm text-muted-foreground">
          Tenant-wide quiet hours, blackout dates, recipient rate limits, and suppression window.
        </p>
      </div>
      <NotificationSettingsForm />
    </div>
  )
}
