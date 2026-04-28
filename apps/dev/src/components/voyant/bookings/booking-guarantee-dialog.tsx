"use client"

import { type BookingGuaranteeRecord, useBookingGuaranteeMutation } from "@voyantjs/finance-react"
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
import { DateTimePicker } from "@voyantjs/ui/components/date-time-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const guaranteeTypes = [
  "deposit",
  "credit_card",
  "preauth",
  "card_on_file",
  "bank_transfer",
  "voucher",
  "agency_letter",
  "other",
] as const

const guaranteeStatuses = [
  "pending",
  "active",
  "released",
  "failed",
  "cancelled",
  "expired",
] as const

const guaranteeFormSchema = z.object({
  guaranteeType: z.enum(guaranteeTypes),
  status: z.enum(guaranteeStatuses).default("pending"),
  currency: z.string().min(3).max(3).optional().nullable(),
  amountCents: z.coerce.number().int().min(0).optional().nullable(),
  provider: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type GuaranteeFormValues = z.input<typeof guaranteeFormSchema>
type GuaranteeFormOutput = z.output<typeof guaranteeFormSchema>

export interface BookingGuaranteeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  guarantee?: BookingGuaranteeRecord
  onSuccess?: () => void
}

export function BookingGuaranteeDialog({
  open,
  onOpenChange,
  bookingId,
  guarantee,
  onSuccess,
}: BookingGuaranteeDialogProps) {
  const isEditing = Boolean(guarantee)
  const { create, update } = useBookingGuaranteeMutation(bookingId)

  const form = useForm<GuaranteeFormValues, unknown, GuaranteeFormOutput>({
    resolver: zodResolver(guaranteeFormSchema),
    defaultValues: {
      guaranteeType: "deposit",
      status: "pending",
      currency: "EUR",
      amountCents: null,
      provider: "",
      referenceNumber: "",
      expiresAt: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && guarantee) {
      form.reset({
        guaranteeType: guarantee.guaranteeType,
        status: guarantee.status,
        currency: guarantee.currency,
        amountCents: guarantee.amountCents,
        provider: guarantee.provider ?? "",
        referenceNumber: guarantee.referenceNumber ?? "",
        expiresAt: guarantee.expiresAt ? guarantee.expiresAt.slice(0, 16) : "",
        notes: guarantee.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, guarantee])

  const onSubmit = async (values: GuaranteeFormOutput) => {
    const payload = {
      guaranteeType: values.guaranteeType,
      status: values.status,
      currency: values.currency || null,
      amountCents: values.amountCents ?? null,
      provider: values.provider || null,
      referenceNumber: values.referenceNumber || null,
      expiresAt: values.expiresAt || null,
      notes: values.notes || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: guarantee!.id, input: payload })
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
          <DialogTitle>{isEditing ? "Edit Guarantee" : "Add Guarantee"}</DialogTitle>
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
                  items={guaranteeTypes.map((t) => ({ label: t.replace(/_/g, " "), value: t }))}
                  value={form.watch("guaranteeType")}
                  onValueChange={(v) =>
                    form.setValue(
                      "guaranteeType",
                      (v ?? "deposit") as (typeof guaranteeTypes)[number],
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {guaranteeTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={guaranteeStatuses.map((s) => ({ label: s.replace(/_/g, " "), value: s }))}
                  value={form.watch("status")}
                  onValueChange={(v) =>
                    form.setValue("status", (v ?? "pending") as (typeof guaranteeStatuses)[number])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {guaranteeStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Provider</Label>
                <Input {...form.register("provider")} placeholder="Stripe, bank name..." />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Reference Number</Label>
                <Input {...form.register("referenceNumber")} placeholder="External reference..." />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Expires At</Label>
              <DateTimePicker
                value={form.watch("expiresAt") || null}
                onChange={(next) =>
                  form.setValue("expiresAt", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder="Select expiry date & time"
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} placeholder="Guarantee notes..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Guarantee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
