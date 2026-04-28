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
} from "@voyantjs/voyant-ui/components"
import { CurrencyCombobox } from "@voyantjs/voyant-ui/components/currency-combobox"
import { DatePicker } from "@voyantjs/voyant-ui/components/date-picker"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const scheduleTypes = ["deposit", "installment", "balance", "hold", "other"] as const
const scheduleStatuses = ["pending", "due", "paid", "waived", "cancelled", "expired"] as const

const scheduleFormSchema = z.object({
  scheduleType: z.enum(scheduleTypes).default("balance"),
  status: z.enum(scheduleStatuses).default("pending"),
  dueDate: z.string().min(1, "Due date is required"),
  currency: z.string().min(3).max(3).default("EUR"),
  amountCents: z.coerce.number().int().min(0, "Amount is required"),
  notes: z.string().optional().nullable(),
})

type ScheduleFormValues = z.input<typeof scheduleFormSchema>
type ScheduleFormOutput = z.output<typeof scheduleFormSchema>

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
          <DialogTitle>{isEditing ? "Edit Payment Schedule" : "Add Payment Schedule"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
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
                        {t.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
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
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Due Date</Label>
              <DatePicker
                value={form.watch("dueDate") || null}
                onChange={(next) =>
                  form.setValue("dueDate", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder="Select due date"
                className="w-full"
              />
              {form.formState.errors.dueDate && (
                <p className="text-xs text-destructive">{form.formState.errors.dueDate.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Currency</Label>
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
                <Label>Amount (cents)</Label>
                <Input {...form.register("amountCents")} type="number" min={0} />
                {form.formState.errors.amountCents && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amountCents.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} placeholder="Payment notes..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
