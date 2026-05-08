import { createFileRoute, Link } from "@tanstack/react-router"
import { useNotificationReminderRule } from "@voyantjs/notifications-react"
import { StageList } from "@voyantjs/notifications-ui"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft } from "lucide-react"

export const Route = createFileRoute("/_workspace/notifications/reminder-rules/$id")({
  component: ReminderRuleDetailPage,
})

function ReminderRuleDetailPage() {
  const { id } = Route.useParams()
  const { data: rule, isLoading } = useNotificationReminderRule(id)

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/notifications/reminder-rules">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{rule?.name ?? "Reminder rule"}</h1>
            <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : rule?.slug}</p>
          </div>
        </div>
        {rule && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{rule.targetType}</Badge>
            <Badge variant="outline">{rule.channel}</Badge>
            <Badge>{rule.status}</Badge>
          </div>
        )}
      </div>

      {rule && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rule</CardTitle>
          </CardHeader>
          <CardContent className="text-sm grid grid-cols-2 gap-x-8 gap-y-2 text-muted-foreground">
            <div>
              Template slug: <span className="font-mono">{rule.templateSlug ?? "—"}</span>
            </div>
            <div>
              Template id: <span className="font-mono">{rule.templateId ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <StageList reminderRuleId={id} />
    </div>
  )
}
