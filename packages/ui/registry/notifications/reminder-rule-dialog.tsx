"use client"

import {
  type NotificationReminderRuleRecord,
  useNotificationReminderRuleMutation,
  useNotificationTemplates,
} from "@voyantjs/notifications-react"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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
} from "@/components/ui"
import { zodResolver } from "@/lib/zod-resolver"
import { useRegistryNotificationsMessagesOrDefault } from "./i18n"

type NotificationReminderRuleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: NotificationReminderRuleRecord
  onSuccess: () => void
}

export function NotificationReminderRuleDialog({
  open,
  onOpenChange,
  rule,
  onSuccess,
}: NotificationReminderRuleDialogProps) {
  const messages = useRegistryNotificationsMessagesOrDefault()
  const dialogMessages = messages.reminderRuleDialog
  const isEditing = Boolean(rule)
  const { create, update } = useNotificationReminderRuleMutation()
  const TARGET_TYPE_ITEMS = [
    {
      label: messages.common.targetTypeLabels.booking_payment_schedule,
      value: "booking_payment_schedule",
    },
    { label: messages.common.targetTypeLabels.invoice, value: "invoice" },
  ] as const
  const STATUS_ITEMS = [
    { label: messages.common.templateStatusLabels.draft, value: "draft" },
    { label: messages.common.templateStatusLabels.active, value: "active" },
    { label: messages.common.templateStatusLabels.archived, value: "archived" },
  ] as const
  const CHANNEL_ITEMS = [
    { label: messages.common.channelLabels.email, value: "email" },
    { label: messages.common.channelLabels.sms, value: "sms" },
  ] as const
  const PROVIDER_ITEMS = [
    { label: messages.common.providerLabels.automatic, value: "automatic" },
    { label: messages.common.providerLabels.resend, value: "resend" },
    { label: messages.common.providerLabels.twilio, value: "twilio" },
  ] as const
  const reminderRuleFormSchema = z.object({
    name: z.string().min(1, dialogMessages.errors.nameRequired),
    slug: z
      .string()
      .min(1, dialogMessages.errors.slugRequired)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, dialogMessages.errors.kebabCase),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    targetType: z.enum(["booking_payment_schedule", "invoice"]),
    channel: z.enum(["email", "sms"]),
    provider: z.enum(["automatic", "resend", "twilio"]).default("automatic"),
    templateId: z.string().min(1, dialogMessages.errors.templateRequired),
    relativeDaysFromDueDate: z.number().int().min(-365).max(365),
  })
  type FormValues = z.input<typeof reminderRuleFormSchema>
  type FormOutput = z.output<typeof reminderRuleFormSchema>
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(reminderRuleFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      status: "draft",
      targetType: "booking_payment_schedule",
      channel: "email",
      provider: "automatic",
      templateId: "",
      relativeDaysFromDueDate: 0,
    },
  })
  const channel = form.watch("channel")
  const { data: templates } = useNotificationTemplates({
    channel,
    status: "active",
    limit: 100,
    offset: 0,
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        name: rule.name,
        slug: rule.slug,
        status: rule.status,
        targetType: rule.targetType,
        channel: rule.channel,
        provider:
          rule.provider === "resend" || rule.provider === "twilio" ? rule.provider : "automatic",
        templateId: rule.templateId ?? "",
        relativeDaysFromDueDate: rule.relativeDaysFromDueDate,
      })
      return
    }

    if (open) {
      form.reset()
    }
  }, [open, rule, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      name: values.name,
      slug: values.slug,
      status: values.status,
      targetType: values.targetType,
      channel: values.channel,
      provider: values.provider === "automatic" ? null : values.provider,
      templateId: values.templateId,
      templateSlug: null,
      relativeDaysFromDueDate: values.relativeDaysFromDueDate,
      isSystem: rule?.isSystem ?? false,
      metadata: rule?.metadata ?? null,
    }

    if (isEditing && rule) {
      await update.mutateAsync({ id: rule.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }

    onSuccess()
  }

  const isPending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.titleEdit : dialogMessages.titleNew}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.name}</Label>
                <Input {...form.register("name")} placeholder={dialogMessages.placeholders.name} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.slug}</Label>
                <Input {...form.register("slug")} placeholder={dialogMessages.placeholders.slug} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.target}</Label>
                <Select
                  items={TARGET_TYPE_ITEMS}
                  value={form.watch("targetType")}
                  onValueChange={(value) =>
                    form.setValue("targetType", value as FormValues["targetType"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.status}</Label>
                <Select
                  items={STATUS_ITEMS}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as FormValues["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.channel}</Label>
                <Select
                  items={CHANNEL_ITEMS}
                  value={form.watch("channel")}
                  onValueChange={(value) =>
                    form.setValue("channel", value as FormValues["channel"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.provider}</Label>
                <Select
                  items={PROVIDER_ITEMS}
                  value={form.watch("provider")}
                  onValueChange={(value) =>
                    form.setValue("provider", value as FormValues["provider"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.offsetDays}</Label>
                <Input
                  type="number"
                  value={form.watch("relativeDaysFromDueDate")}
                  onChange={(event) =>
                    form.setValue(
                      "relativeDaysFromDueDate",
                      Number.parseInt(event.target.value || "0", 10),
                    )
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.template}</Label>
              <Select
                items={(templates?.data ?? []).map((template) => ({
                  label: `${template.name} (${template.slug})`,
                  value: template.id,
                }))}
                value={form.watch("templateId")}
                onValueChange={(value) => form.setValue("templateId", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.placeholders.template} />
                </SelectTrigger>
                <SelectContent>
                  {(templates?.data ?? []).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
