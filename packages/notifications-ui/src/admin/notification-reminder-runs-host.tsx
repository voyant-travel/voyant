"use client"

import {
  type UseNotificationReminderRunsOptions,
  useNotificationReminderRuns,
} from "@voyantjs/notifications-react"
import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useState } from "react"

/**
 * Packaged admin host for the reminder runs page (packaged-admin RFC
 * Phase 3). Zero-prop, read-only: filter state stays component-local and
 * there is no cross-route navigation.
 */
export function NotificationReminderRunsHost() {
  const [status, setStatus] = useState<UseNotificationReminderRunsOptions["status"] | "all">("all")
  const { data, isPending } = useNotificationReminderRuns({
    status: status === "all" ? undefined : status,
    limit: 50,
    offset: 0,
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reminder Runs</h1>
        <p className="text-sm text-muted-foreground">
          Inspect queued and processed reminder executions, linked deliveries, and failure reasons.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
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
          <p className="text-sm text-muted-foreground">No reminder runs yet.</p>
        </div>
      ) : null}

      {!isPending && data?.data && data.data.length > 0 ? (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Processed</th>
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
                    <div>{run.targetType}</div>
                    <div className="font-mono text-xs text-muted-foreground">{run.targetId}</div>
                  </td>
                  <td className="px-4 py-3">{run.recipient ?? "—"}</td>
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
                      {run.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{new Date(run.processedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
