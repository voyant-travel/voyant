"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  confirmDialog,
} from "@voyant-travel/ui/components"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import {
  type ReminderStageChannelRecord,
  useReminderStageChannelMutation,
  useReminderStageChannels,
} from "../index.js"
import { StageChannelEditorDialog } from "./stage-channel-editor-dialog.js"

export interface StageChannelListProps {
  reminderRuleId: string
  stageId: string
}

export function StageChannelList({ reminderRuleId, stageId }: StageChannelListProps) {
  const messages = useNotificationsUiMessagesOrDefault()
  const { data: channels, isLoading } = useReminderStageChannels(reminderRuleId, stageId)
  const { remove } = useReminderStageChannelMutation(reminderRuleId, stageId)
  const [editing, setEditing] = useState<ReminderStageChannelRecord | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{messages.channel.listHeading}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> {messages.channel.addChannel}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{messages.common.loading}</p>}
        {channels && channels.length === 0 && (
          <p className="text-sm text-muted-foreground">{messages.channel.listEmpty}</p>
        )}
        {channels?.map((channel) => (
          <div
            key={channel.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-3">
              <Badge variant="outline">{messages.channel.channels[channel.channel]}</Badge>
              <Badge variant="secondary">
                {messages.channel.recipientKinds[channel.recipientKind]}
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setEditing(channel)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  if (
                    await confirmDialog({
                      description: messages.channel.deleteConfirm,
                      destructive: true,
                    })
                  ) {
                    void remove.mutateAsync(channel.id)
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      {creating && (
        <StageChannelEditorDialog
          reminderRuleId={reminderRuleId}
          stageId={stageId}
          channel={null}
          defaultOrderIndex={channels?.length ?? 0}
          open={creating}
          onOpenChange={setCreating}
        />
      )}
      {editing && (
        <StageChannelEditorDialog
          reminderRuleId={reminderRuleId}
          stageId={stageId}
          channel={editing}
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </Card>
  )
}
