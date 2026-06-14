"use client"

import { Badge, Button } from "@voyantjs/ui/components"
import {
  Activity,
  History,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Wrench,
} from "lucide-react"
import { type ComponentType, type ReactNode, useState } from "react"
import type {
  AllocationAuditLogEntry,
  AllocationManifestBooking,
  AvailabilitySlotAssignmentRow,
} from "../index.js"

type ActivityTimelineSource = "assignment" | "audit"

interface ActivityTimelineEvent {
  id: string
  source: ActivityTimelineSource
  title: string
  description?: ReactNode
  timestamp: string
  /**
   * Active assignments expose no released timestamp — surface them as
   * "ongoing" in the meta line and sort them above released history so
   * unreleased rows aren't pinned to the bottom by a sentinel epoch.
   */
  isOngoing?: boolean
  actorId?: string | null
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  badge?: string
}

const AUDIT_ACTION_ICONS: Record<
  string,
  ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  "resource.create": Plus,
  "resource.update": Pencil,
  "resource.delete": Trash2,
  "traveler.assign": UserPlus,
  "traveler.unassign": UserMinus,
  "resources.materialize": Sparkles,
  "auto-allocate": Sparkles,
}

function humanizeAction(action: string, labels: Record<string, string>): string {
  return labels[action] ?? action.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ActivityTimeline({
  assignments,
  auditEntries,
  resourceById,
  bookingById,
  travelerById,
  formatDateTime: formatDateTimeFn,
  i18n,
}: {
  assignments: AvailabilitySlotAssignmentRow[]
  auditEntries: AllocationAuditLogEntry[]
  resourceById: Map<string, { id: string; name: string }>
  bookingById: Map<string, AllocationManifestBooking>
  travelerById: Map<string, { fullName: string; bookingNumber: string; bookingId: string }>
  formatDateTime: (value: string | Date) => string
  i18n: {
    title: string
    empty: string
    filterAll: string
    filterAudit: string
    filterAssignments: string
    byActor: string
    unassignedResource: string
    bookingLabel: string
    auditActionLabels: Record<string, string>
    ongoing: string
    noValue: string
  }
}) {
  const [filter, setFilter] = useState<ActivityTimelineSource | "all">("all")
  const resourceLabel = (id: string | null | undefined) =>
    (id ? resourceById.get(id)?.name : null) ?? id ?? i18n.unassignedResource

  const events: ActivityTimelineEvent[] = []
  const nowIso = new Date().toISOString()
  for (const assignment of assignments) {
    const resource = resourceLabel(assignment.resourceId)
    const booking = bookingById.get(assignment.bookingId ?? "")
    // Active assignments don't carry a released timestamp. Sort them
    // alongside current activity using `now`, and flag the entry so
    // the row meta line renders "ongoing" instead of formatting the
    // sentinel time.
    const isOngoing = assignment.releasedAt == null
    events.push({
      id: `assignment:${assignment.id}`,
      source: "assignment",
      icon: Wrench,
      title: resource,
      badge: assignment.status,
      description: (
        <span>
          {i18n.bookingLabel}: {booking?.bookingNumber ?? assignment.bookingId ?? i18n.noValue}
          {assignment.notes ? ` · ${assignment.notes}` : null}
        </span>
      ),
      timestamp: assignment.releasedAt ?? nowIso,
      isOngoing,
      actorId: assignment.assignedBy,
    })
  }
  for (const entry of auditEntries) {
    const resource = entry.resourceId ? resourceLabel(entry.resourceId) : null
    const traveler = entry.travelerId ? travelerById.get(entry.travelerId) : null
    const detailParts: string[] = []
    if (traveler) detailParts.push(traveler.fullName)
    if (resource) detailParts.push(resource)
    events.push({
      id: `audit:${entry.id}`,
      source: "audit",
      icon: AUDIT_ACTION_ICONS[entry.action] ?? History,
      title: humanizeAction(entry.action, i18n.auditActionLabels),
      description: detailParts.length > 0 ? detailParts.join(" → ") : null,
      timestamp: entry.createdAt,
      actorId: entry.actorId,
    })
  }
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const visible = filter === "all" ? events : events.filter((e) => e.source === filter)
  const hasAssignments = assignments.length > 0
  const hasAudit = auditEntries.length > 0
  const filters: Array<{ id: ActivityTimelineSource | "all"; label: string; show: boolean }> = [
    { id: "all", label: i18n.filterAll, show: true },
    { id: "assignment", label: i18n.filterAssignments, show: hasAssignments },
    { id: "audit", label: i18n.filterAudit, show: hasAudit },
  ]

  return (
    <div data-slot="slot-activity-timeline" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {i18n.title}
        </h2>
        {events.length > 0 && hasAssignments && hasAudit ? (
          <div className="flex flex-wrap items-center gap-1">
            {filters
              .filter((f) => f.show)
              .map((f) => (
                <Button
                  key={f.id}
                  variant={filter === f.id ? "default" : "ghost"}
                  size="sm"
                  className="h-7 capitalize"
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border bg-background p-6 text-center">
          <p className="text-sm text-muted-foreground">{i18n.empty}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((event) => (
            <ActivityTimelineItem
              key={event.id}
              event={event}
              formatDateTime={formatDateTimeFn}
              byActor={i18n.byActor}
              ongoingLabel={i18n.ongoing}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityTimelineItem({
  event,
  formatDateTime: formatDateTimeFn,
  byActor,
  ongoingLabel,
}: {
  event: ActivityTimelineEvent
  formatDateTime: (value: string | Date) => string
  byActor: string
  ongoingLabel: string
}) {
  const Icon = event.icon
  const timestamp = event.isOngoing ? ongoingLabel : formatDateTimeFn(event.timestamp)
  const actor = event.actorId && event.actorId !== "system" ? event.actorId : null
  const meta = actor
    ? byActor.replace("{actor}", actor).replace("{timestamp}", timestamp)
    : timestamp

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden={true} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium capitalize">{event.title}</p>
          {event.badge ? (
            <Badge variant="outline" className="text-xs capitalize">
              {event.badge}
            </Badge>
          ) : null}
        </div>
        {event.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
        ) : null}
        <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  )
}
