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
  Textarea,
} from "@/components/ui"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import { useDistributionUiMessagesOrDefault } from "../../../distribution-ui/src/index"
import type { ChannelRow, ChannelWebhookEventRow } from "./distribution-shared"
import {
  nullableString,
  parseJsonRecord,
  toIsoDateTime,
  toLocalDateTimeInput,
  webhookStatusOptions,
} from "./distribution-shared"
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"

function getWebhookFormSchema(
  messages: ReturnType<typeof useRegistryDistributionMessagesOrDefault>,
) {
  return z.object({
    channelId: z.string().min(1, messages.dialogs.webhookEvent.validation.channelRequired),
    eventType: z.string().min(1, messages.dialogs.webhookEvent.validation.eventTypeRequired),
    externalEventId: z.string().optional(),
    payloadJson: z.string().min(2, messages.dialogs.webhookEvent.validation.payloadRequired),
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
  const distributionMessages = useDistributionUiMessagesOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const dialog = messages.dialogs.webhookEvent
  const statusOptions = webhookStatusOptions.map((option) => ({
    value: option.value,
    label: distributionMessages.common.webhookStatusLabels[option.value],
  }))
  const form = useForm({
    resolver: zodResolver(getWebhookFormSchema(messages)),
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

  const onSubmit = async (values: z.output<ReturnType<typeof getWebhookFormSchema>>) => {
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
          <DialogTitle>{isEditing ? dialog.titleEdit : dialog.titleNew}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{dialog.fields.channel}</Label>
              <Select
                items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                value={form.watch("channelId")}
                onValueChange={(value) => form.setValue("channelId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialog.placeholders.selectChannel} />
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
                <Label>{dialog.fields.eventType}</Label>
                <Input
                  {...form.register("eventType")}
                  placeholder={dialog.placeholders.eventType}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.externalEventId}</Label>
                <Input
                  {...form.register("externalEventId")}
                  placeholder={dialog.placeholders.externalEventId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.status}</Label>
                <Select
                  items={statusOptions}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as ChannelWebhookEventRow["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.receivedAt}</Label>
                <DateTimePicker
                  value={form.watch("receivedAt") || null}
                  onChange={(next) =>
                    form.setValue("receivedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.placeholders.receivedAt}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.processedAt}</Label>
                <DateTimePicker
                  value={form.watch("processedAt") || null}
                  onChange={(next) =>
                    form.setValue("processedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.placeholders.processedAt}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialog.fields.payloadJson}</Label>
              <Textarea {...form.register("payloadJson")} className="min-h-40 font-mono text-xs" />
            </div>
            <div className="grid gap-2">
              <Label>{dialog.fields.errorMessage}</Label>
              <Textarea
                {...form.register("errorMessage")}
                placeholder={dialog.placeholders.errorMessage}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialog.save : dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
