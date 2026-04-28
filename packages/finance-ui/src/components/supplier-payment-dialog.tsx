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
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const supplierPaymentFormSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  supplierId: z.string().optional().nullable(),
  amountCents: z.coerce.number().int().min(1, "Amount must be at least 1"),
  currency: z.string().min(3).max(3),
  paymentMethod: z.enum(["bank_transfer", "credit_card", "cash", "cheque", "other"]),
  status: z.enum(["pending", "completed", "failed", "refunded"]),
  referenceNumber: z.string().optional().nullable(),
  paymentDate: z.string().min(1, "Payment date is required"),
  notes: z.string().optional().nullable(),
})

type SupplierPaymentFormValues = z.input<typeof supplierPaymentFormSchema>
type SupplierPaymentFormOutput = z.output<typeof supplierPaymentFormSchema>

export interface SupplierPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function SupplierPaymentDialog({
  open,
  onOpenChange,
  onSuccess,
}: SupplierPaymentDialogProps) {
  const { create } = useSupplierPaymentMutation()

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
          <DialogTitle>Record Supplier Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Booking ID</Label>
                <Input {...form.register("bookingId")} placeholder="book_..." />
                {form.formState.errors.bookingId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bookingId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Supplier ID (optional)</Label>
                <Input {...form.register("supplierId")} placeholder="supp_..." />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <Label>Payment Date</Label>
                <DatePicker
                  value={form.watch("paymentDate") || null}
                  onChange={(next) =>
                    form.setValue("paymentDate", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select payment date"
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
                <Label>Payment Method</Label>
                <Select
                  items={PAYMENT_METHODS}
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
                    form.setValue("status", value as SupplierPaymentFormValues["status"])
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
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
