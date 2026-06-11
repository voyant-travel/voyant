"use client"

import { useAdminHref, useAdminNavigate } from "@voyantjs/admin"
import {
  type NotificationReminderRuleRecord,
  type UseNotificationReminderRulesOptions,
  useNotificationReminderRules,
} from "@voyantjs/notifications-react"
import {
  Badge,
  Button,
  buttonVariants,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Layers, Loader2, Pencil, Plus, Search } from "lucide-react"
import { useState } from "react"

import { NotificationReminderRuleDialog } from "./notification-reminder-rule-dialog.js"
import { DestinationLink } from "./notifications-admin-shared.js"

const reminderTargetLabels = {
  booking_confirmed: "Booking confirmed",
  booking_payment_schedule: "Booking payment schedule",
  payment_complete: "Payment complete",
  booking_cancelled_non_payment: "Booking cancelled (non-payment)",
} as const

function getReminderTargetLabel(targetType: NotificationReminderRuleRecord["targetType"]) {
  if (targetType === "invoice") return "Invoice"
  return reminderTargetLabels[targetType] ?? targetType
}

/**
 * Packaged admin host for the reminder rules list page (packaged-admin RFC
 * Phase 3). Zero-prop: list/filter state stays component-local and the
 * per-rule "Manage stages" link resolves through the
 * `notificationReminderRule.detail` semantic destination.
 */
export function NotificationReminderRulesHost() {
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const [search, setSearch] = useState("")
  const [channel, setChannel] = useState<UseNotificationReminderRulesOptions["channel"] | "all">(
    "all",
  )
  const [status, setStatus] = useState<UseNotificationReminderRulesOptions["status"] | "all">("all")
  const [targetType, setTargetType] = useState<
    UseNotificationReminderRulesOptions["targetType"] | "all"
  >("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<NotificationReminderRuleRecord | undefined>()
  const { data, isPending, refetch } = useNotificationReminderRules({
    search,
    channel: channel === "all" ? undefined : channel,
    status: status === "all" ? undefined : status,
    targetType: targetType === "all" ? undefined : targetType,
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reminder Rules</h1>
          <p className="text-sm text-muted-foreground">
            Schedule booking payment reminders and event notifications against templates and
            channels.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search rules..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={targetType} onValueChange={(value) => setTargetType(value ?? "all")}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Target" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All targets</SelectItem>
            {Object.entries(reminderTargetLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={(value) => setChannel(value ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && (!data?.data || data.data.length === 0) ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No reminder rules yet.</p>
        </div>
      ) : null}

      {!isPending && data?.data && data.data.length > 0 ? (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((rule) => (
                <tr key={rule.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{rule.name}</div>
                  </td>
                  <td className="px-4 py-3">{getReminderTargetLabel(rule.targetType)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{rule.channel}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={rule.status === "active" ? "default" : "secondary"}>
                      {rule.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DestinationLink
                        href={resolveHref("notificationReminderRule.detail", {
                          ruleId: rule.id,
                        })}
                        onNavigate={() =>
                          navigateTo("notificationReminderRule.detail", { ruleId: rule.id })
                        }
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        <Layers className="mr-2 h-4 w-4" />
                        Manage stages
                      </DestinationLink>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(rule)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <NotificationReminderRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
