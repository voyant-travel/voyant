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
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

const webhookFormSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  eventType: z.string().min(1, "Event type is required"),
  externalEventId: z.string().optional(),
  payloadJson: z.string().min(2, "Payload JSON is required"),
  receivedAt: z.string().optional(),
  processedAt: z.string().optional(),
  status: z.enum(["pending", "processed", "failed", "ignored"]),
  errorMessage: z.string().optional(),
})

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
          <DialogTitle>{isEditing ? "Edit Webhook Event" : "New Webhook Event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>Channel</Label>
              <Select
                items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                value={form.watch("channelId")}
                onValueChange={(value) => form.setValue("channelId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select channel" />
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
                <Label>Event Type</Label>
                <Input {...form.register("eventType")} placeholder="booking.updated" />
              </div>
              <div className="grid gap-2">
                <Label>External Event ID</Label>
                <Input {...form.register("externalEventId")} placeholder="evt_123" />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
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
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Received At</Label>
                <DateTimePicker
                  value={form.watch("receivedAt") || null}
                  onChange={(next) =>
                    form.setValue("receivedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select received date & time"
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>Processed At</Label>
                <DateTimePicker
                  value={form.watch("processedAt") || null}
                  onChange={(next) =>
                    form.setValue("processedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select processed date & time"
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Payload JSON</Label>
              <Textarea {...form.register("payloadJson")} className="min-h-40 font-mono text-xs" />
            </div>
            <div className="grid gap-2">
              <Label>Error Message</Label>
              <Textarea
                {...form.register("errorMessage")}
                placeholder="Optional processor failure details..."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Webhook Event" : "Create Webhook Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
