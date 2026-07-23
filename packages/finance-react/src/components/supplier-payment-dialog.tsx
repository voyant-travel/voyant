import { BookingCombobox } from "@voyant-travel/bookings-react/ui"
import { SupplierCombobox } from "@voyant-travel/distribution-react/suppliers/ui"
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
import { CurrencyInput } from "@voyant-travel/ui/components/currency-input"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { supplierPaymentMethods, supplierPaymentStatuses } from "../i18n/messages.js"
import { useSupplierPaymentMutation } from "../index.js"

function createSupplierPaymentFormSchema(
  messages: ReturnType<typeof useFinanceUiMessagesOrDefault>,
) {
  return z.object({
    bookingId: z.string().min(1, messages.supplierPaymentDialog.validation.bookingIdRequired),
    supplierId: z.string().optional().nullable(),
    amountCents: z.coerce
      .number()
      .int()
      .min(1, messages.supplierPaymentDialog.validation.amountMinimum),
    currency: z.string().min(3).max(3),
    paymentMethod: z.enum(supplierPaymentMethods),
    status: z.enum(supplierPaymentStatuses),
    referenceNumber: z.string().optional().nullable(),
    paymentDate: z.string().min(1, messages.supplierPaymentDialog.validation.paymentDateRequired),
    notes: z.string().optional().nullable(),
  })
}

type SupplierPaymentFormSchema = ReturnType<typeof createSupplierPaymentFormSchema>
type SupplierPaymentFormValues = z.input<SupplierPaymentFormSchema>
type SupplierPaymentFormOutput = z.output<SupplierPaymentFormSchema>

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
  const { create } = useSupplierPaymentMutation()
  const messages = useFinanceUiMessagesOrDefault()
  const supplierPaymentFormSchema = createSupplierPaymentFormSchema(messages)

  const form = useForm<SupplierPaymentFormValues, unknown, SupplierPaymentFormOutput>({
    resolver: zodResolver(supplierPaymentFormSchema),
    defaultValues: {
      bookingId: "",
      supplierId: "",
      amountCents: 0,
      currency: "EUR", // i18n-literal-ok domain default currency
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
        currency: "EUR", // i18n-literal-ok domain default currency
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{messages.supplierPaymentDialog.title}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierPaymentDialog.fields.bookingId}</Label>
                <BookingCombobox
                  value={form.watch("bookingId") || null}
                  onChange={(next) =>
                    form.setValue("bookingId", next ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder={messages.supplierPaymentDialog.placeholders.bookingId}
                />
                {form.formState.errors.bookingId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bookingId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierPaymentDialog.fields.supplierId}</Label>
                <SupplierCombobox
                  value={form.watch("supplierId") || null}
                  onChange={(next) =>
                    form.setValue("supplierId", next ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder={messages.supplierPaymentDialog.placeholders.supplierId}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierPaymentDialog.fields.amountCents}</Label>
                <CurrencyInput
                  value={form.watch("amountCents") as number}
                  onChange={(next) =>
                    form.setValue("amountCents", next ?? 0, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  currency={form.watch("currency")}
                />
                {form.formState.errors.amountCents ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amountCents.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierPaymentDialog.fields.currency}</Label>
                <CurrencyCombobox
                  value={form.watch("currency") || null}
                  onChange={(next) =>
                    form.setValue(
                      "currency",
                      next ?? "EUR" /* i18n-literal-ok domain default currency */,
                      {
                        shouldValidate: true,
                        shouldDirty: true,
                      },
                    )
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierPaymentDialog.fields.paymentDate}</Label>
                <DatePicker
                  value={form.watch("paymentDate") || null}
                  onChange={(next) =>
                    form.setValue("paymentDate", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.supplierPaymentDialog.placeholders.paymentDate}
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
                <Label>{messages.supplierPaymentDialog.fields.paymentMethod}</Label>
                <Select
                  items={supplierPaymentMethods.map((value) => ({
                    label: messages.common.supplierPaymentMethodLabels[value],
                    value,
                  }))}
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
                    {supplierPaymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {messages.common.supplierPaymentMethodLabels[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierPaymentDialog.fields.status}</Label>
                <Select
                  items={supplierPaymentStatuses.map((value) => ({
                    label: messages.common.supplierPaymentStatusLabels[value],
                    value,
                  }))}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as SupplierPaymentFormValues["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierPaymentStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {messages.common.supplierPaymentStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.supplierPaymentDialog.fields.referenceNumber}</Label>
                <Input
                  {...form.register("referenceNumber")}
                  placeholder={messages.supplierPaymentDialog.placeholders.referenceNumber}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.supplierPaymentDialog.fields.notes}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={messages.supplierPaymentDialog.placeholders.notes}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {messages.supplierPaymentDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
