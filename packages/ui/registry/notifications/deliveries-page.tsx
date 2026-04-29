"use client"

import { useNotificationDeliveries } from "@voyantjs/notifications-react"
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

export function NotificationDeliveriesPage() {
  const { formatDateTime } = useRegistryNotificationsI18nOrDefault()
  const messages = useRegistryNotificationsMessagesOrDefault()
  const pageMessages = messages.deliveriesPage
  const [channel, setChannel] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const { data, isPending } = useNotificationDeliveries({ channel, status, limit: 50, offset: 0 })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
        <p className="text-sm text-muted-foreground">{pageMessages.description}</p>
      </div>

      <div className="flex items-center gap-3">
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
            <SelectItem value="pending">{messages.common.deliveryStatusLabels.pending}</SelectItem>
            <SelectItem value="sent">{messages.common.deliveryStatusLabels.sent}</SelectItem>
            <SelectItem value="failed">{messages.common.deliveryStatusLabels.failed}</SelectItem>
            <SelectItem value="cancelled">
              {messages.common.deliveryStatusLabels.cancelled}
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
                <th className="px-4 py-3">{pageMessages.columns.to}</th>
                <th className="px-4 py-3">{pageMessages.columns.template}</th>
                <th className="px-4 py-3">{pageMessages.columns.channel}</th>
                <th className="px-4 py-3">{pageMessages.columns.provider}</th>
                <th className="px-4 py-3">{pageMessages.columns.status}</th>
                <th className="px-4 py-3">{pageMessages.columns.created}</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((delivery) => (
                <tr key={delivery.id} className="border-t">
                  <td className="px-4 py-3">
                    <div>{delivery.toAddress}</div>
                    {delivery.subject ? (
                      <div className="text-xs text-muted-foreground">{delivery.subject}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {delivery.templateSlug ?? pageMessages.direct}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {messages.common.channelLabels[delivery.channel]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{delivery.provider}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        delivery.status === "sent"
                          ? "default"
                          : delivery.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {messages.common.deliveryStatusLabels[delivery.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{formatDateTime(delivery.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
