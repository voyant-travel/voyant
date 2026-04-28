import { useSupplierPaymentMutation } from "@voyantjs/finance-react"
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
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

function getSupplierPaymentFormSchema(messages: AdminMessages) {
  return z.object({
    bookingId: z
      .string()
      .min(1, messages.finance.supplierPaymentDialog.validationBookingIdRequired),
    supplierId: z.string().optional().nullable(),
    amountCents: z.coerce
      .number()
      .int()
      .min(1, messages.finance.supplierPaymentDialog.validationAmountMin),
    currency: z.string().min(3).max(3),
    paymentMethod: z.enum(["bank_transfer", "credit_card", "cash", "cheque", "other"]),
    status: z.enum(["pending", "completed", "failed", "refunded"]),
    referenceNumber: z.string().optional().nullable(),
    paymentDate: z
      .string()
      .min(1, messages.finance.supplierPaymentDialog.validationPaymentDateRequired),
    notes: z.string().optional().nullable(),
  })
}

type SupplierPaymentFormValues = z.input<ReturnType<typeof getSupplierPaymentFormSchema>>
type SupplierPaymentFormOutput = z.output<ReturnType<typeof getSupplierPaymentFormSchema>>

export interface SupplierPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SupplierPaymentDialog({
  open,
  onOpenChange,
  onSuccess,
}: SupplierPaymentDialogProps) {
  const messages = useAdminMessages()
  const { create } = useSupplierPaymentMutation()
  const supplierPaymentFormSchema = useMemo(
    () => getSupplierPaymentFormSchema(messages),
    [messages],
  )
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

  const form = useForm<SupplierPaymentFormValues, unknown, SupplierPaymentFormOutput>({
    resolver: zodResolver(supplierPaymentFormSchema),
    defaultValues: {
      bookingId: "",
      supplierId: "",
      amountCents: 0,
      currency: "EUR",
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
        bookingId: "",
        supplierId: "",
        amountCents: 0,
        currency: "EUR",
        paymentMethod: "bank_transfer",
        status: "completed",
        referenceNumber: "",
        paymentDate: today,
        notes: "",
      })
    }
  }, [open, form])

  const onSubmit = async (values: SupplierPaymentFormOutput) => {
    await create.mutateAsync({
      bookingId: values.bookingId,
      supplierId: values.supplierId || null,
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
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{messages.finance.supplierPaymentDialog.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.supplierPaymentDialog.bookingIdLabel}</Label>
                <Input
                  {...form.register("bookingId")}
                  placeholder={messages.finance.supplierPaymentDialog.bookingIdPlaceholder}
                />
                {form.formState.errors.bookingId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bookingId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.supplierPaymentDialog.supplierIdLabel}</Label>
                <Input
                  {...form.register("supplierId")}
                  placeholder={messages.finance.supplierPaymentDialog.supplierIdPlaceholder}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.supplierPaymentDialog.amountLabel}</Label>
                <Input {...form.register("amountCents")} type="number" min="1" />
                {form.formState.errors.amountCents ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amountCents.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.supplierPaymentDialog.currencyLabel}</Label>
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
                <Label>{messages.finance.supplierPaymentDialog.paymentDateLabel}</Label>
                <DatePicker
                  value={form.watch("paymentDate") || null}
                  onChange={(next) =>
                    form.setValue("paymentDate", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.finance.supplierPaymentDialog.paymentDatePlaceholder}
                  className="w-full"
                />
                {form.formState.errors.paymentDate ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.paymentDate.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.supplierPaymentDialog.paymentMethodLabel}</Label>
                <Select
                  items={paymentMethods}
                  value={form.watch("paymentMethod")}
                  onValueChange={(value) =>
                    form.setValue(
                      "paymentMethod",
                      value as SupplierPaymentFormValues["paymentMethod"],
                    )
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
                <Label>{messages.finance.supplierPaymentDialog.statusLabel}</Label>
                <Select
                  items={paymentStatuses}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as SupplierPaymentFormValues["status"])
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
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.supplierPaymentDialog.referenceNumberLabel}</Label>
                <Input
                  {...form.register("referenceNumber")}
                  placeholder={messages.finance.supplierPaymentDialog.referenceNumberPlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.finance.supplierPaymentDialog.notesLabel}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={messages.finance.supplierPaymentDialog.notesPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.finance.supplierPaymentDialog.cancel}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {messages.finance.supplierPaymentDialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
