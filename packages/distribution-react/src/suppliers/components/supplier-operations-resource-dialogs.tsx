"use client"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"
import {
  SUPPLIER_CONTRACT_STATUSES,
  type SupplierContract,
  useSupplierAvailabilityMutation,
  useSupplierContractMutation,
} from "../index.js"
import {
  DialogActions,
  Field,
  nullableString,
  SelectField,
  SwitchField,
} from "./supplier-resource-dialog-fields.js"

export function AvailabilityDialog({
  open,
  onOpenChange,
  supplierId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  onSuccess: () => void
}) {
  const messages = useSuppliersUiMessagesOrDefault()
  const dialog = messages.dialogs.availability
  const mutation = useSupplierAvailabilityMutation(supplierId)
  const schema = React.useMemo(
    () =>
      z.object({
        date: z.string().min(1, dialog.validationDateRequired),
        available: z.boolean().default(true),
        notes: z.string().optional().nullable(),
      }),
    [dialog.validationDateRequired],
  )
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { date: "", available: true, notes: "" },
  })

  React.useEffect(() => {
    if (open) form.reset({ date: "", available: true, notes: "" })
  }, [form, open])

  async function onSubmit(values: z.output<typeof schema>) {
    await mutation.upsert.mutateAsync({
      date: values.date,
      available: values.available,
      notes: nullableString(values.notes),
    })
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog.newTitle}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <Field label={dialog.dateLabel} error={form.formState.errors.date?.message}>
              <Input {...form.register("date")} type="date" />
            </Field>
            <SwitchField
              label={dialog.availableLabel}
              checked={form.watch("available") ?? false}
              onCheckedChange={(value) => form.setValue("available", value)}
            />
            <Field label={dialog.notesLabel}>
              <Textarea {...form.register("notes")} placeholder={dialog.notesPlaceholder} />
            </Field>
          </DialogBody>
          <DialogActions
            isSubmitting={form.formState.isSubmitting}
            isEditing={false}
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ContractDialog({
  open,
  onOpenChange,
  supplierId,
  contract,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  contract?: SupplierContract
  onSuccess: () => void
}) {
  const messages = useSuppliersUiMessagesOrDefault()
  const dialog = messages.dialogs.contract
  const mutation = useSupplierContractMutation(supplierId)
  const schema = React.useMemo(
    () =>
      z.object({
        agreementNumber: z.string().optional().nullable(),
        startDate: z.string().min(1, dialog.validationStartDateRequired),
        endDate: z.string().optional().nullable(),
        renewalDate: z.string().optional().nullable(),
        status: z.enum(["active", "expired", "pending", "terminated"]),
        terms: z.string().optional().nullable(),
      }),
    [dialog.validationStartDateRequired],
  )
  const isEditing = !!contract
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      agreementNumber: "",
      startDate: "",
      endDate: "",
      renewalDate: "",
      status: "active",
      terms: "",
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      agreementNumber: contract?.agreementNumber ?? "",
      startDate: contract?.startDate ?? "",
      endDate: contract?.endDate ?? "",
      renewalDate: contract?.renewalDate ?? "",
      status: contract?.status ?? "active",
      terms: contract?.terms ?? "",
    })
  }, [contract, form, open])

  async function onSubmit(values: z.output<typeof schema>) {
    const input = {
      agreementNumber: nullableString(values.agreementNumber),
      startDate: values.startDate,
      endDate: nullableString(values.endDate),
      renewalDate: nullableString(values.renewalDate),
      status: values.status,
      terms: nullableString(values.terms),
    }
    if (isEditing) {
      await mutation.update.mutateAsync({ contractId: contract.id, input })
    } else {
      await mutation.create.mutateAsync(input)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? dialog.editTitle : dialog.newTitle}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <Field label={dialog.agreementNumberLabel}>
              <Input
                {...form.register("agreementNumber")}
                placeholder={dialog.agreementNumberPlaceholder}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={dialog.startDateLabel} error={form.formState.errors.startDate?.message}>
                <Input {...form.register("startDate")} type="date" />
              </Field>
              <Field label={dialog.endDateLabel}>
                <Input {...form.register("endDate")} type="date" />
              </Field>
              <Field label={dialog.renewalDateLabel}>
                <Input {...form.register("renewalDate")} type="date" />
              </Field>
            </div>
            <SelectField
              label={dialog.statusLabel}
              value={form.watch("status")}
              onValueChange={(value) =>
                form.setValue("status", value as z.input<typeof schema>["status"])
              }
              options={SUPPLIER_CONTRACT_STATUSES.map((status) => ({
                value: status.value,
                label: messages.common.contractStatusLabels[status.value],
              }))}
            />
            <Field label={dialog.termsLabel}>
              <Textarea {...form.register("terms")} placeholder={dialog.termsPlaceholder} />
            </Field>
          </DialogBody>
          <DialogActions
            isSubmitting={form.formState.isSubmitting}
            isEditing={isEditing}
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
