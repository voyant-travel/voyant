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
import { useAdminMessages } from "@/lib/admin-i18n"
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
  const guaranteeMessages = useAdminMessages().bookings.detail.guaranteeDialog
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
          <DialogTitle>
            {isEditing ? guaranteeMessages.editTitle : guaranteeMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{guaranteeMessages.typeLabel}</Label>
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
                        {t === "deposit"
                          ? guaranteeMessages.typeDeposit
                          : t === "credit_card"
                            ? guaranteeMessages.typeCreditCard
                            : t === "preauth"
                              ? guaranteeMessages.typePreauth
                              : t === "card_on_file"
                                ? guaranteeMessages.typeCardOnFile
                                : t === "bank_transfer"
                                  ? guaranteeMessages.typeBankTransfer
                                  : t === "voucher"
                                    ? guaranteeMessages.typeVoucher
                                    : t === "agency_letter"
                                      ? guaranteeMessages.typeAgencyLetter
                                      : guaranteeMessages.typeOther}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{guaranteeMessages.statusLabel}</Label>
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
                        {s === "pending"
                          ? guaranteeMessages.statusPending
                          : s === "active"
                            ? guaranteeMessages.statusActive
                            : s === "released"
                              ? guaranteeMessages.statusReleased
                              : s === "failed"
                                ? guaranteeMessages.statusFailed
                                : s === "cancelled"
                                  ? guaranteeMessages.statusCancelled
                                  : guaranteeMessages.statusExpired}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{guaranteeMessages.currencyLabel}</Label>
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
                <Label>{guaranteeMessages.amountLabel}</Label>
                <Input {...form.register("amountCents")} type="number" min={0} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{guaranteeMessages.providerLabel}</Label>
                <Input
                  {...form.register("provider")}
                  placeholder={guaranteeMessages.providerPlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{guaranteeMessages.referenceLabel}</Label>
                <Input
                  {...form.register("referenceNumber")}
                  placeholder={guaranteeMessages.referencePlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{guaranteeMessages.expiresAtLabel}</Label>
              <DateTimePicker
                value={form.watch("expiresAt") || null}
                onChange={(next) =>
                  form.setValue("expiresAt", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder={guaranteeMessages.expiresAtPlaceholder}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{guaranteeMessages.notesLabel}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={guaranteeMessages.notesPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {guaranteeMessages.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? guaranteeMessages.saveChanges : guaranteeMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
