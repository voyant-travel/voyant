import { createFileRoute } from "@tanstack/react-router"
import { RemindersPreviewList } from "@voyantjs/notifications-ui"

export const Route = createFileRoute("/_workspace/notifications/preview")({
  component: RemindersPreviewPage,
})

function RemindersPreviewPage() {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Reminders preview</h1>
        <p className="text-sm text-muted-foreground">
          What would fire on a chosen date with the active reminder sequences. Read-only.
        </p>
      </div>
      <RemindersPreviewList />
    </div>
  )
}
