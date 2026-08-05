"use client"

import { Badge, Button, Card, CardContent } from "@voyant-travel/ui/components"
import { Switch } from "@voyant-travel/ui/components/switch"
import { Loader2, RotateCcw } from "lucide-react"
import {
  useStaffAlertPreferenceMutation,
  useStaffAlertPreferences,
} from "../hooks/use-staff-alerts.js"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import type { StaffAlertPreferenceRecord } from "../schemas.js"

type GroupKey = "bookings" | "finance" | "sales" | "legal"
const GROUP_ORDER: GroupKey[] = ["sales", "bookings", "finance", "legal"]

export function MyNotificationsForm() {
  const messages = useNotificationsUiMessagesOrDefault()
  const copy = messages.staffAlerts
  const { data: preferences, isLoading } = useStaffAlertPreferences()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {copy.loading}
      </div>
    )
  }

  if (!preferences || preferences.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.empty}</p>
  }

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    rows: preferences.filter((row) => row.group === group),
  })).filter(({ rows }) => rows.length > 0)

  return (
    <div className="space-y-8">
      {grouped.map(({ group, rows }) => (
        <section key={group} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{copy.groups[group]}</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {rows.map((row) => (
                <PreferenceRow key={row.eventKey} row={row} />
              ))}
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  )
}

function PreferenceRow({ row }: { row: StaffAlertPreferenceRecord }) {
  const messages = useNotificationsUiMessagesOrDefault()
  const copy = messages.staffAlerts
  const mutation = useStaffAlertPreferenceMutation()

  const label = copy.alerts[row.eventKey]
  const title = label?.title ?? row.eventKey
  const description = label?.description ?? row.eventType

  // The whole point of this screen: "off because an admin disabled it" must not
  // look like "off because I chose that". A deployment-disabled alert is not
  // togglable, and says why.
  const lockedByAdmin = !row.deploymentEnabled
  const isOverridden = row.override !== null

  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {lockedByAdmin ? (
            <Badge variant="outline">{copy.state.disabledByAdmin}</Badge>
          ) : isOverridden ? (
            <Badge variant="secondary">{copy.state.overridden}</Badge>
          ) : (
            <Badge variant="outline">
              {row.enabled ? copy.state.inheritedOn : copy.state.inheritedOff}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {lockedByAdmin ? copy.state.disabledByAdminDesc : description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isOverridden && !lockedByAdmin ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => mutation.mutate({ eventKey: row.eventKey, enabled: null })}
            disabled={mutation.isPending}
          >
            <RotateCcw className="size-3.5" />
            {copy.state.resetToDefault}
          </Button>
        ) : null}
        <Switch
          checked={row.enabled}
          disabled={lockedByAdmin || mutation.isPending}
          onCheckedChange={(checked) =>
            mutation.mutate({ eventKey: row.eventKey, enabled: checked })
          }
          aria-label={title}
        />
      </div>
    </div>
  )
}
