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
import { CurrencyInput } from "@voyantjs/ui/components/currency-input"
import { DateRangePicker } from "@voyantjs/ui/components/date-picker"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

import { BookingCreateDialog } from "./booking-create-dialog.js"

function createBookingFormSchema(messages: ReturnType<typeof useBookingsUiMessagesOrDefault>) {
  return z.object({
    bookingNumber: z.string().min(1, messages.bookingDialog.validation.bookingNumberRequired),
    status: z.enum([
      "draft",
      "on_hold",
      "awaiting_payment",
      "confirmed",
      "in_progress",
      "completed",
      "expired",
      "cancelled",
    ]),
    sellCurrency: z.string().min(3).max(3, messages.bookingDialog.validation.sellCurrencyInvalid),
    sellAmountCents: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    costAmountCents: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    pax: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
    internalNotes: z.string().optional().nullable(),
  })
}

type BookingFormValues = z.input<ReturnType<typeof createBookingFormSchema>>
type BookingFormOutput = z.output<ReturnType<typeof createBookingFormSchema>>

export interface BookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking?: BookingRecord
  onSuccess?: (booking: BookingRecord) => void
  /**
   * Pre-seeds the product picker in create mode. Useful when opened from
   * a product detail page. Ignored when editing an existing booking.
   */
  defaultProductId?: string
}

const BOOKING_STATUS_VALUES = [
  "draft",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const
const DEFAULT_CURRENCY = "EUR" // i18n-literal-ok ISO default currency

/**
 * Single booking dialog that handles both create and edit:
 * - Create (no `booking` prop): renders the rich product → option → person
 *   picker flow via `BookingCreateDialog`, so the draft booking inherits
 *   pricing, dates, and currency from the catalogue instead of being
 *   hand-entered.
 * - Edit (with `booking` prop): renders the flat form below that patches
 *   the existing row's metadata (status, amounts, dates, notes).
 */
export function BookingDialog({
  open,
  onOpenChange,
  booking,
  onSuccess,
  defaultProductId,
}: BookingDialogProps) {
  if (!booking) {
    return (
      <BookingCreateDialog
        open={open}
        onOpenChange={onOpenChange}
        defaultProductId={defaultProductId}
        onCreated={onSuccess}
      />
    )
  }

  return (
    <BookingEditDialog
      open={open}
      onOpenChange={onOpenChange}
      booking={booking}
      onSuccess={onSuccess}
    />
  )
}

interface BookingEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: BookingRecord
  onSuccess?: (booking: BookingRecord) => void
}

function BookingEditDialog({ open, onOpenChange, booking, onSuccess }: BookingEditDialogProps) {
  const { update } = useBookingMutation()
  const messages = useBookingsUiMessagesOrDefault()
  const bookingFormSchema = createBookingFormSchema(messages)

  const form = useForm<BookingFormValues, unknown, BookingFormOutput>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      bookingNumber: "",
      status: "draft",
      sellCurrency: DEFAULT_CURRENCY,
      sellAmountCents: "",
      costAmountCents: "",
      startDate: "",
      endDate: "",
      pax: "",
      internalNotes: "",
    },
  })

  useEffect(() => {
    if (!open) return
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
  }, [booking, form, open])

  const onSubmit = async (values: BookingFormOutput) => {
    const payload = {
      bookingNumber: values.bookingNumber,
      status: values.status,
      sellCurrency: values.sellCurrency,
      sellAmountCents: typeof values.sellAmountCents === "number" ? values.sellAmountCents : null,
      costAmountCents: typeof values.costAmountCents === "number" ? values.costAmountCents : null,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      pax: values.pax && typeof values.pax === "number" ? values.pax : null,
      internalNotes: values.internalNotes || null,
    }

    const saved = await update.mutateAsync({ id: booking.id, input: payload })

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{messages.bookingDialog.editTitle}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.bookingDialog.fields.bookingNumber}</Label>
                <Input
                  {...form.register("bookingNumber")}
                  placeholder={messages.bookingDialog.placeholders.bookingNumber}
                />
                {form.formState.errors.bookingNumber && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bookingNumber.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{messages.bookingDialog.fields.status}</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as BookingFormValues["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_STATUS_VALUES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {messages.common.bookingStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.bookingDialog.fields.sellCurrency}</Label>
                <CurrencyCombobox
                  value={form.watch("sellCurrency") || null}
                  onChange={(next) =>
                    form.setValue("sellCurrency", next ?? DEFAULT_CURRENCY, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.bookingDialog.fields.travelDates}</Label>
                <DateRangePicker
                  value={{
                    from: form.watch("startDate") || null,
                    to: form.watch("endDate") || null,
                  }}
                  onChange={(nextValue) => {
                    form.setValue("startDate", nextValue?.from ?? "", { shouldDirty: true })
                    form.setValue("endDate", nextValue?.to ?? "", { shouldDirty: true })
                  }}
                  placeholder={messages.bookingDialog.placeholders.travelDates}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.bookingDialog.fields.sellAmountCents}</Label>
                <CurrencyInput
                  value={
                    typeof form.watch("sellAmountCents") === "number"
                      ? (form.watch("sellAmountCents") as number)
                      : null
                  }
                  onChange={(next) =>
                    form.setValue("sellAmountCents", next, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  currency={form.watch("sellCurrency")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.bookingDialog.fields.costAmountCents}</Label>
                <CurrencyInput
                  value={
                    typeof form.watch("costAmountCents") === "number"
                      ? (form.watch("costAmountCents") as number)
                      : null
                  }
                  onChange={(next) =>
                    form.setValue("costAmountCents", next, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  currency={form.watch("sellCurrency")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.bookingDialog.fields.pax}</Label>
                <Input
                  {...form.register("pax")}
                  type="number"
                  min="1"
                  placeholder={messages.bookingDialog.placeholders.pax}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.bookingDialog.fields.internalNotes}</Label>
              <Textarea
                {...form.register("internalNotes")}
                placeholder={messages.bookingDialog.placeholders.internalNotes}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {messages.common.saveChanges}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
