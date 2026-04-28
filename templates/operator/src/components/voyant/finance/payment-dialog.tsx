import { useInvoicePaymentMutation } from "@voyantjs/finance-react"
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
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

function getPaymentFormSchema(messages: AdminMessages) {
  return z.object({
    amountCents: z.coerce.number().int().min(1, messages.finance.paymentDialog.validationAmountMin),
    currency: z.string().min(3).max(3),
    paymentMethod: z.enum(["bank_transfer", "credit_card", "cash", "cheque", "other"]),
    status: z.enum(["pending", "completed", "failed", "refunded"]),
    referenceNumber: z.string().optional().nullable(),
    paymentDate: z.string().min(1, messages.finance.paymentDialog.validationPaymentDateRequired),
    notes: z.string().optional().nullable(),
  })
}

type PaymentFormValues = z.input<ReturnType<typeof getPaymentFormSchema>>
type PaymentFormOutput = z.output<ReturnType<typeof getPaymentFormSchema>>

export interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceCurrency: string
  onSuccess?: () => void
}

export function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceCurrency,
  onSuccess,
}: PaymentDialogProps) {
  const messages = useAdminMessages()
  const createPayment = useInvoicePaymentMutation(invoiceId)
  const paymentFormSchema = useMemo(() => getPaymentFormSchema(messages), [messages])
  const paymentMethods = useMemo(
    () =>
      [
        { value: "bank_transfer", label: messages.finance.paymentMethodBankTransfer },
        { value: "credit_card", label: messages.finance.paymentMethodCreditCard },
        { value: "cash", label: messages.finance.paymentMethodCash },
        { value: "cheque", label: messages.finance.paymentMethodCheque },
        { value: "other", label: messages.finance.paymentMethodOther },
      ] as const,
    [messages],
  )
  const paymentStatuses = useMemo(
    () =>
      [
        { value: "pending", label: messages.finance.paymentStatusPending },
        { value: "completed", label: messages.finance.paymentStatusCompleted },
        { value: "failed", label: messages.finance.paymentStatusFailed },
        { value: "refunded", label: messages.finance.paymentStatusRefunded },
      ] as const,
    [messages],
  )

  const form = useForm<PaymentFormValues, unknown, PaymentFormOutput>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amountCents: 0,
      currency: invoiceCurrency,
      paymentMethod: "bank_transfer",
      status: "completed",
      referenceNumber: "",
      paymentDate: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split("T")[0]!
      form.reset({
        amountCents: 0,
        currency: invoiceCurrency,
        paymentMethod: "bank_transfer",
        status: "completed",
        referenceNumber: "",
        paymentDate: today,
        notes: "",
      })
    }
  }, [open, invoiceCurrency, form])

  const onSubmit = async (values: PaymentFormOutput) => {
    await createPayment.mutateAsync({
      amountCents: values.amountCents,
      currency: values.currency,
      paymentMethod: values.paymentMethod,
      status: values.status,
      referenceNumber: values.referenceNumber || null,
      paymentDate: values.paymentDate,
      notes: values.notes || null,
    })

    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.finance.paymentDialog.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.paymentDialog.amountLabel}</Label>
                <Input {...form.register("amountCents")} type="number" min="1" />
                {form.formState.errors.amountCents ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amountCents.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.paymentDialog.currencyLabel}</Label>
                <Input
                  {...form.register("currency")}
                  placeholder="EUR"
                  maxLength={3}
                  className="uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.paymentDialog.paymentMethodLabel}</Label>
                <Select
                  items={paymentMethods}
                  value={form.watch("paymentMethod")}
                  onValueChange={(value) =>
                    form.setValue("paymentMethod", value as PaymentFormValues["paymentMethod"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.paymentDialog.statusLabel}</Label>
                <Select
                  items={paymentStatuses}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as PaymentFormValues["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.paymentDialog.paymentDateLabel}</Label>
                <Input {...form.register("paymentDate")} type="date" />
                {form.formState.errors.paymentDate ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.paymentDate.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.paymentDialog.referenceNumberLabel}</Label>
                <Input
                  {...form.register("referenceNumber")}
                  placeholder={messages.finance.paymentDialog.referenceNumberPlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.finance.paymentDialog.notesLabel}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={messages.finance.paymentDialog.notesPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.finance.paymentDialog.cancel}
            </Button>
            <Button type="submit" disabled={createPayment.isPending}>
              {createPayment.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {messages.finance.paymentDialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
