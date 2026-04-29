"use client"

import { useNotificationReminderRuns } from "@voyantjs/notifications-react"
import { Loader2 } from "lucide-react"
import { useState } from "react"

import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import {
  useRegistryNotificationsI18nOrDefault,
  useRegistryNotificationsMessagesOrDefault,
} from "./i18n"

export function NotificationReminderRunsPage() {
  const { formatDateTime } = useRegistryNotificationsI18nOrDefault()
  const messages = useRegistryNotificationsMessagesOrDefault()
  const pageMessages = messages.reminderRunsPage
  const [status, setStatus] = useState<string>("all")
  const { data, isPending } = useNotificationReminderRuns({ status, limit: 50, offset: 0 })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
        <p className="text-sm text-muted-foreground">{pageMessages.description}</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={pageMessages.filters.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{pageMessages.filters.statusAll}</SelectItem>
            <SelectItem value="queued">{messages.common.reminderRunStatusLabels.queued}</SelectItem>
            <SelectItem value="processing">
              {messages.common.reminderRunStatusLabels.processing}
            </SelectItem>
            <SelectItem value="sent">{messages.common.reminderRunStatusLabels.sent}</SelectItem>
            <SelectItem value="skipped">
              {messages.common.reminderRunStatusLabels.skipped}
            </SelectItem>
            <SelectItem value="failed">{messages.common.reminderRunStatusLabels.failed}</SelectItem>
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
                <th className="px-4 py-3">{pageMessages.columns.recipient}</th>
                <th className="px-4 py-3">{pageMessages.columns.status}</th>
                <th className="px-4 py-3">{pageMessages.columns.processed}</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((run) => (
                <tr key={run.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{run.reminderRule.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {run.reminderRule.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{messages.common.targetTypeLabels[run.targetType]}</div>
                    <div className="font-mono text-xs text-muted-foreground">{run.targetId}</div>
                  </td>
                  <td className="px-4 py-3">{run.recipient ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        run.status === "sent"
                          ? "default"
                          : run.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {messages.common.reminderRunStatusLabels[run.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{formatDateTime(run.processedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
