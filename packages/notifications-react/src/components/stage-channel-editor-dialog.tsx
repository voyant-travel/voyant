"use client"

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
} from "@voyant-travel/ui/components"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@voyant-travel/ui/components/field"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import { type ReminderStageChannelRecord, useReminderStageChannelMutation } from "../index.js"
import { TemplatePicker } from "./template-picker.js"

type Channel = "email" | "sms"
type RecipientKind = "primary" | "cc" | "bcc"
type ProviderOption = "automatic" | "resend" | "twilio"

type FormState = {
  orderIndex: number
  channel: Channel
  provider: ProviderOption
  templateId: string | null
  templateSlug: string | null
  recipientKind: RecipientKind
}

function fromRecord(channel: ReminderStageChannelRecord | null, orderIndex: number): FormState {
  if (!channel) {
    return {
      orderIndex,
      channel: "email",
      provider: "automatic",
      templateId: null,
      templateSlug: null,
      recipientKind: "primary",
    }
  }
  const provider: ProviderOption =
    channel.provider === "resend" || channel.provider === "twilio" ? channel.provider : "automatic"
  return {
    orderIndex: channel.orderIndex,
    channel: channel.channel,
    provider,
    templateId: channel.templateId ?? null,
    templateSlug: channel.templateSlug ?? null,
    recipientKind: channel.recipientKind,
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
  const templatePickerValueKey = form.templateSlug || !form.templateId ? "slug" : "id"

  useEffect(() => {
    if (open) setForm(fromRecord(channel, defaultOrderIndex))
  }, [open, channel, defaultOrderIndex])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    const input = {
      orderIndex: form.orderIndex,
      channel: form.channel,
      provider: form.provider === "automatic" ? null : form.provider,
      templateId: form.templateId,
      templateSlug: form.templateSlug,
      recipientKind: form.recipientKind,
      recipientRole: null,
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
                  onValueChange={(v) => {
                    if (!v) return
                    const next = v as Channel
                    setForm((prev) => ({
                      ...prev,
                      channel: next,
                      // Picked template no longer matches the new channel — clear it.
                      templateId: null,
                      templateSlug: null,
                    }))
                  }}
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
              <FieldLabel>{messages.channel.fields.template}</FieldLabel>
              <TemplatePicker
                value={form.templateSlug ?? form.templateId}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    templateId: templatePickerValueKey === "id" ? value : null,
                    templateSlug: templatePickerValueKey === "slug" ? value : null,
                  }))
                }
                valueKey={templatePickerValueKey}
                channel={form.channel}
                placeholder={messages.channel.placeholders.template}
              />
              <FieldDescription>{messages.admin.common.templateResolutionHint}</FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="channel-recipient-kind">
                  {messages.channel.fields.recipientKind}
                </FieldLabel>
                <Select
                  value={form.recipientKind}
                  onValueChange={(v) => {
                    if (!v) return
                    setField("recipientKind", v as RecipientKind)
                  }}
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
                <FieldLabel htmlFor="channel-provider">
                  {messages.channel.fields.provider}
                </FieldLabel>
                <Select
                  value={form.provider}
                  onValueChange={(v) => {
                    if (!v) return
                    setField("provider", v as ProviderOption)
                  }}
                >
                  <SelectTrigger id="channel-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">
                      {messages.channel.providers.automatic}
                    </SelectItem>
                    <SelectItem value="resend">{messages.channel.providers.resend}</SelectItem>
                    <SelectItem value="twilio">{messages.channel.providers.twilio}</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {messages.channel.descriptions.automaticProvider}
                </FieldDescription>
              </Field>
            </div>
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
