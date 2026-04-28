import { type ActivityRecord, useActivities } from "@voyantjs/crm-react"
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
} from "@voyantjs/ui/components"
import { Loader2, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { CreateActivityDialog } from "./create-activity-dialog"

const ACTIVITY_TYPE_OPTIONS = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
  { value: "follow_up", label: "Follow-up" },
] as const

const ACTIVITY_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatRelative(value: string): string {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days < 1) return "today"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function ActivitiesPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isPending } = useActivities({
    type: typeFilter === "all" ? undefined : typeFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
  })

  const activities = data?.data ?? []

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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
          <p className="text-sm text-muted-foreground">
            Calls, emails, meetings, tasks, and follow-ups across your CRM.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" />
          New activity
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value ?? "all")}>
          <SelectTrigger className="w-[180px] text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ACTIVITY_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="w-[180px] text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ACTIVITY_STATUS_OPTIONS.map((option) => (
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
          No activities match your filters.
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([day, rows]) => (
            <Card key={day}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {formatDate(rows[0]?.createdAt ?? null)} ({rows.length})
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
                              {activity.type}
                            </Badge>
                            <Badge variant="secondary" className="capitalize">
                              {activity.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(activity.createdAt)}
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
