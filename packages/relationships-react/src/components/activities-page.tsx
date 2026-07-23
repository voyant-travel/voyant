import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { Loader2, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useCrmUiI18nOrDefault } from "../i18n/index.js"
import type { CrmActivityStatus, CrmActivityType } from "../i18n/messages.js"
import { type ActivityRecord, useActivities } from "../index.js"
import { CreateActivityDialog } from "./create-activity-dialog.js"

function formatDate(
  value: string | null | undefined,
  i18n: ReturnType<typeof useCrmUiI18nOrDefault>,
): string {
  if (!value) return i18n.messages.common.none
  return i18n.formatDate(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatRelative(
  value: string,
  messages: ReturnType<typeof useCrmUiI18nOrDefault>["messages"],
): string {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days < 1) return messages.common.today
  if (days < 7) return messages.common.relativeTime.daysAgo.replace("{count}", String(days))
  if (days < 30) {
    return messages.common.relativeTime.weeksAgo.replace("{count}", String(Math.floor(days / 7)))
  }
  if (days < 365) {
    return messages.common.relativeTime.monthsAgo.replace("{count}", String(Math.floor(days / 30)))
  }
  return messages.common.relativeTime.yearsAgo.replace("{count}", String(Math.floor(days / 365)))
}

export function ActivitiesPage() {
  const i18n = useCrmUiI18nOrDefault()
  const { messages } = i18n
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isPending } = useActivities({
    type: typeFilter === "all" ? undefined : typeFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
  })

  const activities = data?.data ?? []
  const activityTypeOptions = Object.entries(messages.common.activityTypeLabels).map(
    ([value, label]) => ({
      value,
      label,
    }),
  )
  const activityStatusOptions = Object.entries(messages.common.activityStatusLabels).map(
    ([value, label]) => ({
      value,
      label,
    }),
  )

  const grouped = useMemo(() => {
    const groups = new Map<string, ActivityRecord[]>()
    for (const activity of activities) {
      const day = new Date(activity.createdAt).toDateString()
      const bucket = groups.get(day)
      if (bucket) bucket.push(activity)
      else groups.set(day, [activity])
    }
    return Array.from(groups.entries())
  }, [activities])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.activitiesPage.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.activitiesPage.description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" />
          {messages.activitiesPage.create}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value ?? "all")}>
          <SelectTrigger className="w-[180px] text-sm">
            <SelectValue placeholder={messages.activitiesPage.filters.type} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{messages.activitiesPage.filters.allTypes}</SelectItem>
            {activityTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="w-[180px] text-sm">
            <SelectValue placeholder={messages.activitiesPage.filters.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{messages.activitiesPage.filters.allStatuses}</SelectItem>
            {activityStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activities.length === 0 ? (
        <Card className="flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
          {messages.activitiesPage.empty}
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([day, rows]) => (
            <Card key={day}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {formatDate(rows[0]?.createdAt ?? null, i18n)} ({rows.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {rows.map((activity) => (
                    <li key={activity.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{activity.subject}</p>
                          {activity.description ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {activity.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex gap-1">
                            <Badge variant="outline" className="capitalize">
                              {messages.common.activityTypeLabels[
                                activity.type as CrmActivityType
                              ] ?? activity.type}
                            </Badge>
                            <Badge variant="secondary" className="capitalize">
                              {messages.common.activityStatusLabels[
                                activity.status as CrmActivityStatus
                              ] ?? activity.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(activity.createdAt, messages)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
