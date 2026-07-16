"use client"

import { useAdminHref, useAdminNavigate } from "@voyant-travel/admin"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components"
import { ArrowLeft } from "lucide-react"
import { StageList } from "../components/stage-list.js"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import { useNotificationReminderRule } from "../index.js"
import { DestinationLink } from "./notifications-admin-shared.js"

export interface NotificationReminderRuleDetailHostProps {
  id: string
}

/**
 * Packaged admin host for the reminder rule detail page — rule summary plus
 * the stage sequence editor (packaged-admin RFC Phase 3). Takes the rule id
 * as a prop — the host route file binds `Route.useParams()` onto it. The
 * back link resolves through the `notificationReminderRule.list` semantic
 * destination.
 */
export function NotificationReminderRuleDetailHost({
  id,
}: NotificationReminderRuleDetailHostProps) {
  const messages = useNotificationsUiMessagesOrDefault()
  const common = messages.admin.common
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const { data: rule, isLoading } = useNotificationReminderRule(id)

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DestinationLink
            href={resolveHref("notificationReminderRule.list", {})}
            onNavigate={() => navigateTo("notificationReminderRule.list", {})}
          >
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </DestinationLink>
          <div>
            <h1 className="text-2xl font-semibold">
              {rule?.name ?? messages.admin.reminderRuleDetail.fallbackTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? messages.common.loading : rule?.slug}
            </p>
          </div>
        </div>
        {rule && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{rule.targetType}</Badge>
            <Badge variant="outline">{rule.channel}</Badge>
            <Badge>{rule.status}</Badge>
          </div>
        )}
      </div>

      {rule && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{common.table.rule}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm grid grid-cols-2 gap-x-8 gap-y-2 text-muted-foreground">
            <div>
              {common.templateSlugLabel}{" "}
              <span className="font-mono">{rule.templateSlug ?? "—"}</span>
            </div>
            <div>
              {common.templateIdLabel} <span className="font-mono">{rule.templateId ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <StageList reminderRuleId={id} />
    </div>
  )
}
