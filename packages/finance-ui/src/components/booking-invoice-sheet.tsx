"use client"

import { type InvoiceRecord, useInvoiceMutation } from "@voyantjs/finance-react"
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
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@voyantjs/ui/components"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { CurrencyInput } from "@voyantjs/ui/components/currency-input"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { invoiceStatuses } from "../i18n/messages.js"

function createBookingInvoiceFormSchema(
  messages: ReturnType<typeof useFinanceUiMessagesOrDefault>,
) {
  return z.object({
    invoiceNumber: z.string().min(1, messages.invoiceDialog.validation.invoiceNumberRequired),
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

type BookingInvoiceFormSchema = ReturnType<typeof createBookingInvoiceFormSchema>
type BookingInvoiceFormValues = z.input<BookingInvoiceFormSchema>
type BookingInvoiceFormOutput = z.output<BookingInvoiceFormSchema>

export interface BookingInvoiceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  /** Pre-fill the linked person (snapshot at invoice issuance). */
  defaultPersonId?: string | null
  /** Pre-fill the linked organization (snapshot at invoice issuance). */
  defaultOrganizationId?: string | null
  /** Pre-fill the currency from the booking's sell currency. */
  defaultCurrency?: string
  /** Pre-fill subtotal/total from the booking's sell amount (in cents). */
  defaultAmountCents?: number | null
  onSuccess?: (invoice: InvoiceRecord) => void
}

function generateInvoiceNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `INV-${y}-${seq}`
}

/**
 * Slide-in invoice creator scoped to a single booking. The booking link
 * is set from props and not editable here — the assumption is that the
 * sheet is launched from a booking detail page where the booking is
 * already in context. Use `<InvoiceDialog />` for the global "pick any
 * booking" flow.
 */
export function BookingInvoiceSheet({
  open,
  onOpenChange,
  bookingId,
  defaultPersonId,
  defaultOrganizationId,
  defaultCurrency = "EUR", // i18n-literal-ok domain default currency
  defaultAmountCents = null,
  onSuccess,
}: BookingInvoiceSheetProps) {
  const { create } = useInvoiceMutation()
  const messages = useFinanceUiMessagesOrDefault()
  const dialog = messages.invoiceDialog
  const schema = createBookingInvoiceFormSchema(messages)

  const form = useForm<BookingInvoiceFormValues, unknown, BookingInvoiceFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoiceNumber: "",
      status: "draft",
      currency: defaultCurrency,
      subtotalCents: defaultAmountCents ?? 0,
      taxCents: 0,
      totalCents: defaultAmountCents ?? 0,
      issueDate: "",
      dueDate: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (!open) return
    const today = new Date().toISOString().split("T")[0]!
    form.reset({
      invoiceNumber: generateInvoiceNumber(),
      status: "draft",
      currency: defaultCurrency,
      subtotalCents: defaultAmountCents ?? 0,
      taxCents: 0,
      totalCents: defaultAmountCents ?? 0,
      issueDate: today,
      dueDate: "",
      notes: "",
    })
  }, [open, defaultCurrency, defaultAmountCents, form])

  const onSubmit = async (values: BookingInvoiceFormOutput) => {
    const saved = await create.mutateAsync({
      invoiceNumber: values.invoiceNumber,
      bookingId,
      personId: defaultPersonId ?? null,
      organizationId: defaultOrganizationId ?? null,
      status: values.status,
      currency: values.currency,
      subtotalCents: values.subtotalCents,
      taxCents: values.taxCents,
      totalCents: values.totalCents,
      paidCents: 0,
      balanceDueCents: values.totalCents,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      notes: values.notes || null,
    })

    onOpenChange(false)
    onSuccess?.(saved)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{dialog.titles.create}</SheetTitle>
          <SheetDescription>{messages.invoicesPage.description}</SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>{dialog.fields.invoiceNumber}</Label>
              <Input
                {...form.register("invoiceNumber")}
                placeholder={dialog.placeholders.invoiceNumber}
              />
              {form.formState.errors.invoiceNumber ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.invoiceNumber.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialog.fields.status}</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) =>
                  form.setValue("status", (value ?? "draft") as BookingInvoiceFormValues["status"])
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

          <div className="flex flex-col gap-2">
            <Label>{dialog.fields.currency}</Label>
            <CurrencyCombobox
              value={form.watch("currency") || null}
              onChange={(next) =>
                form.setValue("currency", next ?? defaultCurrency, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label>{dialog.fields.subtotalCents}</Label>
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
              <Label>{dialog.fields.taxCents}</Label>
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
              <Label>{dialog.fields.totalCents}</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>{dialog.fields.issueDate}</Label>
              <DatePicker
                value={form.watch("issueDate") || null}
                onChange={(next) =>
                  form.setValue("issueDate", next ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={dialog.placeholders.issueDate}
                className="w-full"
              />
              {form.formState.errors.issueDate ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.issueDate.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dialog.fields.dueDate}</Label>
              <DatePicker
                value={form.watch("dueDate") || null}
                onChange={(next) =>
                  form.setValue("dueDate", next ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={dialog.placeholders.dueDate}
                className="w-full"
              />
              {form.formState.errors.dueDate ? (
                <p className="text-xs text-destructive">{form.formState.errors.dueDate.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{dialog.fields.notes}</Label>
            <Textarea {...form.register("notes")} placeholder={dialog.placeholders.notes} />
          </div>
        </form>
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {messages.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={create.isPending}
            onClick={() => void form.handleSubmit(onSubmit)()}
          >
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {dialog.actions.create}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
