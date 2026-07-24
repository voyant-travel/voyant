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
  Textarea,
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useInvoiceCreditNoteMutation } from "../index.js"

function getCreditNoteFormSchema(messages: OperatorAdminMessages) {
  return z.object({
    creditNoteNumber: z.string().min(1, messages.finance.creditNoteDialog.validationNumberRequired),
    amountCents: z.coerce
      .number()
      .int()
      .min(1, messages.finance.creditNoteDialog.validationAmountMin),
    currency: z.string().min(3).max(3),
    reason: z.string().min(1, messages.finance.creditNoteDialog.validationReasonRequired),
    notes: z.string().optional().nullable(),
  })
}

type CreditNoteFormValues = z.input<ReturnType<typeof getCreditNoteFormSchema>>
type CreditNoteFormOutput = z.output<ReturnType<typeof getCreditNoteFormSchema>>

export interface CreditNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceCurrency: string
  onSuccess?: () => void
}

function generateCreditNoteNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `CN-${y}-${seq}`
}

export function CreditNoteDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceCurrency,
  onSuccess,
}: CreditNoteDialogProps) {
  const messages = useOperatorAdminMessages()
  const { create } = useInvoiceCreditNoteMutation(invoiceId)
  const creditNoteFormSchema = useMemo(() => getCreditNoteFormSchema(messages), [messages])

  const form = useForm<CreditNoteFormValues, unknown, CreditNoteFormOutput>({
    resolver: zodResolver(creditNoteFormSchema),
    defaultValues: {
      creditNoteNumber: "",
      amountCents: 0,
      currency: invoiceCurrency,
      reason: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        creditNoteNumber: generateCreditNoteNumber(),
        amountCents: 0,
        currency: invoiceCurrency,
        reason: "",
        notes: "",
      })
    }
  }, [open, invoiceCurrency, form])

  const onSubmit = async (values: CreditNoteFormOutput) => {
    await create.mutateAsync({
      creditNoteNumber: values.creditNoteNumber,
      amountCents: values.amountCents,
      currency: values.currency,
      reason: values.reason,
      notes: values.notes || null,
    })

    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.finance.creditNoteDialog.title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.creditNoteDialog.numberLabel}</Label>
                <Input
                  {...form.register("creditNoteNumber")}
                  placeholder={messages.finance.creditNoteDialog.numberPlaceholder}
                />
                {form.formState.errors.creditNoteNumber ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.creditNoteNumber.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.creditNoteDialog.currencyLabel}</Label>
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
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.finance.creditNoteDialog.amountLabel}</Label>
              <Input {...form.register("amountCents")} type="number" min="1" />
              {form.formState.errors.amountCents ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amountCents.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.finance.creditNoteDialog.reasonLabel}</Label>
              <Textarea
                {...form.register("reason")}
                placeholder={messages.finance.creditNoteDialog.reasonPlaceholder}
              />
              {form.formState.errors.reason ? (
                <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.finance.creditNoteDialog.notesLabel}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={messages.finance.creditNoteDialog.notesPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.finance.creditNoteDialog.cancel}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {messages.finance.creditNoteDialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
