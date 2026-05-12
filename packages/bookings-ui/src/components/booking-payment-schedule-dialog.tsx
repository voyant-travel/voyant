"use client"

import {
  type BookingPaymentScheduleRecord,
  useBookingPaymentScheduleMutation,
} from "@voyantjs/finance-react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { CurrencyInput } from "@voyantjs/ui/components/currency-input"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

const scheduleTypes = ["deposit", "installment", "balance", "hold", "other"] as const
const scheduleStatuses = ["pending", "due", "paid", "waived", "cancelled", "expired"] as const
const DEFAULT_CURRENCY = "EUR" // i18n-literal-ok ISO default currency

function createScheduleFormSchema(messages: ReturnType<typeof useBookingsUiMessagesOrDefault>) {
  return z.object({
    scheduleType: z.enum(scheduleTypes).default("balance"),
    status: z.enum(scheduleStatuses).default("pending"),
    dueDate: z.string().min(1, messages.paymentScheduleDialog.validation.dueDateRequired),
    currency: z.string().min(3).max(3).default("EUR"),
    amountCents: z.coerce
      .number()
      .int()
      .min(0, messages.paymentScheduleDialog.validation.amountRequired),
    notes: z.string().optional().nullable(),
  })
}

type ScheduleFormValues = z.input<ReturnType<typeof createScheduleFormSchema>>
type ScheduleFormOutput = z.output<ReturnType<typeof createScheduleFormSchema>>

export interface BookingPaymentScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  schedule?: BookingPaymentScheduleRecord
  onSuccess?: () => void
}

export function BookingPaymentScheduleDialog({
  open,
  onOpenChange,
  bookingId,
  schedule,
  onSuccess,
}: BookingPaymentScheduleDialogProps) {
  const isEditing = Boolean(schedule)
  const { create, update } = useBookingPaymentScheduleMutation(bookingId)
  const messages = useBookingsUiMessagesOrDefault()
  const scheduleFormSchema = createScheduleFormSchema(messages)

  const form = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      scheduleType: "balance",
      status: "pending",
      dueDate: "",
      currency: DEFAULT_CURRENCY,
      amountCents: 0,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && schedule) {
      form.reset({
        scheduleType: schedule.scheduleType,
        status: schedule.status,
        dueDate: schedule.dueDate,
        currency: schedule.currency,
        amountCents: schedule.amountCents,
        notes: schedule.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, schedule])

  const onSubmit = async (values: ScheduleFormOutput) => {
    const payload = {
      scheduleType: values.scheduleType,
      status: values.status,
      dueDate: values.dueDate,
      currency: values.currency,
      amountCents: values.amountCents,
      notes: values.notes || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: schedule!.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }

    onOpenChange(false)
    onSuccess?.()
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.paymentScheduleDialog.titles.edit
              : messages.paymentScheduleDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.paymentScheduleDialog.fields.type}</Label>
                <Select
                  items={scheduleTypes.map((t) => ({
                    label: messages.paymentScheduleDialog.scheduleTypeLabels[t],
                    value: t,
                  }))}
                  value={form.watch("scheduleType")}
                  onValueChange={(v) =>
                    form.setValue(
                      "scheduleType",
                      (v ?? "balance") as (typeof scheduleTypes)[number],
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {messages.paymentScheduleDialog.scheduleTypeLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.paymentScheduleDialog.fields.status}</Label>
                <Select
                  items={scheduleStatuses.map((s) => ({
                    label: messages.paymentScheduleDialog.scheduleStatusLabels[s],
                    value: s,
                  }))}
                  value={form.watch("status")}
                  onValueChange={(v) =>
                    form.setValue("status", (v ?? "pending") as (typeof scheduleStatuses)[number])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {messages.paymentScheduleDialog.scheduleStatusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.paymentScheduleDialog.fields.dueDate}</Label>
              <DatePicker
                value={form.watch("dueDate") || null}
                onChange={(next) =>
                  form.setValue("dueDate", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder={messages.paymentScheduleDialog.placeholders.dueDate}
                className="w-full"
              />
              {form.formState.errors.dueDate && (
                <p className="text-xs text-destructive">{form.formState.errors.dueDate.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.paymentScheduleDialog.fields.currency}</Label>
                <CurrencyCombobox
                  value={form.watch("currency") || null}
                  onChange={(next) =>
                    form.setValue("currency", next ?? DEFAULT_CURRENCY, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.paymentScheduleDialog.fields.amountCents}</Label>
                <CurrencyInput
                  value={form.watch("amountCents") as number}
                  onChange={(next) =>
                    form.setValue("amountCents", next ?? 0, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  currency={form.watch("currency")}
                />
                {form.formState.errors.amountCents && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amountCents.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.paymentScheduleDialog.fields.notes}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={messages.paymentScheduleDialog.placeholders.notes}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing
                ? messages.common.saveChanges
                : messages.paymentScheduleDialog.actions.addSchedule}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
