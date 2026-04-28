"use client"

import {
  type BookingSupplierStatusRecord,
  useSupplierStatusMutation,
} from "@voyantjs/bookings-react"
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
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

export interface SupplierStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  supplierStatus?: BookingSupplierStatusRecord
  onSuccess?: () => void
}

export function SupplierStatusDialog({
  open,
  onOpenChange,
  bookingId,
  supplierStatus,
  onSuccess,
}: SupplierStatusDialogProps) {
  const supplierMessages = useAdminMessages().bookings.detail.supplierDialog
  const isEditing = Boolean(supplierStatus)
  const { create, update } = useSupplierStatusMutation(bookingId)

  const supplierStatusFormSchema = z.object({
    serviceName: z.string().min(1, supplierMessages.validationServiceNameRequired),
    status: z.enum(["pending", "confirmed", "rejected", "cancelled"]),
    supplierReference: z.string().optional().nullable(),
    costCurrency: z.string().min(3).max(3, supplierMessages.validationCostCurrency),
    costAmountCents: z.coerce.number().int().min(0),
    notes: z.string().optional().nullable(),
  })

  type SupplierStatusFormValues = z.input<typeof supplierStatusFormSchema>
  type SupplierStatusFormOutput = z.output<typeof supplierStatusFormSchema>

  const CONFIRMATION_STATUSES = [
    { value: "pending", label: supplierMessages.statusPending },
    { value: "confirmed", label: supplierMessages.statusConfirmed },
    { value: "rejected", label: supplierMessages.statusRejected },
    { value: "cancelled", label: supplierMessages.statusCancelled },
  ] as const

  const form = useForm<SupplierStatusFormValues, unknown, SupplierStatusFormOutput>({
    resolver: zodResolver(supplierStatusFormSchema),
    defaultValues: {
      serviceName: "",
      status: "pending",
      supplierReference: "",
      costCurrency: "EUR",
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
            {isEditing ? supplierMessages.editTitle : supplierMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{supplierMessages.serviceNameLabel}</Label>
                <Input
                  {...form.register("serviceName")}
                  placeholder={supplierMessages.serviceNamePlaceholder}
                  disabled={isEditing}
                />
                {form.formState.errors.serviceName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.serviceName.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{supplierMessages.statusLabel}</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as SupplierStatusFormValues["status"])
                  }
                  items={CONFIRMATION_STATUSES}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIRMATION_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{supplierMessages.costCurrencyLabel}</Label>
                <CurrencyCombobox
                  value={form.watch("costCurrency") || null}
                  onChange={(next) =>
                    form.setValue("costCurrency", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{supplierMessages.costAmountLabel}</Label>
                <Input
                  {...form.register("costAmountCents", { valueAsNumber: true })}
                  type="number"
                  min="0"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{supplierMessages.supplierReferenceLabel}</Label>
                <Input
                  {...form.register("supplierReference")}
                  placeholder={supplierMessages.supplierReferencePlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{supplierMessages.notesLabel}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={supplierMessages.notesPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {supplierMessages.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? supplierMessages.saveChanges : supplierMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
