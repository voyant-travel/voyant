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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@voyantjs/ui/components/field"
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

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

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
        <DialogBody>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_8rem]">
              <Field>
                <FieldLabel htmlFor="channel-channel">{messages.channel.fields.channel}</FieldLabel>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setField("channel", v as Channel)}
                >
                  <SelectTrigger id="channel-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">{messages.channel.channels.email}</SelectItem>
                    <SelectItem value="sms">{messages.channel.channels.sms}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="channel-order">
                  {messages.channel.fields.orderIndex}
                </FieldLabel>
                <Input
                  id="channel-order"
                  type="number"
                  value={form.orderIndex}
                  onChange={(e) => setField("orderIndex", Number(e.target.value))}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="channel-template-slug">
                {messages.channel.fields.templateSlug}
              </FieldLabel>
              <Input
                id="channel-template-slug"
                value={form.templateSlug}
                onChange={(e) => setField("templateSlug", e.target.value)}
                placeholder="payment-reminder-first"
              />
              <FieldDescription>
                Either a template slug or a template id. The slug is resolved at send time so
                editing the template doesn't need a rule update.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="channel-template-id">
                {messages.channel.fields.templateId}
              </FieldLabel>
              <Input
                id="channel-template-id"
                value={form.templateId}
                onChange={(e) => setField("templateId", e.target.value)}
                placeholder={messages.common.optionalPlaceholder}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="channel-recipient-kind">
                  {messages.channel.fields.recipientKind}
                </FieldLabel>
                <Select
                  value={form.recipientKind}
                  onValueChange={(v) => setField("recipientKind", v as RecipientKind)}
                >
                  <SelectTrigger id="channel-recipient-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">
                      {messages.channel.recipientKinds.primary}
                    </SelectItem>
                    <SelectItem value="cc">{messages.channel.recipientKinds.cc}</SelectItem>
                    <SelectItem value="bcc">{messages.channel.recipientKinds.bcc}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="channel-recipient-role">
                  {messages.channel.fields.recipientRole}
                </FieldLabel>
                <Input
                  id="channel-recipient-role"
                  value={form.recipientRole}
                  onChange={(e) => setField("recipientRole", e.target.value)}
                  placeholder={messages.common.optionalPlaceholder}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="channel-provider">{messages.channel.fields.provider}</FieldLabel>
              <Input
                id="channel-provider"
                value={form.provider}
                onChange={(e) => setField("provider", e.target.value)}
                placeholder={messages.common.optionalPlaceholder}
              />
              <FieldDescription>
                Override the default provider for this channel (e.g. a transactional vs marketing
                sender).
              </FieldDescription>
            </Field>
          </FieldGroup>
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
