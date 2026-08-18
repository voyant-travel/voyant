"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components"
import { Badge } from "@voyant-travel/ui/components/badge"
import { useNotificationChannelAccounts } from "../hooks/index.js"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"

export function ChannelAccountsList() {
  const messages = useNotificationsUiMessagesOrDefault()
  const { data: accounts, isLoading } = useNotificationChannelAccounts()
  const copy = messages.settings.channelAccounts
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">{messages.common.loading}</p>}
        {!isLoading && accounts?.length === 0 && (
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
        )}
        {accounts?.map((account) => (
          <div key={account.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{account.displayName}</span>
              <Badge variant="outline">{account.channel}</Badge>
              <Badge variant={account.health === "healthy" ? "default" : "secondary"}>
                {account.health}
              </Badge>
              <Badge variant="outline">{account.lifecycle}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{account.displayAddress}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {account.inboundCapable && <span>{copy.inbound}</span>}
              {account.outboundCapable && <span>{copy.outbound}</span>}
              {account.inboundIdentity === "ambiguous" && <span>{copy.ambiguousInbound}</span>}
              <span>{account.attachmentsCapable ? copy.attachments : copy.noAttachments}</span>
              {account.allowedPurposes.length > 0 && (
                <span>
                  {copy.purposes}: {account.allowedPurposes.join(", ")}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
