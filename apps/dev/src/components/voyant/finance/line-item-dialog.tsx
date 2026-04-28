import { type LineItemRecord, useInvoiceLineItemMutation } from "@voyantjs/finance-react"
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
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const lineItemFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPriceCents: z.coerce.number().int().min(0),
  totalCents: z.coerce.number().int().min(0),
  taxRate: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
})

type LineItemFormValues = z.input<typeof lineItemFormSchema>
type LineItemFormOutput = z.output<typeof lineItemFormSchema>

export interface LineItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  lineItem?: LineItemRecord
  onSuccess?: (lineItem: LineItemRecord) => void
}

export function LineItemDialog({
  open,
  onOpenChange,
  invoiceId,
  lineItem,
  onSuccess,
}: LineItemDialogProps) {
  const isEditing = Boolean(lineItem)
  const { create, update } = useInvoiceLineItemMutation(invoiceId)

  const form = useForm<LineItemFormValues, unknown, LineItemFormOutput>({
    resolver: zodResolver(lineItemFormSchema),
    defaultValues: {
      description: "",
      quantity: 1,
      unitPriceCents: 0,
      totalCents: 0,
      taxRate: "",
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && lineItem) {
      form.reset({
        description: lineItem.description,
        quantity: lineItem.quantity,
        unitPriceCents: lineItem.unitPriceCents,
        totalCents: lineItem.totalCents,
        taxRate: lineItem.taxRate ?? "",
        sortOrder: lineItem.sortOrder,
      })
    } else if (open) {
      form.reset({
        description: "",
        quantity: 1,
        unitPriceCents: 0,
        totalCents: 0,
        taxRate: "",
        sortOrder: 0,
      })
    }
  }, [open, lineItem, form])

  const onSubmit = async (values: LineItemFormOutput) => {
    const payload = {
      description: values.description,
      quantity: values.quantity,
      unitPriceCents: values.unitPriceCents,
      totalCents: values.totalCents,
      taxRate:
        values.taxRate !== "" && values.taxRate != null && typeof values.taxRate === "number"
          ? values.taxRate
          : null,
      sortOrder: values.sortOrder,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: lineItem!.id, input: payload })
      : await create.mutateAsync(payload)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Line Item" : "Add Line Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Input {...form.register("description")} placeholder="Service description..." />
              {form.formState.errors.description ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.description.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Quantity</Label>
                <Input {...form.register("quantity")} type="number" min="1" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Unit Price (cents)</Label>
                <Input {...form.register("unitPriceCents")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Total (cents)</Label>
                <Input {...form.register("totalCents")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Tax Rate (cents, e.g. 2000 = 20%)</Label>
                <Input {...form.register("taxRate")} type="number" min="0" placeholder="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sort Order</Label>
                <Input {...form.register("sortOrder")} type="number" min="0" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Line Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
