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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

const scheduleTypes = ["deposit", "installment", "balance", "hold", "other"] as const
const scheduleStatuses = ["pending", "due", "paid", "waived", "cancelled", "expired"] as const

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
  const scheduleMessages = useAdminMessages().bookings.detail.paymentScheduleDialog
  const isEditing = Boolean(schedule)
  const { create, update } = useBookingPaymentScheduleMutation(bookingId)

  const scheduleFormSchema = z.object({
    scheduleType: z.enum(scheduleTypes).default("balance"),
    status: z.enum(scheduleStatuses).default("pending"),
    dueDate: z.string().min(1, scheduleMessages.validationDueDateRequired),
    currency: z.string().min(3).max(3).default("EUR"),
    amountCents: z.coerce.number().int().min(0, scheduleMessages.validationAmountRequired),
    notes: z.string().optional().nullable(),
  })

  type ScheduleFormValues = z.input<typeof scheduleFormSchema>
  type ScheduleFormOutput = z.output<typeof scheduleFormSchema>

  const form = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      scheduleType: "balance",
      status: "pending",
      dueDate: "",
      currency: "EUR",
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
            {isEditing ? scheduleMessages.editTitle : scheduleMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{scheduleMessages.typeLabel}</Label>
                <Select
                  items={scheduleTypes.map((t) => ({ label: t.replace("_", " "), value: t }))}
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
                        {t === "deposit"
                          ? scheduleMessages.typeDeposit
                          : t === "installment"
                            ? scheduleMessages.typeInstallment
                            : t === "balance"
                              ? scheduleMessages.typeBalance
                              : t === "hold"
                                ? scheduleMessages.typeHold
                                : scheduleMessages.typeOther}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{scheduleMessages.statusLabel}</Label>
                <Select
                  items={scheduleStatuses.map((s) => ({ label: s.replace("_", " "), value: s }))}
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
                        {s === "pending"
                          ? scheduleMessages.statusPending
                          : s === "due"
                            ? scheduleMessages.statusDue
                            : s === "paid"
                              ? scheduleMessages.statusPaid
                              : s === "waived"
                                ? scheduleMessages.statusWaived
                                : s === "cancelled"
                                  ? scheduleMessages.statusCancelled
                                  : scheduleMessages.statusExpired}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{scheduleMessages.dueDateLabel}</Label>
              <DatePicker
                value={form.watch("dueDate") || null}
                onChange={(next) =>
                  form.setValue("dueDate", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder={scheduleMessages.dueDatePlaceholder}
                className="w-full"
              />
              {form.formState.errors.dueDate && (
                <p className="text-xs text-destructive">{form.formState.errors.dueDate.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{scheduleMessages.currencyLabel}</Label>
                <CurrencyCombobox
                  value={form.watch("currency") || null}
                  onChange={(next) =>
                    form.setValue("currency", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{scheduleMessages.amountLabel}</Label>
                <Input {...form.register("amountCents")} type="number" min={0} />
                {form.formState.errors.amountCents && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amountCents.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{scheduleMessages.notesLabel}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={scheduleMessages.notesPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {scheduleMessages.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? scheduleMessages.saveChanges : scheduleMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
