"use client"

import { type ProductExtraRecord, useProductExtraMutation } from "@voyantjs/extras-react"
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
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const SELECTION_TYPES = [
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
  { value: "default_selected", label: "Default selected" },
  { value: "unavailable", label: "Unavailable" },
] as const

const PRICING_MODES = [
  { value: "included", label: "Included" },
  { value: "per_person", label: "Per person" },
  { value: "per_booking", label: "Per booking" },
  { value: "quantity_based", label: "Quantity based" },
  { value: "on_request", label: "On request" },
  { value: "free", label: "Free" },
] as const

type SelectionType = (typeof SELECTION_TYPES)[number]["value"]
type PricingMode = (typeof PRICING_MODES)[number]["value"]

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  selectionType: z.enum(["optional", "required", "default_selected", "unavailable"]),
  pricingMode: z.enum([
    "included",
    "per_person",
    "per_booking",
    "quantity_based",
    "on_request",
    "free",
  ]),
  pricedPerPerson: z.boolean(),
  minQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  maxQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  defaultQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  extra?: ProductExtraRecord
  nextSortOrder?: number
  onSuccess?: (extra: ProductExtraRecord) => void
}

export function ProductExtraDialog({
  open,
  onOpenChange,
  productId,
  extra,
  nextSortOrder,
  onSuccess,
}: Props) {
  const isEditing = !!extra
  const { create, update } = useProductExtraMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      selectionType: "optional",
      pricingMode: "per_booking",
      pricedPerPerson: false,
      minQuantity: "",
      maxQuantity: "",
      defaultQuantity: "",
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && extra) {
      form.reset({
        name: extra.name,
        code: extra.code ?? "",
        description: extra.description ?? "",
        selectionType: extra.selectionType,
        pricingMode: extra.pricingMode,
        pricedPerPerson: extra.pricedPerPerson,
        minQuantity: extra.minQuantity ?? "",
        maxQuantity: extra.maxQuantity ?? "",
        defaultQuantity: extra.defaultQuantity ?? "",
        active: extra.active,
        sortOrder: extra.sortOrder,
      })
    } else if (open) {
      form.reset({
        name: "",
        code: "",
        description: "",
        selectionType: "optional",
        pricingMode: "per_booking",
        pricedPerPerson: false,
        minQuantity: "",
        maxQuantity: "",
        defaultQuantity: "",
        active: true,
        sortOrder: nextSortOrder ?? 0,
      })
    }
  }, [extra, form, nextSortOrder, open])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      productId,
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      selectionType: values.selectionType,
      pricingMode: values.pricingMode,
      pricedPerPerson: values.pricedPerPerson,
      minQuantity: typeof values.minQuantity === "number" ? values.minQuantity : null,
      maxQuantity: typeof values.maxQuantity === "number" ? values.maxQuantity : null,
      defaultQuantity: typeof values.defaultQuantity === "number" ? values.defaultQuantity : null,
      active: values.active,
      sortOrder: values.sortOrder,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: extra.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Extra" : "Add Extra"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Airport transfer" />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="airport-transfer" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea
                {...form.register("description")}
                placeholder="Shown to travelers when choosing extras…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Selection type</Label>
                <Select
                  items={SELECTION_TYPES}
                  value={form.watch("selectionType")}
                  onValueChange={(value) => form.setValue("selectionType", value as SelectionType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELECTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Pricing mode</Label>
                <Select
                  items={PRICING_MODES}
                  value={form.watch("pricingMode")}
                  onValueChange={(value) => form.setValue("pricingMode", value as PricingMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_MODES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Min quantity</Label>
                <Input {...form.register("minQuantity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max quantity</Label>
                <Input {...form.register("maxQuantity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Default quantity</Label>
                <Input {...form.register("defaultQuantity")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("pricedPerPerson")}
                  onCheckedChange={(value) => form.setValue("pricedPerPerson", value)}
                />
                <Label>Per person</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(value) => form.setValue("active", value)}
                />
                <Label>Active</Label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Extra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
