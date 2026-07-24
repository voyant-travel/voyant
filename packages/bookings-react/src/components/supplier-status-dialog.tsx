"use client"

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
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { CurrencyInput } from "@voyant-travel/ui/components/currency-input"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { type BookingSupplierStatusRecord, useSupplierStatusMutation } from "../index.js"

function createSupplierStatusFormSchema(
  messages: ReturnType<typeof useBookingsUiMessagesOrDefault>,
) {
  return z.object({
    serviceName: z.string().min(1, messages.supplierStatusDialog.validation.serviceNameRequired),
    status: z.enum(["pending", "confirmed", "rejected", "cancelled"]),
    supplierReference: z.string().optional().nullable(),
    costCurrency: z
      .string()
      .min(3)
      .max(3, messages.supplierStatusDialog.validation.costCurrencyInvalid),
    costAmountCents: z.coerce.number().int().min(0),
    notes: z.string().optional().nullable(),
  })
}

type SupplierStatusFormValues = z.input<ReturnType<typeof createSupplierStatusFormSchema>>
type SupplierStatusFormOutput = z.output<ReturnType<typeof createSupplierStatusFormSchema>>

export interface SupplierStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  supplierStatus?: BookingSupplierStatusRecord
  onSuccess?: () => void
}

const CONFIRMATION_STATUSES = [
  { value: "pending" },
  { value: "confirmed" },
  { value: "rejected" },
  { value: "cancelled" },
] as const
const DEFAULT_CURRENCY = "EUR" // i18n-literal-ok ISO default currency

export function SupplierStatusDialog({
  open,
  onOpenChange,
  bookingId,
  supplierStatus,
  onSuccess,
}: SupplierStatusDialogProps) {
  const isEditing = Boolean(supplierStatus)
  const { create, update } = useSupplierStatusMutation(bookingId)
  const messages = useBookingsUiMessagesOrDefault()
  const supplierStatusFormSchema = createSupplierStatusFormSchema(messages)
  const statusItems = useMemo(
    () =>
      CONFIRMATION_STATUSES.map((s) => ({
        value: s.value,
        label: messages.common.supplierStatusLabels[s.value],
      })),
    [messages.common.supplierStatusLabels],
  )

  const form = useForm<SupplierStatusFormValues, unknown, SupplierStatusFormOutput>({
    resolver: zodResolver(supplierStatusFormSchema),
    defaultValues: {
      serviceName: "",
      status: "pending",
      supplierReference: "",
      costCurrency: DEFAULT_CURRENCY,
      costAmountCents: 0,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && supplierStatus) {
      form.reset({
        serviceName: supplierStatus.serviceName,
        status: supplierStatus.status,
        supplierReference: supplierStatus.supplierReference ?? "",
        costCurrency: supplierStatus.costCurrency,
        costAmountCents: supplierStatus.costAmountCents,
        notes: supplierStatus.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, supplierStatus])

  const onSubmit = async (values: SupplierStatusFormOutput) => {
    const payload = {
      serviceName: values.serviceName,
      status: values.status,
      supplierReference: values.supplierReference || null,
      costCurrency: values.costCurrency,
      costAmountCents: values.costAmountCents,
      notes: values.notes || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: supplierStatus!.id, input: payload })
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
              ? messages.supplierStatusDialog.titles.edit
              : messages.supplierStatusDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierStatusDialog.fields.serviceName}</Label>
                <Input
                  {...form.register("serviceName")}
                  placeholder={messages.supplierStatusDialog.placeholders.serviceName}
                  disabled={isEditing}
                />
                {form.formState.errors.serviceName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.serviceName.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{messages.supplierStatusDialog.fields.status}</Label>
                <Select
                  items={statusItems}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as SupplierStatusFormValues["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIRMATION_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {messages.common.supplierStatusLabels[status.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierStatusDialog.fields.costCurrency}</Label>
                <CurrencyCombobox
                  value={form.watch("costCurrency") || null}
                  onChange={(next) =>
                    form.setValue("costCurrency", next ?? DEFAULT_CURRENCY, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierStatusDialog.fields.costAmountCents}</Label>
                <CurrencyInput
                  value={form.watch("costAmountCents") as number}
                  onChange={(next) =>
                    form.setValue("costAmountCents", next ?? 0, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  currency={form.watch("costCurrency")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierStatusDialog.fields.supplierReference}</Label>
                <Input
                  {...form.register("supplierReference")}
                  placeholder={messages.supplierStatusDialog.placeholders.supplierReference}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.supplierStatusDialog.fields.notes}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={messages.supplierStatusDialog.placeholders.notes}
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
                : messages.supplierStatusDialog.actions.addSupplierStatus}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
