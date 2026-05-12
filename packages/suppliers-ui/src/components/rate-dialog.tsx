"use client"

import { RATE_UNITS, type SupplierRate, useSupplierRateMutation } from "@voyantjs/suppliers-react"
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
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"

function getRateSchema(messages: ReturnType<typeof useSuppliersUiMessagesOrDefault>) {
  const dialog = messages.dialogs.rate
  return z.object({
    name: z.string().min(1, dialog.validationNameRequired),
    currency: z.string().min(3, dialog.validationIsoCurrency).max(3, dialog.validationIsoCurrency),
    amount: z.coerce.number().min(0, dialog.validationNonNegative),
    unit: z.enum(["per_person", "per_group", "per_night", "per_vehicle", "flat"]),
    validFrom: z.string().optional().nullable(),
    validTo: z.string().optional().nullable(),
    minPax: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
    maxPax: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
    notes: z.string().optional().nullable(),
  })
}

export type RateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  serviceId: string
  rate?: SupplierRate
  onSuccess?: (rate: SupplierRate) => void
}

export function RateDialog({
  open,
  onOpenChange,
  supplierId,
  serviceId,
  rate,
  onSuccess,
}: RateDialogProps) {
  const messages = useSuppliersUiMessagesOrDefault()
  const dialog = messages.dialogs.rate
  const schema = React.useMemo(() => getRateSchema(messages), [messages])
  const rateMutation = useSupplierRateMutation(supplierId)
  const isEditing = !!rate

  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      currency: "EUR",
      amount: 0,
      unit: "per_person",
      validFrom: "",
      validTo: "",
      minPax: "",
      maxPax: "",
      notes: "",
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      name: rate?.name ?? "",
      currency: rate?.currency ?? "EUR",
      amount: rate ? rate.amountCents / 100 : 0,
      unit: rate?.unit ?? "per_person",
      validFrom: rate?.validFrom ?? "",
      validTo: rate?.validTo ?? "",
      minPax: rate?.minPax ?? "",
      maxPax: rate?.maxPax ?? "",
      notes: rate?.notes ?? "",
    })
  }, [form, open, rate])

  async function onSubmit(values: z.output<typeof schema>) {
    const input = {
      name: values.name,
      currency: values.currency.toUpperCase(),
      amountCents: Math.round(values.amount * 100),
      unit: values.unit,
      validFrom: values.validFrom || null,
      validTo: values.validTo || null,
      minPax: values.minPax && typeof values.minPax === "number" ? values.minPax : null,
      maxPax: values.maxPax && typeof values.maxPax === "number" ? values.maxPax : null,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await rateMutation.update.mutateAsync({ serviceId, rateId: rate.id, input })
      : await rateMutation.create.mutateAsync({ serviceId, input })
    onSuccess?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? dialog.editTitle : dialog.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <Field label={dialog.seasonNameLabel} error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} placeholder={dialog.seasonNamePlaceholder} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={dialog.currencyLabel} error={form.formState.errors.currency?.message}>
                <Input
                  {...form.register("currency")}
                  maxLength={3}
                  placeholder={dialog.currencyPlaceholder}
                  className="uppercase"
                />
              </Field>
              <Field label={dialog.amountLabel} error={form.formState.errors.amount?.message}>
                <Input
                  {...form.register("amount")}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={dialog.amountPlaceholder}
                />
              </Field>
              <div className="flex flex-col gap-2">
                <Label>{dialog.unitLabel}</Label>
                <Select
                  value={form.watch("unit")}
                  onValueChange={(value) =>
                    form.setValue("unit", value as z.input<typeof schema>["unit"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RATE_UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {messages.common.rateUnitLabels[unit.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dialog.validFromLabel}>
                <DatePicker
                  value={form.watch("validFrom") || null}
                  onChange={(nextValue) =>
                    form.setValue("validFrom", nextValue ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </Field>
              <Field label={dialog.validToLabel}>
                <DatePicker
                  value={form.watch("validTo") || null}
                  onChange={(nextValue) =>
                    form.setValue("validTo", nextValue ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dialog.minPaxLabel}>
                <Input
                  {...form.register("minPax")}
                  type="number"
                  min="1"
                  placeholder={dialog.minPaxPlaceholder}
                />
              </Field>
              <Field label={dialog.maxPaxLabel}>
                <Input
                  {...form.register("maxPax")}
                  type="number"
                  min="1"
                  placeholder={dialog.maxPaxPlaceholder}
                />
              </Field>
            </div>
            <Field label={dialog.notesLabel}>
              <Textarea {...form.register("notes")} placeholder={dialog.notesPlaceholder} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {isEditing ? messages.common.save : messages.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
