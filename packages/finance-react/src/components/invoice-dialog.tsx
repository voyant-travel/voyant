import { BookingCombobox } from "@voyant-travel/bookings-react/ui"
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
import { invoiceStatuses } from "../i18n/messages.js"
import { type InvoiceRecord, useInvoiceMutation } from "../index.js"

function createInvoiceFormSchema(messages: ReturnType<typeof useFinanceUiMessagesOrDefault>) {
  return z.object({
    invoiceNumber: z.string().min(1, messages.invoiceDialog.validation.invoiceNumberRequired),
    bookingId: z.string().min(1, messages.invoiceDialog.validation.bookingIdRequired),
    personId: z.string().optional().nullable(),
    organizationId: z.string().optional().nullable(),
    status: z.enum(invoiceStatuses),
    currency: z.string().min(3).max(3, messages.invoiceDialog.validation.currencyIsoCode),
    subtotalCents: z.coerce.number().int().min(0).default(0),
    taxCents: z.coerce.number().int().min(0).default(0),
    totalCents: z.coerce.number().int().min(0).default(0),
    issueDate: z.string().min(1, messages.invoiceDialog.validation.issueDateRequired),
    dueDate: z.string().min(1, messages.invoiceDialog.validation.dueDateRequired),
    notes: z.string().optional().nullable(),
  })
}

type InvoiceFormSchema = ReturnType<typeof createInvoiceFormSchema>
type InvoiceFormValues = z.input<InvoiceFormSchema>
type InvoiceFormOutput = z.output<InvoiceFormSchema>

export interface InvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice?: InvoiceRecord
  onSuccess?: (invoice: InvoiceRecord) => void
}

function generateInvoiceNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `INV-${y}-${seq}`
}

export function InvoiceDialog({ open, onOpenChange, invoice, onSuccess }: InvoiceDialogProps) {
  const isEditing = Boolean(invoice)
  const { create, update } = useInvoiceMutation()
  const messages = useFinanceUiMessagesOrDefault()
  const invoiceFormSchema = createInvoiceFormSchema(messages)

  const form = useForm<InvoiceFormValues, unknown, InvoiceFormOutput>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: "",
      bookingId: "",
      personId: "",
      organizationId: "",
      status: "draft",
      currency: "EUR", // i18n-literal-ok domain default currency
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
      issueDate: "",
      dueDate: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && invoice) {
      form.reset({
        invoiceNumber: invoice.invoiceNumber,
        bookingId: invoice.bookingId,
        personId: invoice.personId ?? "",
        organizationId: invoice.organizationId ?? "",
        status: invoice.status,
        currency: invoice.currency,
        subtotalCents: invoice.subtotalCents,
        taxCents: invoice.taxCents,
        totalCents: invoice.totalCents,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        notes: invoice.notes ?? "",
      })
    } else if (open) {
      const today = new Date().toISOString().split("T")[0]!
      form.reset({
        invoiceNumber: generateInvoiceNumber(),
        bookingId: "",
        personId: "",
        organizationId: "",
        status: "draft",
        currency: "EUR", // i18n-literal-ok domain default currency
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        issueDate: today,
        dueDate: "",
        notes: "",
      })
    }
  }, [open, invoice, form])

  const onSubmit = async (values: InvoiceFormOutput) => {
    const payload = {
      invoiceNumber: values.invoiceNumber,
      bookingId: values.bookingId,
      personId: values.personId || null,
      organizationId: values.organizationId || null,
      status: values.status,
      currency: values.currency,
      subtotalCents: values.subtotalCents,
      taxCents: values.taxCents,
      totalCents: values.totalCents,
      paidCents: invoice?.paidCents ?? 0,
      balanceDueCents:
        typeof invoice?.paidCents === "number"
          ? values.totalCents - invoice.paidCents
          : values.totalCents,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: invoice!.id, input: payload })
      : await create.mutateAsync(payload)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? messages.invoiceDialog.titles.edit : messages.invoiceDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.invoiceDialog.fields.invoiceNumber}</Label>
                <Input
                  {...form.register("invoiceNumber")}
                  placeholder={messages.invoiceDialog.placeholders.invoiceNumber}
                />
                {form.formState.errors.invoiceNumber ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.invoiceNumber.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{messages.invoiceDialog.fields.status}</Label>
                <Select
                  items={invoiceStatuses.map((value) => ({
                    label: messages.common.invoiceStatusLabels[value],
                    value,
                  }))}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as InvoiceFormValues["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {messages.common.invoiceStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.invoiceDialog.fields.bookingId}</Label>
                <BookingCombobox
                  value={form.watch("bookingId") || null}
                  onChange={(next) =>
                    form.setValue("bookingId", next ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder={messages.invoiceDialog.placeholders.bookingId}
                />
                {form.formState.errors.bookingId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bookingId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.invoiceDialog.fields.currency}</Label>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.invoiceDialog.fields.subtotalCents}</Label>
                <CurrencyInput
                  value={form.watch("subtotalCents") as number}
                  onChange={(next) =>
                    form.setValue("subtotalCents", next ?? 0, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  currency={form.watch("currency")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.invoiceDialog.fields.taxCents}</Label>
                <CurrencyInput
                  value={form.watch("taxCents") as number}
                  onChange={(next) =>
                    form.setValue("taxCents", next ?? 0, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  currency={form.watch("currency")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.invoiceDialog.fields.totalCents}</Label>
                <CurrencyInput
                  value={form.watch("totalCents") as number}
                  onChange={(next) =>
                    form.setValue("totalCents", next ?? 0, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  currency={form.watch("currency")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.invoiceDialog.fields.issueDate}</Label>
                <DatePicker
                  value={form.watch("issueDate") || null}
                  onChange={(nextValue) =>
                    form.setValue("issueDate", nextValue ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder={messages.invoiceDialog.placeholders.issueDate}
                  className="w-full"
                />
                {form.formState.errors.issueDate ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.issueDate.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.invoiceDialog.fields.dueDate}</Label>
                <DatePicker
                  value={form.watch("dueDate") || null}
                  onChange={(nextValue) =>
                    form.setValue("dueDate", nextValue ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder={messages.invoiceDialog.placeholders.dueDate}
                  className="w-full"
                />
                {form.formState.errors.dueDate ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.dueDate.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.invoiceDialog.fields.notes}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={messages.invoiceDialog.placeholders.notes}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : messages.invoiceDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
