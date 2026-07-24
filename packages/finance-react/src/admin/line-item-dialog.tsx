"use client"

import { type OperatorAdminMessages, useOperatorAdminMessages } from "@voyant-travel/admin"
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
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { type LineItemRecord, useInvoiceLineItemMutation } from "../index.js"

function getLineItemFormSchema(messages: OperatorAdminMessages) {
  return z.object({
    description: z.string().min(1, messages.finance.lineItemDialog.validationDescriptionRequired),
    quantity: z.coerce.number().int().min(1).default(1),
    unitPriceCents: z.coerce.number().int().min(0),
    totalCents: z.coerce.number().int().min(0),
    taxRate: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
}

type LineItemFormValues = z.input<ReturnType<typeof getLineItemFormSchema>>
type LineItemFormOutput = z.output<ReturnType<typeof getLineItemFormSchema>>

export interface LineItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  lineItem?: LineItemRecord
  onSuccess?: (lineItem: LineItemRecord) => void
}

export function LineItemDialog({
  open,
  onOpenChange,
  invoiceId,
  lineItem,
  onSuccess,
}: LineItemDialogProps) {
  const messages = useOperatorAdminMessages()
  const isEditing = Boolean(lineItem)
  const { create, update } = useInvoiceLineItemMutation(invoiceId)
  const lineItemFormSchema = useMemo(() => getLineItemFormSchema(messages), [messages])
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<LineItemFormValues, unknown, LineItemFormOutput>({
    resolver: zodResolver(lineItemFormSchema),
    defaultValues: {
      description: "",
      quantity: 1,
      unitPriceCents: 0,
      totalCents: 0,
      taxRate: "",
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && lineItem) {
      form.reset({
        description: lineItem.description,
        quantity: lineItem.quantity,
        unitPriceCents: lineItem.unitPriceCents,
        totalCents: lineItem.totalCents,
        taxRate: lineItem.taxRate ?? "",
        sortOrder: lineItem.sortOrder,
      })
    } else if (open) {
      form.reset({
        description: "",
        quantity: 1,
        unitPriceCents: 0,
        totalCents: 0,
        taxRate: "",
        sortOrder: 0,
      })
    }
  }, [open, lineItem, form])

  const onSubmit = async (values: LineItemFormOutput) => {
    setSubmitError(null)
    const payload = {
      description: values.description,
      quantity: values.quantity,
      unitPriceCents: values.unitPriceCents,
      totalCents: values.totalCents,
      taxRate:
        values.taxRate !== "" && values.taxRate != null && typeof values.taxRate === "number"
          ? values.taxRate
          : null,
      sortOrder: values.sortOrder,
    }

    let saved: LineItemRecord
    try {
      saved = isEditing
        ? await update.mutateAsync({ id: lineItem!.id, input: payload })
        : await create.mutateAsync(payload)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : messages.finance.lineItemDialog.saveFailed,
      )
      return
    }

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.finance.lineItemDialog.editTitle
              : messages.finance.lineItemDialog.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            {submitError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                {submitError}
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label>{messages.finance.lineItemDialog.descriptionLabel}</Label>
              <Input
                {...form.register("description")}
                placeholder={messages.finance.lineItemDialog.descriptionPlaceholder}
              />
              {form.formState.errors.description ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.description.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.lineItemDialog.quantityLabel}</Label>
                <Input {...form.register("quantity")} type="number" min="1" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.lineItemDialog.unitPriceLabel}</Label>
                <Input {...form.register("unitPriceCents")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.lineItemDialog.totalLabel}</Label>
                <Input {...form.register("totalCents")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.lineItemDialog.taxRateLabel}</Label>
                <Input
                  {...form.register("taxRate")}
                  type="number"
                  min="0"
                  placeholder={messages.finance.lineItemDialog.taxRatePlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.lineItemDialog.sortOrderLabel}</Label>
                <Input {...form.register("sortOrder")} type="number" min="0" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.finance.lineItemDialog.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing
                ? messages.finance.lineItemDialog.saveChanges
                : messages.finance.lineItemDialog.createLineItem}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
