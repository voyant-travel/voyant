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
  Textarea,
} from "@voyantjs/ui/components"
import { CountryCombobox } from "@voyantjs/ui/components/country-combobox"
import { PhoneInput } from "@voyantjs/ui/components/phone-input"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

const billingFormSchema = z.object({
  contactFirstName: z.string().max(255).optional().nullable(),
  contactLastName: z.string().max(255).optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal("")),
  contactPhone: z.string().max(50).optional().nullable(),
  contactAddressLine1: z.string().max(500).optional().nullable(),
  contactAddressLine2: z.string().max(500).optional().nullable(),
  contactCity: z.string().max(100).optional().nullable(),
  contactRegion: z.string().max(100).optional().nullable(),
  contactPostalCode: z.string().max(20).optional().nullable(),
  contactCountry: z.string().max(2).optional().nullable(),
})

type BillingFormValues = z.input<typeof billingFormSchema>
type BillingFormOutput = z.output<typeof billingFormSchema>

export interface BookingBillingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: BookingRecord
  onSuccess?: () => void
}

/**
 * Edit the billing-contact snapshot on a booking. The snapshot is the
 * source of truth for the detail-page billing card and for downstream
 * invoice / document generation — when an operator's data correction
 * needs to land on documents without modifying the CRM person record,
 * this is the dialog they reach for.
 */
export function BookingBillingDialog({
  open,
  onOpenChange,
  booking,
  onSuccess,
}: BookingBillingDialogProps) {
  const { update } = useBookingMutation()
  const messages = useBookingsUiMessagesOrDefault().bookingBillingDialog

  const form = useForm<BillingFormValues, unknown, BillingFormOutput>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      contactFirstName: booking.contactFirstName ?? "",
      contactLastName: booking.contactLastName ?? "",
      contactEmail: booking.contactEmail ?? "",
      contactPhone: booking.contactPhone ?? "",
      contactAddressLine1: booking.contactAddressLine1 ?? "",
      contactAddressLine2: booking.contactAddressLine2 ?? "",
      contactCity: booking.contactCity ?? "",
      contactRegion: booking.contactRegion ?? "",
      contactPostalCode: booking.contactPostalCode ?? "",
      contactCountry: booking.contactCountry ?? "",
    },
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment
  useEffect(() => {
    // `form` is intentionally omitted — react-hook-form returns a fresh
    // wrapper object each render even though the store is in a ref, so
    // including it would re-fire on every render. Resetting from the
    // latest booking snapshot when the dialog opens is sufficient.
    if (open) {
      form.reset({
        contactFirstName: booking.contactFirstName ?? "",
        contactLastName: booking.contactLastName ?? "",
        contactEmail: booking.contactEmail ?? "",
        contactPhone: booking.contactPhone ?? "",
        contactAddressLine1: booking.contactAddressLine1 ?? "",
        contactAddressLine2: booking.contactAddressLine2 ?? "",
        contactCity: booking.contactCity ?? "",
        contactRegion: booking.contactRegion ?? "",
        contactPostalCode: booking.contactPostalCode ?? "",
        contactCountry: booking.contactCountry ?? "",
      })
    }
  }, [open, booking])

  const onSubmit = async (values: BillingFormOutput) => {
    await update.mutateAsync({
      id: booking.id,
      input: {
        contactFirstName: values.contactFirstName?.trim() || null,
        contactLastName: values.contactLastName?.trim() || null,
        contactEmail: values.contactEmail?.trim() || null,
        contactPhone: values.contactPhone?.trim() || null,
        contactAddressLine1: values.contactAddressLine1?.trim() || null,
        contactAddressLine2: values.contactAddressLine2?.trim() || null,
        contactCity: values.contactCity?.trim() || null,
        contactRegion: values.contactRegion?.trim() || null,
        contactPostalCode: values.contactPostalCode?.trim() || null,
        contactCountry: values.contactCountry?.trim() || null,
      },
    })
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{messages.title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{messages.fields.firstName}</Label>
                <Input {...form.register("contactFirstName")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.fields.lastName}</Label>
                <Input {...form.register("contactLastName")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.fields.email}</Label>
                <Input type="email" {...form.register("contactEmail")} />
                {form.formState.errors.contactEmail ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.contactEmail.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.fields.phone}</Label>
                <PhoneInput
                  value={form.watch("contactPhone") ?? ""}
                  onChange={(next) => form.setValue("contactPhone", next, { shouldDirty: true })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.fields.addressLine1}</Label>
                <Textarea rows={2} {...form.register("contactAddressLine1")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.fields.addressLine2}</Label>
                <Textarea rows={2} {...form.register("contactAddressLine2")} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.fields.city}</Label>
                <Input {...form.register("contactCity")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.fields.region}</Label>
                <Input {...form.register("contactRegion")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.fields.postalCode}</Label>
                <Input {...form.register("contactPostalCode")} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.fields.country}</Label>
              <CountryCombobox
                value={form.watch("contactCountry") || null}
                onChange={(next) =>
                  form.setValue("contactCountry", next ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.actions.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {messages.actions.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
