import { type InvoiceRecord, useInvoiceMutation } from "@voyantjs/finance-react"
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

function getInvoiceFormSchema(messages: AdminMessages) {
  return z.object({
    invoiceNumber: z
      .string()
      .min(1, messages.finance.invoiceDialog.validationInvoiceNumberRequired),
    bookingId: z.string().min(1, messages.finance.invoiceDialog.validationBookingIdRequired),
    personId: z.string().optional().nullable(),
    organizationId: z.string().optional().nullable(),
    status: z.enum(["draft", "sent", "partially_paid", "paid", "overdue", "void"]),
    currency: z.string().min(3).max(3, messages.finance.invoiceDialog.validationCurrencyCode),
    subtotalCents: z.coerce.number().int().min(0).default(0),
    taxCents: z.coerce.number().int().min(0).default(0),
    totalCents: z.coerce.number().int().min(0).default(0),
    issueDate: z.string().min(1, messages.finance.invoiceDialog.validationIssueDateRequired),
    dueDate: z.string().min(1, messages.finance.invoiceDialog.validationDueDateRequired),
    notes: z.string().optional().nullable(),
  })
}

type InvoiceFormValues = z.input<ReturnType<typeof getInvoiceFormSchema>>
type InvoiceFormOutput = z.output<ReturnType<typeof getInvoiceFormSchema>>

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
  const messages = useAdminMessages()
  const isEditing = Boolean(invoice)
  const { create, update } = useInvoiceMutation()
  const invoiceFormSchema = useMemo(() => getInvoiceFormSchema(messages), [messages])
  const invoiceStatuses = useMemo(
    () =>
      [
        { value: "draft", label: messages.finance.invoiceStatusDraft },
        { value: "sent", label: messages.finance.invoiceStatusSent },
        { value: "partially_paid", label: messages.finance.invoiceStatusPartiallyPaid },
        { value: "paid", label: messages.finance.invoiceStatusPaid },
        { value: "overdue", label: messages.finance.invoiceStatusOverdue },
        { value: "void", label: messages.finance.invoiceStatusVoid },
      ] as const,
    [messages],
  )

  const form = useForm<InvoiceFormValues, unknown, InvoiceFormOutput>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: "",
      bookingId: "",
      personId: "",
      organizationId: "",
      status: "draft",
      currency: "EUR",
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
        currency: "EUR",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.finance.invoiceDialog.editTitle
              : messages.finance.invoiceDialog.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.invoiceDialog.invoiceNumberLabel}</Label>
                <Input
                  {...form.register("invoiceNumber")}
                  placeholder={messages.finance.invoiceDialog.invoiceNumberPlaceholder}
                />
                {form.formState.errors.invoiceNumber ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.invoiceNumber.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{messages.finance.invoiceDialog.statusLabel}</Label>
                <Select
                  items={invoiceStatuses}
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
                <Label>{messages.finance.invoiceDialog.bookingIdLabel}</Label>
                <Input
                  {...form.register("bookingId")}
                  placeholder={messages.finance.invoiceDialog.bookingIdPlaceholder}
                />
                {form.formState.errors.bookingId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bookingId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.invoiceDialog.currencyLabel}</Label>
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

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.invoiceDialog.subtotalLabel}</Label>
                <Input {...form.register("subtotalCents")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.invoiceDialog.taxLabel}</Label>
                <Input {...form.register("taxCents")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.invoiceDialog.totalLabel}</Label>
                <Input {...form.register("totalCents")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.invoiceDialog.issueDateLabel}</Label>
                <DatePicker
                  value={form.watch("issueDate") || null}
                  onChange={(nextValue) =>
                    form.setValue("issueDate", nextValue ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder={messages.finance.invoiceDialog.issueDatePlaceholder}
                  className="w-full"
                />
                {form.formState.errors.issueDate ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.issueDate.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.finance.invoiceDialog.dueDateLabel}</Label>
                <DatePicker
                  value={form.watch("dueDate") || null}
                  onChange={(nextValue) =>
                    form.setValue("dueDate", nextValue ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder={messages.finance.invoiceDialog.dueDatePlaceholder}
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
              <Label>{messages.finance.invoiceDialog.notesLabel}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={messages.finance.invoiceDialog.notesPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.finance.invoiceDialog.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing
                ? messages.finance.invoiceDialog.saveChanges
                : messages.finance.invoiceDialog.createInvoice}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
