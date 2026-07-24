"use client"

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod/v4"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"
import { RATE_UNITS, type SupplierRate, useSupplierRateMutation } from "../index.js"
import { getRateSchema } from "./supplier-form-validation.js"

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? dialog.editTitle : dialog.newTitle}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <Field label={dialog.seasonNameLabel} error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} placeholder={dialog.seasonNamePlaceholder} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={dialog.currencyLabel} error={form.formState.errors.currency?.message}>
                <CurrencyCombobox
                  value={form.watch("currency") || null}
                  onChange={(next) =>
                    form.setValue("currency", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.currencyPlaceholder}
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
              <Field label={dialog.validFromLabel} error={form.formState.errors.validFrom?.message}>
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
              <Field label={dialog.validToLabel} error={form.formState.errors.validTo?.message}>
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
              <Field label={dialog.minPaxLabel} error={form.formState.errors.minPax?.message}>
                <Input
                  {...form.register("minPax")}
                  type="number"
                  min="1"
                  placeholder={dialog.minPaxPlaceholder}
                />
              </Field>
              <Field label={dialog.maxPaxLabel} error={form.formState.errors.maxPax?.message}>
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
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {isEditing ? messages.common.save : messages.common.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
