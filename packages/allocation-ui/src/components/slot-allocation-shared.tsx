"use client"

import type {
  AllocationAuditLogEntry,
  AllocationManifestTraveler,
  AllocationResource,
} from "@voyantjs/availability-react"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Accessibility, CircleAlert, Crown, History, UtensilsCrossed } from "lucide-react"
import type { ReactNode } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import { flagString, type ValidationIssue } from "./slot-allocation-model.js"

/**
 * Passive grouping container used by the unallocated column and other
 * card-shaped sections. Used to be a drop target during the drag-and-
 * drop era; switched to click-to-allocate, so it's now a plain layout
 * primitive. Kept as a named export so render-prop consumers can
 * compose new sections without re-exporting Card pieces themselves.
 */
export function AllocationColumn({
  id,
  icon,
  title,
  description,
  count,
  capacity,
  action,
  children,
}: {
  id: string
  icon: ReactNode
  title: string
  description: string
  count: number
  capacity: number
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card id={id} className="min-h-40">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={count > capacity ? "destructive" : "outline"}>
            {count}/{capacity}
          </Badge>
          {action}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  )
}

export function TravelerTile({
  traveler,
  sharingGroupLabel,
  renderActions,
}: {
  traveler: AllocationManifestTraveler
  sharingGroupLabel?: string | null
  renderActions?: (traveler: AllocationManifestTraveler) => ReactNode
}) {
  const messages = useAllocationUiMessagesOrDefault()

  return (
    <div className="group flex items-start justify-between gap-3 rounded-md border bg-background p-3 text-sm shadow-sm">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {traveler.isLeadTraveler ? (
            <Crown className="size-3.5 text-amber-500" aria-label={messages.lead} />
          ) : null}
          <span className="truncate font-medium">{traveler.fullName}</span>
          {traveler.sharingGroupId ? (
            <Badge variant="secondary" className="max-w-full truncate text-[10px]">
              {sharingGroupLabel ?? messages.sharingGroup}
            </Badge>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{traveler.bookingNumber}</span>
          {traveler.roomTypeId ? <span>{traveler.roomTypeId}</span> : null}
          {traveler.bedPreference ? <span>{traveler.bedPreference}</span> : null}
          {traveler.hasAccessibilityNeeds ? (
            <Accessibility className="size-3.5" aria-label={messages.accessibility} />
          ) : null}
          {traveler.hasDietaryRequirements ? (
            <UtensilsCrossed className="size-3.5" aria-label={messages.dietary} />
          ) : null}
        </div>
      </div>
      {renderActions ? <div className="shrink-0">{renderActions(traveler)}</div> : null}
    </div>
  )
}

export function ValidationSummary({
  issues,
  resources,
  unallocatedCount,
}: {
  issues: ValidationIssue[]
  resources: AllocationResource[]
  unallocatedCount: number
}) {
  const messages = useAllocationUiMessagesOrDefault()

  if (issues.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <Badge variant="outline">{messages.validationClear}</Badge>
        <span>
          {resources.length} {messages.resources.toLowerCase()} · {unallocatedCount}{" "}
          {messages.unallocated.toLowerCase()}
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="flex items-center gap-2 font-medium">
        <CircleAlert className="size-4" aria-hidden="true" />
        {messages.validationTitle}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {issues.map((issue) => (
          <Badge
            key={issue.id}
            variant="outline"
            className="border-amber-300 bg-background/70 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100"
          >
            {issue.label}
          </Badge>
        ))}
      </div>
    </div>
  )
}

export function ResourceFlagBadges({ resource }: { resource: AllocationResource }) {
  const messages = useAllocationUiMessagesOrDefault()
  const flags = resource.flags
  const badges: string[] = []

  if (flags.accessibilityNeeded === true) badges.push(messages.accessibility)
  if (flags.smokingAllowed === true) badges.push(messages.smokingAllowed)
  if (typeof flags.note === "string" && flags.note.trim()) badges.push(flags.note.trim())

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <Badge key={badge} variant="outline" className="max-w-full truncate text-[10px]">
          {badge}
        </Badge>
      ))}
    </div>
  )
}

export function SeatPositionBadge({ seat }: { seat: AllocationResource }) {
  const messages = useAllocationUiMessagesOrDefault()
  const position = flagString(seat.flags.position)
  if (!position) return null

  const label =
    position === "window"
      ? messages.windowSeat
      : position === "aisle"
        ? messages.aisleSeat
        : position === "middle"
          ? messages.middleSeat
          : position

  return (
    <Badge variant="outline" className="text-[10px]">
      {label}
    </Badge>
  )
}

export function AuditLogCard({ entries }: { entries: AllocationAuditLogEntry[] }) {
  const messages = useAllocationUiMessagesOrDefault()
  if (entries.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-3">
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
        <div>
          <CardTitle className="text-base">{messages.auditLog}</CardTitle>
          <p className="text-xs text-muted-foreground">{messages.auditLogDescription}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {entries.slice(0, 8).map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString()}
            </span>
            <Badge variant="outline">{messages.auditActions[entry.action] ?? entry.action}</Badge>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {entryDetail(entry)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function entryDetail(entry: AllocationAuditLogEntry) {
  const after = entry.after ?? {}
  if (entry.action === "auto-allocate") {
    return `${after.kind ?? ""}: ${after.assigned ?? 0} assigned, ${after.skipped ?? 0} skipped`
  }
  if (entry.action === "resources.materialize") {
    return `${after.kind ?? ""}: ${after.created ?? 0} created`
  }
  if (entry.action.startsWith("resource.")) {
    return [after.kind, after.label, after.capacity ? `capacity ${after.capacity}` : null]
      .filter(Boolean)
      .join(" · ")
  }
  if (entry.action.startsWith("traveler.")) {
    return [after.kind, after.resourceId, after.sharingGroupId].filter(Boolean).join(" · ")
  }
  if (entry.action.startsWith("sharing-group.")) {
    return [after.sharingGroupId, after.label].filter(Boolean).join(" · ")
  }
  return JSON.stringify(after)
}
