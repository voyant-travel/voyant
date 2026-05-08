"use client"

import {
  type ReminderStageChannelRecord,
  useReminderStageChannelMutation,
} from "@voyantjs/notifications-react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"

type Channel = "email" | "sms"
type RecipientKind = "primary" | "cc" | "bcc"

type FormState = {
  orderIndex: number
  channel: Channel
  provider: string
  templateId: string
  templateSlug: string
  recipientKind: RecipientKind
  recipientRole: string
}

function fromRecord(channel: ReminderStageChannelRecord | null, orderIndex: number): FormState {
  if (!channel) {
    return {
      orderIndex,
      channel: "email",
      provider: "",
      templateId: "",
      templateSlug: "",
      recipientKind: "primary",
      recipientRole: "",
    }
  }
  return {
    orderIndex: channel.orderIndex,
    channel: channel.channel,
    provider: channel.provider ?? "",
    templateId: channel.templateId ?? "",
    templateSlug: channel.templateSlug ?? "",
    recipientKind: channel.recipientKind,
    recipientRole: channel.recipientRole ?? "",
  }
}

export interface StageChannelEditorDialogProps {
  reminderRuleId: string
  stageId: string
  channel: ReminderStageChannelRecord | null
  defaultOrderIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StageChannelEditorDialog({
  reminderRuleId,
  stageId,
  channel,
  defaultOrderIndex = 0,
  open,
  onOpenChange,
}: StageChannelEditorDialogProps) {
  const messages = useNotificationsUiMessagesOrDefault()
  const { create, update } = useReminderStageChannelMutation(reminderRuleId, stageId)
  const [form, setForm] = useState<FormState>(() => fromRecord(channel, defaultOrderIndex))
  const isEdit = Boolean(channel)
  const isPending = create.isPending || update.isPending

  useEffect(() => {
    if (open) setForm(fromRecord(channel, defaultOrderIndex))
  }, [open, channel, defaultOrderIndex])

  const handleSubmit = async () => {
    const input = {
      orderIndex: form.orderIndex,
      channel: form.channel,
      provider: form.provider || null,
      templateId: form.templateId || null,
      templateSlug: form.templateSlug || null,
      recipientKind: form.recipientKind,
      recipientRole: form.recipientRole || null,
    }
    if (isEdit && channel) {
      await update.mutateAsync({ channelId: channel.id, input })
    } else {
      await create.mutateAsync(input)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? messages.channel.titles.edit : messages.channel.titles.create}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{messages.channel.fields.orderIndex}</Label>
              <Input
                type="number"
                value={form.orderIndex}
                onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>{messages.channel.fields.channel}</Label>
              <Select
                value={form.channel}
                onValueChange={(v) => setForm({ ...form, channel: v as Channel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">{messages.channel.channels.email}</SelectItem>
                  <SelectItem value="sms">{messages.channel.channels.sms}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>{messages.channel.fields.templateSlug}</Label>
            <Input
              value={form.templateSlug}
              onChange={(e) => setForm({ ...form, templateSlug: e.target.value })}
              placeholder="payment-reminder-first"
            />
          </div>

          <div>
            <Label>{messages.channel.fields.templateId}</Label>
            <Input
              value={form.templateId}
              onChange={(e) => setForm({ ...form, templateId: e.target.value })}
              placeholder={messages.common.optionalPlaceholder}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{messages.channel.fields.recipientKind}</Label>
              <Select
                value={form.recipientKind}
                onValueChange={(v) => setForm({ ...form, recipientKind: v as RecipientKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">{messages.channel.recipientKinds.primary}</SelectItem>
                  <SelectItem value="cc">{messages.channel.recipientKinds.cc}</SelectItem>
                  <SelectItem value="bcc">{messages.channel.recipientKinds.bcc}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{messages.channel.fields.recipientRole}</Label>
              <Input
                value={form.recipientRole}
                onChange={(e) => setForm({ ...form, recipientRole: e.target.value })}
                placeholder={messages.common.optionalPlaceholder}
              />
            </div>
          </div>

          <div>
            <Label>{messages.channel.fields.provider}</Label>
            <Input
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              placeholder={messages.common.optionalPlaceholder}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {messages.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? messages.common.save : messages.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
