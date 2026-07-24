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
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import {
  type ReminderRuleStageRecord,
  useReminderRuleStageMutation,
  useReminderRuleStages,
} from "../index.js"
import { StageChannelList } from "./stage-channel-list.js"
import { StageEditorDialog } from "./stage-editor-dialog.js"

export interface StageListProps {
  reminderRuleId: string
}

export function StageList({ reminderRuleId }: StageListProps) {
  const messages = useNotificationsUiMessagesOrDefault()
  const { data: stages, isLoading } = useReminderRuleStages(reminderRuleId)
  const { remove, reorder } = useReminderRuleStageMutation(reminderRuleId)
  const [editing, setEditing] = useState<ReminderRuleStageRecord | null>(null)
  const [creating, setCreating] = useState(false)

  const move = async (index: number, direction: -1 | 1) => {
    if (!stages) return
    const target = index + direction
    if (target < 0 || target >= stages.length) return
    const next = [...stages]
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(target, 0, item)
    await reorder.mutateAsync({ stageIds: next.map((s) => s.id) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{messages.stage.listHeading}</h3>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> {messages.stage.addStage}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{messages.common.loading}</p>}
      {stages && stages.length === 0 && (
        <p className="text-sm text-muted-foreground">{messages.stage.listEmpty}</p>
      )}

      {stages?.map((stage, index) => (
        <Card key={stage.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Badge variant="outline">#{stage.orderIndex}</Badge>
              {stage.name ?? messages.stage.placeholders.name}
              <Badge variant="secondary">{messages.stage.anchors[stage.anchor]}</Badge>
              <Badge>{messages.stage.cadences[stage.cadenceKind]}</Badge>
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => move(index, -1)}
                disabled={index === 0}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => move(index, 1)}
                disabled={index === stages.length - 1}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditing(stage)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  if (
                    await confirmDialog({
                      description: messages.stage.deleteConfirm,
                      destructive: true,
                    })
                  ) {
                    void remove.mutateAsync(stage.id)
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
              <span>
                {messages.stage.fields.windowStartDays}: {stage.windowStartDays}
              </span>
              <span>
                {messages.stage.fields.windowEndDays}: {stage.windowEndDays}
              </span>
              {stage.cadenceKind === "every_n_days" && (
                <span>
                  {messages.stage.fields.cadenceEveryDays}: {stage.cadenceEveryDays}
                </span>
              )}
              <span>
                {messages.stage.fields.maxSendsInStage}: {stage.maxSendsInStage ?? 1}
              </span>
            </div>
            <StageChannelList reminderRuleId={reminderRuleId} stageId={stage.id} />
          </CardContent>
        </Card>
      ))}

      {creating && (
        <StageEditorDialog
          reminderRuleId={reminderRuleId}
          stage={null}
          defaultOrderIndex={stages?.length ?? 0}
          open={creating}
          onOpenChange={setCreating}
        />
      )}
      {editing && (
        <StageEditorDialog
          reminderRuleId={reminderRuleId}
          stage={editing}
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </div>
  )
}
