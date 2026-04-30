import type {
  ChannelRow,
  ChannelWebhookEventRow,
} from "@voyantjs/distribution-ui/components/distribution-shared"
import {
  nullableString,
  parseJsonRecord,
  toIsoDateTime,
  toLocalDateTimeInput,
  webhookStatusOptions,
} from "@voyantjs/distribution-ui/components/distribution-shared"
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
  Textarea,
} from "@voyantjs/ui/components"
import { DateTimePicker } from "@voyantjs/ui/components/date-time-picker"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

function createWebhookFormSchema(
  channelRequired: string,
  eventTypeRequired: string,
  payloadJsonRequired: string,
) {
  return z.object({
    channelId: z.string().min(1, channelRequired),
    eventType: z.string().min(1, eventTypeRequired),
    externalEventId: z.string().optional(),
    payloadJson: z.string().min(2, payloadJsonRequired),
    receivedAt: z.string().optional(),
    processedAt: z.string().optional(),
    status: z.enum(["pending", "processed", "failed", "ignored"]),
    errorMessage: z.string().optional(),
  })
}

export function ChannelWebhookEventDialog({
  open,
  onOpenChange,
  webhookEvent,
  channels,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhookEvent?: ChannelWebhookEventRow
  channels: ChannelRow[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()
  const dialogMessages = messages.distribution.dialogs.webhook
  const webhookFormSchema = useMemo(
    () =>
      createWebhookFormSchema(
        dialogMessages.validation.channelRequired,
        dialogMessages.validation.eventTypeRequired,
        dialogMessages.validation.payloadJsonRequired,
      ),
    [
      dialogMessages.validation.channelRequired,
      dialogMessages.validation.eventTypeRequired,
      dialogMessages.validation.payloadJsonRequired,
    ],
  )
  const form = useForm({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: {
      channelId: "",
      eventType: "",
      externalEventId: "",
      payloadJson: "{}",
      receivedAt: "",
      processedAt: "",
      status: "pending" as const,
      errorMessage: "",
    },
  })

  useEffect(() => {
    if (open && webhookEvent) {
      form.reset({
        channelId: webhookEvent.channelId,
        eventType: webhookEvent.eventType,
        externalEventId: webhookEvent.externalEventId ?? "",
        payloadJson: JSON.stringify(webhookEvent.payload, null, 2),
        receivedAt: toLocalDateTimeInput(webhookEvent.receivedAt),
        processedAt: toLocalDateTimeInput(webhookEvent.processedAt),
        status: webhookEvent.status,
        errorMessage: webhookEvent.errorMessage ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, webhookEvent])

  const isEditing = Boolean(webhookEvent)

  const onSubmit = async (values: z.output<typeof webhookFormSchema>) => {
    const payload = {
      channelId: values.channelId,
      eventType: values.eventType,
      externalEventId: nullableString(values.externalEventId),
      payload: parseJsonRecord(values.payloadJson) ?? {},
      receivedAt: toIsoDateTime(values.receivedAt),
      processedAt: toIsoDateTime(values.processedAt),
      status: values.status,
      errorMessage: nullableString(values.errorMessage),
    }

    if (isEditing) {
      await api.patch(`/v1/distribution/webhook-events/${webhookEvent?.id}`, payload)
    } else {
      await api.post("/v1/distribution/webhook-events", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.createTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.channel}</Label>
              <Select
                items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                value={form.watch("channelId")}
                onValueChange={(value) => form.setValue("channelId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.placeholders.selectChannel} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.eventType}</Label>
                <Input
                  {...form.register("eventType")}
                  placeholder={dialogMessages.placeholders.eventType}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.externalEventId}</Label>
                <Input
                  {...form.register("externalEventId")}
                  placeholder={dialogMessages.placeholders.externalEventId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.status}</Label>
                <Select
                  items={webhookStatusOptions}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as ChannelWebhookEventRow["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {webhookStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {messages.distribution.values.webhookStatus[option.value] ?? option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.receivedAt}</Label>
                <DateTimePicker
                  value={form.watch("receivedAt") || null}
                  onChange={(next) =>
                    form.setValue("receivedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.receivedAt}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.processedAt}</Label>
                <DateTimePicker
                  value={form.watch("processedAt") || null}
                  onChange={(next) =>
                    form.setValue("processedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.processedAt}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.payloadJson}</Label>
              <Textarea {...form.register("payloadJson")} className="min-h-40 font-mono text-xs" />
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.errorMessage}</Label>
              <Textarea
                {...form.register("errorMessage")}
                placeholder={dialogMessages.placeholders.errorMessage}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {dialogMessages.actions.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialogMessages.actions.save : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
