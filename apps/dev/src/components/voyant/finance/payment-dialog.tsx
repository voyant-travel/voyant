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
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const paymentFormSchema = z.object({
  amountCents: z.coerce.number().int().min(1, "Amount must be at least 1"),
  currency: z.string().min(3).max(3),
  paymentMethod: z.enum(["bank_transfer", "credit_card", "cash", "cheque", "other"]),
  status: z.enum(["pending", "completed", "failed", "refunded"]),
  referenceNumber: z.string().optional().nullable(),
  paymentDate: z.string().min(1, "Payment date is required"),
  notes: z.string().optional().nullable(),
})

type PaymentFormValues = z.input<typeof paymentFormSchema>
type PaymentFormOutput = z.output<typeof paymentFormSchema>

export interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceCurrency: string
  onSuccess?: () => void
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const

const PAYMENT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
] as const

export function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceCurrency,
  onSuccess,
}: PaymentDialogProps) {
  const createPayment = useInvoicePaymentMutation(invoiceId)

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
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Amount (cents)</Label>
                <Input {...form.register("amountCents")} type="number" min="1" />
                {form.formState.errors.amountCents ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amountCents.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Currency</Label>
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
                <Label>Payment Method</Label>
                <Select
                  items={PAYMENT_METHODS}
                  value={form.watch("paymentMethod")}
                  onValueChange={(value) =>
                    form.setValue("paymentMethod", value as PaymentFormValues["paymentMethod"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={PAYMENT_STATUSES}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as PaymentFormValues["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((status) => (
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
                <Label>Payment Date</Label>
                <Input {...form.register("paymentDate")} type="date" />
                {form.formState.errors.paymentDate ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.paymentDate.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Reference Number</Label>
                <Input {...form.register("referenceNumber")} placeholder="TXN-12345" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} placeholder="Payment notes..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPayment.isPending}>
              {createPayment.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
