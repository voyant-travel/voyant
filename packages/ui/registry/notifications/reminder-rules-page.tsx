"use client"

import {
  type NotificationReminderRuleRecord,
  useNotificationReminderRules,
} from "@voyantjs/notifications-react"
import { Loader2, Pencil, Plus, Search } from "lucide-react"
import { useState } from "react"

import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { useRegistryNotificationsMessagesOrDefault } from "./i18n"
import { NotificationReminderRuleDialog } from "./reminder-rule-dialog"

export function NotificationReminderRulesPage() {
  const messages = useRegistryNotificationsMessagesOrDefault()
  const pageMessages = messages.reminderRulesPage
  const [search, setSearch] = useState("")
  const [channel, setChannel] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [targetType, setTargetType] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<NotificationReminderRuleRecord | undefined>()
  const { data, isPending, refetch } = useNotificationReminderRules({
    search,
    channel,
    status,
    targetType,
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
          <p className="text-sm text-muted-foreground">{pageMessages.description}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {pageMessages.add}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={pageMessages.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={targetType} onValueChange={setTargetType}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder={pageMessages.filters.target} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{pageMessages.filters.targetAll}</SelectItem>
            <SelectItem value="booking_payment_schedule">
              {messages.common.targetTypeLabels.booking_payment_schedule}
            </SelectItem>
            <SelectItem value="invoice">{messages.common.targetTypeLabels.invoice}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={pageMessages.filters.channel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{pageMessages.filters.channelAll}</SelectItem>
            <SelectItem value="email">{messages.common.channelLabels.email}</SelectItem>
            <SelectItem value="sms">{messages.common.channelLabels.sms}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={pageMessages.filters.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{pageMessages.filters.statusAll}</SelectItem>
            <SelectItem value="draft">{messages.common.templateStatusLabels.draft}</SelectItem>
            <SelectItem value="active">{messages.common.templateStatusLabels.active}</SelectItem>
            <SelectItem value="archived">
              {messages.common.templateStatusLabels.archived}
            </SelectItem>
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
          <p className="text-sm text-muted-foreground">{pageMessages.empty}</p>
        </div>
      ) : null}

      {!isPending && data?.data && data.data.length > 0 ? (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{pageMessages.columns.rule}</th>
                <th className="px-4 py-3">{pageMessages.columns.target}</th>
                <th className="px-4 py-3">{pageMessages.columns.channel}</th>
                <th className="px-4 py-3">{pageMessages.columns.provider}</th>
                <th className="px-4 py-3">{pageMessages.columns.offset}</th>
                <th className="px-4 py-3">{pageMessages.columns.status}</th>
                <th className="px-4 py-3 text-right">{pageMessages.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((rule) => (
                <tr key={rule.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{rule.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{rule.slug}</div>
                  </td>
                  <td className="px-4 py-3">{messages.common.targetTypeLabels[rule.targetType]}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{messages.common.channelLabels[rule.channel]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {messages.common.providerLabels[rule.provider ?? "automatic"]}
                  </td>
                  <td className="px-4 py-3">
                    {rule.relativeDaysFromDueDate} {pageMessages.daysSuffix}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={rule.status === "active" ? "default" : "secondary"}>
                      {messages.common.templateStatusLabels[rule.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
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
