"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@voyant-travel/ui/components"
import { Switch } from "@voyant-travel/ui/components/switch"
import { Loader2, Plus, Send, Trash2 } from "lucide-react"
import { useState } from "react"
import {
  useStaffAlertSettingMutation,
  useStaffAlertSettings,
  useStaffAlertTestMutation,
} from "../hooks/use-staff-alerts.js"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import type { StaffAlertSettingRecord } from "../schemas.js"

const ROLE_OPTIONS = ["owner", "admin", "member"] as const

type GroupKey = "bookings" | "finance" | "sales" | "legal"
const GROUP_ORDER: GroupKey[] = ["sales", "bookings", "finance", "legal"]

export function StaffAlertsForm() {
  const messages = useNotificationsUiMessagesOrDefault()
  const copy = messages.staffAlerts
  const { data: alerts, isLoading } = useStaffAlertSettings()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {copy.loading}
      </div>
    )
  }

  if (!alerts || alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.empty}</p>
  }

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    rows: alerts.filter((alert) => alert.group === group),
  })).filter(({ rows }) => rows.length > 0)

  return (
    <div className="space-y-8">
      {grouped.map(({ group, rows }) => (
        <section key={group} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{copy.groups[group]}</h2>
          <div className="space-y-3">
            {rows.map((alert) => (
              <StaffAlertCard key={alert.eventKey} alert={alert} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function StaffAlertCard({ alert }: { alert: StaffAlertSettingRecord }) {
  const messages = useNotificationsUiMessagesOrDefault()
  const copy = messages.staffAlerts
  const mutation = useStaffAlertSettingMutation()
  const testMutation = useStaffAlertTestMutation()
  const [newAddress, setNewAddress] = useState("")
  const [testFeedback, setTestFeedback] = useState<string | null>(null)

  const label = copy.alerts[alert.eventKey]
  const title = label?.title ?? alert.eventKey
  const description = label?.description ?? alert.eventType

  // An enabled alert with no route reaches nobody. Surfacing that beats letting
  // an operator believe they switched something on.
  const hasNoRecipients =
    alert.enabled &&
    !alert.routeToAssignee &&
    alert.routeToRoles.length === 0 &&
    alert.extraAddresses.length === 0

  const save = (patch: Partial<StaffAlertSettingRecord>) => {
    mutation.mutate({
      eventKey: alert.eventKey,
      enabled: patch.enabled ?? alert.enabled,
      routeToAssignee: patch.routeToAssignee ?? alert.routeToAssignee,
      routeToRoles: patch.routeToRoles ?? alert.routeToRoles,
      extraAddresses: patch.extraAddresses ?? alert.extraAddresses,
    })
  }

  const toggleRole = (role: string) => {
    const next = alert.routeToRoles.includes(role)
      ? alert.routeToRoles.filter((entry) => entry !== role)
      : [...alert.routeToRoles, role]
    save({ routeToRoles: next })
  }

  const addAddress = () => {
    const trimmed = newAddress.trim().toLowerCase()
    if (!trimmed || alert.extraAddresses.includes(trimmed)) return
    save({ extraAddresses: [...alert.extraAddresses, trimmed] })
    setNewAddress("")
  }

  const runTest = async () => {
    setTestFeedback(null)
    const result = await testMutation.mutateAsync(alert.eventKey)
    if (result.sent && result.recipient) {
      setTestFeedback(copy.test.sent.replace("{recipient}", result.recipient))
      return
    }
    if (result.reason === "staff_alerts_not_wired") {
      setTestFeedback(copy.test.notWired)
      return
    }
    if (result.reason === "no_email_on_account") {
      setTestFeedback(copy.test.noEmail)
      return
    }
    setTestFeedback(copy.test.failed.replace("{reason}", result.reason ?? ""))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Switch
          checked={alert.enabled}
          onCheckedChange={(checked) => save({ enabled: checked })}
          aria-label={title}
        />
      </CardHeader>

      {alert.enabled ? (
        <CardContent className="space-y-5 border-t pt-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{copy.routing.assignee}</p>
                <p className="text-xs text-muted-foreground">
                  {alert.supportsAssigneeRouting
                    ? copy.routing.assigneeDesc
                    : copy.routing.assigneeUnavailable}
                </p>
              </div>
              <Switch
                checked={alert.routeToAssignee}
                // Hiding the control entirely would read as a missing feature;
                // disabling it with the reason underneath says the alert has no
                // assignment concept behind it yet.
                disabled={!alert.supportsAssigneeRouting}
                onCheckedChange={(checked) => save({ routeToAssignee: checked })}
                aria-label={copy.routing.assignee}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{copy.routing.roles}</p>
            <p className="text-xs text-muted-foreground">{copy.routing.rolesDesc}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {ROLE_OPTIONS.map((role) => {
                const active = alert.routeToRoles.includes(role)
                return (
                  <Button
                    key={role}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => toggleRole(role)}
                  >
                    {copy.roles[role]}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{copy.routing.extraAddresses}</p>
            <p className="text-xs text-muted-foreground">{copy.routing.extraAddressesDesc}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {alert.extraAddresses.map((address) => (
                <Badge key={address} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">
                  {address}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-5"
                    onClick={() =>
                      save({
                        extraAddresses: alert.extraAddresses.filter((entry) => entry !== address),
                      })
                    }
                    aria-label={`${copy.actions.save} ${address}`}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                value={newAddress}
                onChange={(event) => setNewAddress(event.target.value)}
                placeholder={copy.routing.addressPlaceholder}
                type="email"
                className="max-w-xs"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addAddress()
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addAddress}>
                <Plus className="size-4" />
                {copy.routing.addAddress}
              </Button>
            </div>
          </div>

          {hasNoRecipients ? (
            <p className="text-sm text-destructive">{copy.routing.noRecipients}</p>
          ) : null}

          <div className="flex items-center gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runTest}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {testMutation.isPending ? copy.actions.sending : copy.actions.sendTest}
            </Button>
            {testFeedback ? <p className="text-sm text-muted-foreground">{testFeedback}</p> : null}
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}
