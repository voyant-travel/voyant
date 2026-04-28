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
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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

const bookingItemFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
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

type BookingItemFormValues = z.input<typeof bookingItemFormSchema>
type BookingItemFormOutput = z.output<typeof bookingItemFormSchema>

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
  const isEditing = Boolean(item)
  const { create, update } = useBookingItemMutation(bookingId)

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
          <DialogTitle>{isEditing ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Title</Label>
              <Input {...form.register("title")} placeholder="Room night, transfer, tour..." />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
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
                        {t.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
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
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Quantity</Label>
                <Input {...form.register("quantity")} type="number" min={1} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sell Currency</Label>
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
                <Label>Unit Sell (cents)</Label>
                <Input {...form.register("unitSellAmountCents")} type="number" placeholder="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Total Sell (cents)</Label>
                <Input {...form.register("totalSellAmountCents")} type="number" placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Cost Currency</Label>
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
                <Label>Unit Cost (cents)</Label>
                <Input {...form.register("unitCostAmountCents")} type="number" placeholder="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Total Cost (cents)</Label>
                <Input {...form.register("totalCostAmountCents")} type="number" placeholder="0" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Service Date</Label>
              <DatePicker
                value={form.watch("serviceDate") || null}
                onChange={(next) =>
                  form.setValue("serviceDate", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder="Select service date"
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} placeholder="Item description..." />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} placeholder="Internal notes..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
