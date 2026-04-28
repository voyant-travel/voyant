"use client"

import { type BookingItemRecord, useBookingItemMutation } from "@voyantjs/bookings-react"
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
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

const itemTypes = [
  "unit",
  "extra",
  "service",
  "fee",
  "tax",
  "discount",
  "adjustment",
  "accommodation",
  "transport",
  "other",
] as const

const itemStatuses = ["draft", "on_hold", "confirmed", "cancelled", "expired", "fulfilled"] as const

type ItemDialogMessages = ReturnType<typeof useAdminMessages>["bookings"]["detail"]["itemDialog"]

const buildBookingItemFormSchema = (messages: ItemDialogMessages) =>
  z.object({
    title: z.string().min(1, messages.validationTitleRequired),
    itemType: z.enum(itemTypes).default("unit"),
    status: z.enum(itemStatuses).default("draft"),
    quantity: z.coerce.number().int().positive().default(1),
    sellCurrency: z.string().min(3).max(3).default("EUR"),
    unitSellAmountCents: z.coerce.number().int().optional().nullable(),
    totalSellAmountCents: z.coerce.number().int().optional().nullable(),
    costCurrency: z.string().min(3).max(3).optional().nullable(),
    unitCostAmountCents: z.coerce.number().int().optional().nullable(),
    totalCostAmountCents: z.coerce.number().int().optional().nullable(),
    serviceDate: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })

type BookingItemFormSchema = ReturnType<typeof buildBookingItemFormSchema>
type BookingItemFormValues = z.input<BookingItemFormSchema>
type BookingItemFormOutput = z.output<BookingItemFormSchema>

function getItemTypeLabel(
  itemType: (typeof itemTypes)[number],
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["items"],
) {
  switch (itemType) {
    case "unit":
      return messages.typeUnit
    case "extra":
      return messages.typeExtra
    case "service":
      return messages.typeService
    case "fee":
      return messages.typeFee
    case "tax":
      return messages.typeTax
    case "discount":
      return messages.typeDiscount
    case "adjustment":
      return messages.typeAdjustment
    case "accommodation":
      return messages.typeAccommodation
    case "transport":
      return messages.typeTransport
    case "other":
      return messages.typeOther
  }
}

function getItemStatusLabel(
  status: (typeof itemStatuses)[number],
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["items"],
) {
  switch (status) {
    case "draft":
      return messages.statusDraft
    case "on_hold":
      return messages.statusOnHold
    case "confirmed":
      return messages.statusConfirmed
    case "cancelled":
      return messages.statusCancelled
    case "expired":
      return messages.statusExpired
    case "fulfilled":
      return messages.statusFulfilled
  }
}

export interface BookingItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  item?: BookingItemRecord
  onSuccess?: () => void
}

export function BookingItemDialog({
  open,
  onOpenChange,
  bookingId,
  item,
  onSuccess,
}: BookingItemDialogProps) {
  const messages = useAdminMessages()
  const itemDialogMessages = messages.bookings.detail.itemDialog
  const itemMessages = messages.bookings.detail.items
  const isEditing = Boolean(item)
  const { create, update } = useBookingItemMutation(bookingId)
  const bookingItemFormSchema = buildBookingItemFormSchema(itemDialogMessages)

  const form = useForm<BookingItemFormValues, unknown, BookingItemFormOutput>({
    resolver: zodResolver(bookingItemFormSchema),
    defaultValues: {
      title: "",
      itemType: "unit",
      status: "draft",
      quantity: 1,
      sellCurrency: "EUR",
      unitSellAmountCents: null,
      totalSellAmountCents: null,
      costCurrency: null,
      unitCostAmountCents: null,
      totalCostAmountCents: null,
      serviceDate: "",
      description: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && item) {
      form.reset({
        title: item.title,
        itemType: item.itemType,
        status: item.status,
        quantity: item.quantity,
        sellCurrency: item.sellCurrency,
        unitSellAmountCents: item.unitSellAmountCents,
        totalSellAmountCents: item.totalSellAmountCents,
        costCurrency: item.costCurrency,
        unitCostAmountCents: item.unitCostAmountCents,
        totalCostAmountCents: item.totalCostAmountCents,
        serviceDate: item.serviceDate ?? "",
        description: item.description ?? "",
        notes: item.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, item])

  const onSubmit = async (values: BookingItemFormOutput) => {
    const payload = {
      title: values.title,
      itemType: values.itemType,
      status: values.status,
      quantity: values.quantity,
      sellCurrency: values.sellCurrency,
      unitSellAmountCents: values.unitSellAmountCents || null,
      totalSellAmountCents: values.totalSellAmountCents || null,
      costCurrency: values.costCurrency || null,
      unitCostAmountCents: values.unitCostAmountCents || null,
      totalCostAmountCents: values.totalCostAmountCents || null,
      serviceDate: values.serviceDate || null,
      description: values.description || null,
      notes: values.notes || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: item!.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }

    onOpenChange(false)
    onSuccess?.()
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? itemDialogMessages.editTitle : itemDialogMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{itemDialogMessages.titleLabel}</Label>
              <Input
                {...form.register("title")}
                placeholder={itemDialogMessages.titlePlaceholder}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{itemDialogMessages.typeLabel}</Label>
                <Select
                  items={itemTypes.map((t) => ({ label: t.replace("_", " "), value: t }))}
                  value={form.watch("itemType")}
                  onValueChange={(v) => form.setValue("itemType", v as (typeof itemTypes)[number])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itemTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {getItemTypeLabel(t, itemMessages)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{itemDialogMessages.statusLabel}</Label>
                <Select
                  items={itemStatuses.map((s) => ({ label: s.replace("_", " "), value: s }))}
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as (typeof itemStatuses)[number])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itemStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {getItemStatusLabel(s, itemMessages)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{itemDialogMessages.quantityLabel}</Label>
                <Input {...form.register("quantity")} type="number" min={1} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{itemDialogMessages.sellCurrencyLabel}</Label>
                <CurrencyCombobox
                  value={form.watch("sellCurrency") || null}
                  onChange={(next) =>
                    form.setValue("sellCurrency", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{itemDialogMessages.unitSellLabel}</Label>
                <Input {...form.register("unitSellAmountCents")} type="number" placeholder="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{itemDialogMessages.totalSellLabel}</Label>
                <Input {...form.register("totalSellAmountCents")} type="number" placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{itemDialogMessages.costCurrencyLabel}</Label>
                <CurrencyCombobox
                  value={form.watch("costCurrency") || null}
                  onChange={(next) =>
                    form.setValue("costCurrency", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{itemDialogMessages.unitCostLabel}</Label>
                <Input {...form.register("unitCostAmountCents")} type="number" placeholder="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{itemDialogMessages.totalCostLabel}</Label>
                <Input {...form.register("totalCostAmountCents")} type="number" placeholder="0" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{itemDialogMessages.serviceDateLabel}</Label>
              <DatePicker
                value={form.watch("serviceDate") || null}
                onChange={(next) =>
                  form.setValue("serviceDate", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder={itemDialogMessages.serviceDatePlaceholder}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{itemDialogMessages.descriptionLabel}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={itemDialogMessages.descriptionPlaceholder}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{itemDialogMessages.notesLabel}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={itemDialogMessages.notesPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {itemDialogMessages.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? itemDialogMessages.saveChanges : itemDialogMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
