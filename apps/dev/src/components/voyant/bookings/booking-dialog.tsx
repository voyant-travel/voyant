"use client"

import { type BookingRecord, useBookingMutation } from "@voyantjs/bookings-react"
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
import { DateRangePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const bookingFormSchema = z.object({
  bookingNumber: z.string().min(1, "Booking number is required"),
  status: z.enum(["draft", "confirmed", "in_progress", "completed", "cancelled"]),
  sellCurrency: z.string().min(3).max(3, "Use 3-letter ISO code"),
  sellAmountCents: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  costAmountCents: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  pax: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
  internalNotes: z.string().optional().nullable(),
})

type BookingFormValues = z.input<typeof bookingFormSchema>
type BookingFormOutput = z.output<typeof bookingFormSchema>

export interface BookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking?: BookingRecord
  onSuccess?: (booking: BookingRecord) => void
}

const BOOKING_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const

function generateBookingNumber(): string {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `BK-${y}${m}-${seq}`
}

export function BookingDialog({ open, onOpenChange, booking, onSuccess }: BookingDialogProps) {
  const isEditing = Boolean(booking)
  const { create, update } = useBookingMutation()

  const form = useForm<BookingFormValues, unknown, BookingFormOutput>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      bookingNumber: "",
      status: "draft",
      sellCurrency: "EUR",
      sellAmountCents: "",
      costAmountCents: "",
      startDate: "",
      endDate: "",
      pax: "",
      internalNotes: "",
    },
  })

  useEffect(() => {
    if (open && booking) {
      form.reset({
        bookingNumber: booking.bookingNumber,
        status:
          booking.status === "on_hold" || booking.status === "expired" ? "draft" : booking.status,
        sellCurrency: booking.sellCurrency,
        sellAmountCents: booking.sellAmountCents ?? "",
        costAmountCents: booking.costAmountCents ?? "",
        startDate: booking.startDate ?? "",
        endDate: booking.endDate ?? "",
        pax: booking.pax ?? "",
        internalNotes: booking.internalNotes ?? "",
      })
    } else if (open) {
      form.reset({
        bookingNumber: generateBookingNumber(),
        status: "draft",
        sellCurrency: "EUR",
        sellAmountCents: "",
        costAmountCents: "",
        startDate: "",
        endDate: "",
        pax: "",
        internalNotes: "",
      })
    }
  }, [booking, form, open])

  const onSubmit = async (values: BookingFormOutput) => {
    const payload = {
      bookingNumber: values.bookingNumber,
      status: values.status,
      sellCurrency: values.sellCurrency,
      sellAmountCents:
        values.sellAmountCents && typeof values.sellAmountCents === "number"
          ? values.sellAmountCents
          : null,
      costAmountCents:
        values.costAmountCents && typeof values.costAmountCents === "number"
          ? values.costAmountCents
          : null,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      pax: values.pax && typeof values.pax === "number" ? values.pax : null,
      internalNotes: values.internalNotes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: booking!.id, input: payload })
      : await create.mutateAsync(payload)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Booking" : "New Booking"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Booking Number</Label>
                <Input {...form.register("bookingNumber")} placeholder="BK-2501-1234" />
                {form.formState.errors.bookingNumber && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bookingNumber.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as BookingFormValues["status"])
                  }
                  items={BOOKING_STATUSES}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sell Currency</Label>
                <CurrencyCombobox
                  value={form.watch("sellCurrency") || null}
                  onChange={(next) =>
                    form.setValue("sellCurrency", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Travel Dates</Label>
                <DateRangePicker
                  value={{
                    from: form.watch("startDate") || null,
                    to: form.watch("endDate") || null,
                  }}
                  onChange={(nextValue) => {
                    form.setValue("startDate", nextValue?.from ?? "", { shouldDirty: true })
                    form.setValue("endDate", nextValue?.to ?? "", { shouldDirty: true })
                  }}
                  placeholder="Pick travel dates"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sell Amount (cents)</Label>
                <Input {...form.register("sellAmountCents")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Cost Amount (cents)</Label>
                <Input {...form.register("costAmountCents")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Travelers (Pax)</Label>
                <Input {...form.register("pax")} type="number" min="1" placeholder="2" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Internal Notes</Label>
              <Textarea
                {...form.register("internalNotes")}
                placeholder="Private operations notes..."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
