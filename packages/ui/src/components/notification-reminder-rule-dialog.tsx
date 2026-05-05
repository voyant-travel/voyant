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

import { zodResolver } from "../lib/zod-resolver"
import { Button } from "./button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./index"
import { Input } from "./input"
import { Label } from "./label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

const reminderRuleFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  targetType: z.enum([
    "booking_confirmed",
    "booking_payment_schedule",
    "payment_complete",
    "booking_cancelled_non_payment",
  ]),
  channel: z.enum(["email", "sms"]),
  templateId: z.string().min(1, "Template is required"),
  relativeDaysFromDueDate: z.number().int().min(-365).max(365),
})

const reminderTargetOptions = [
  { value: "booking_confirmed", label: "Booking confirmed" },
  { value: "payment_complete", label: "Payment complete" },
  { value: "booking_cancelled_non_payment", label: "Booking cancelled (non-payment)" },
  { value: "booking_payment_schedule", label: "Booking payment schedule" },
] as const

type FormValues = z.input<typeof reminderRuleFormSchema>
type FormOutput = z.output<typeof reminderRuleFormSchema>

const dueDateTargetTypes = new Set<FormValues["targetType"]>(["booking_payment_schedule"])

function slugifyReminderRule(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "notification-rule"
}

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
  const isEditing = Boolean(rule)
  const { create, update } = useNotificationReminderRuleMutation()
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(reminderRuleFormSchema),
    defaultValues: {
      name: "",
      status: "draft",
      targetType: "booking_payment_schedule",
      channel: "email",
      templateId: "",
      relativeDaysFromDueDate: 0,
    },
  })
  const channel = form.watch("channel")
  const targetType = form.watch("targetType")
  const usesDueDateTiming = dueDateTargetTypes.has(targetType)
  const { data: templates } = useNotificationTemplates({
    channel,
    status: "active",
    limit: 100,
    offset: 0,
  })

  useEffect(() => {
    if (open && rule) {
      const resolvedTemplateId =
        rule.templateId ??
        (rule.templateSlug
          ? ((templates?.data ?? []).find((template) => template.slug === rule.templateSlug)?.id ??
            "")
          : "")

      form.reset({
        name: rule.name,
        status: rule.status,
        targetType: rule.targetType === "invoice" ? "booking_payment_schedule" : rule.targetType,
        channel: rule.channel,
        templateId: resolvedTemplateId,
        relativeDaysFromDueDate: rule.relativeDaysFromDueDate,
      })
      return
    }

    if (open) {
      form.reset()
    }
  }, [open, rule, form, templates?.data])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      name: values.name,
      slug:
        rule?.slug ??
        `${slugifyReminderRule(values.targetType)}-${slugifyReminderRule(values.name)}`,
      status: values.status,
      targetType: values.targetType,
      channel: values.channel,
      provider: null,
      templateId: values.templateId,
      templateSlug: null,
      relativeDaysFromDueDate: dueDateTargetTypes.has(values.targetType)
        ? values.relativeDaysFromDueDate
        : 0,
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
          <DialogTitle>{isEditing ? "Edit Reminder Rule" : "New Reminder Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="Payment due in 3 days" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Target</Label>
                <Select
                  value={form.watch("targetType")}
                  onValueChange={(value) => {
                    if (!value) return
                    form.setValue("targetType", value as FormValues["targetType"])
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderTargetOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) => {
                    if (!value) return
                    form.setValue("status", value as FormValues["status"])
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={usesDueDateTiming ? "grid grid-cols-2 gap-4" : "grid gap-4"}>
              <div className="flex flex-col gap-2">
                <Label>Channel</Label>
                <Select
                  value={form.watch("channel")}
                  onValueChange={(value) => {
                    if (!value) return
                    form.setValue("channel", value as FormValues["channel"])
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {usesDueDateTiming ? (
                <div className="flex flex-col gap-2">
                  <Label>Send timing</Label>
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
                  <p className="text-xs text-muted-foreground">
                    Days from due date: -3 sends 3 days before, 0 on the due date, 3 after.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Template</Label>
              <Select
                value={form.watch("templateId")}
                onValueChange={(value) => {
                  if (!value) return
                  form.setValue("templateId", value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select template" />
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
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
