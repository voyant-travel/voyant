import { useOptionUnitPriceRuleMutation } from "@voyantjs/pricing-react"
import { PricingCategoryCombobox } from "@voyantjs/pricing-ui/components/pricing-category-combobox"
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
import type { OptionUnitData } from "./product-unit-dialog"

const cellFormSchema = z.object({
  unitId: z.string().min(1, "Unit is required"),
  pricingCategoryId: z.string().optional().nullable(),
  pricingMode: z.enum(["per_unit", "per_person", "per_booking", "included", "free", "on_request"]),
  sell: z.coerce.number().min(0),
  cost: z.coerce.number().min(0),
  minQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  maxQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  sortOrder: z.coerce.number().int(),
  active: z.boolean(),
  notes: z.string().optional().nullable(),
})

type CellFormValues = z.input<typeof cellFormSchema>
type CellFormOutput = z.output<typeof cellFormSchema>

export type OptionUnitPriceRuleData = {
  id: string
  optionPriceRuleId: string
  optionId: string
  unitId: string
  pricingCategoryId: string | null
  pricingMode: "per_unit" | "per_person" | "per_booking" | "included" | "free" | "on_request"
  sellAmountCents: number | null
  costAmountCents: number | null
  minQuantity: number | null
  maxQuantity: number | null
  sortOrder: number
  active: boolean
  notes: string | null
}

type UnitPriceRuleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  optionPriceRuleId: string
  optionId: string
  units: OptionUnitData[]
  preselectedUnitId?: string
  preselectedCategoryId?: string | null
  cell?: OptionUnitPriceRuleData
  onSuccess: () => void
}

const UNIT_PRICING_MODES = [
  { value: "per_unit", label: "Per Unit" },
  { value: "per_person", label: "Per Person" },
  { value: "per_booking", label: "Per Booking" },
  { value: "included", label: "Included" },
  { value: "free", label: "Free" },
  { value: "on_request", label: "On Request" },
] as const

export function UnitPriceRuleDialog({
  open,
  onOpenChange,
  optionPriceRuleId,
  optionId,
  units,
  preselectedUnitId,
  preselectedCategoryId,
  cell,
  onSuccess,
}: UnitPriceRuleDialogProps) {
  const isEditing = !!cell
  const { create, update } = useOptionUnitPriceRuleMutation()

  const form = useForm<CellFormValues, unknown, CellFormOutput>({
    resolver: zodResolver(cellFormSchema),
    defaultValues: {
      unitId: "",
      pricingCategoryId: "",
      pricingMode: "per_person",
      sell: 0,
      cost: 0,
      minQuantity: "",
      maxQuantity: "",
      sortOrder: 0,
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && cell) {
      form.reset({
        unitId: cell.unitId,
        pricingCategoryId: cell.pricingCategoryId ?? "",
        pricingMode: cell.pricingMode,
        sell: (cell.sellAmountCents ?? 0) / 100,
        cost: (cell.costAmountCents ?? 0) / 100,
        minQuantity: cell.minQuantity ?? "",
        maxQuantity: cell.maxQuantity ?? "",
        sortOrder: cell.sortOrder,
        active: cell.active,
        notes: cell.notes ?? "",
      })
    } else if (open) {
      form.reset({
        unitId: preselectedUnitId ?? "",
        pricingCategoryId: preselectedCategoryId ?? "",
        pricingMode: "per_person",
        sell: 0,
        cost: 0,
        minQuantity: "",
        maxQuantity: "",
        sortOrder: 0,
        active: true,
        notes: "",
      })
    }
  }, [open, cell, preselectedUnitId, preselectedCategoryId, form])

  const onSubmit = async (values: CellFormOutput) => {
    const payload = {
      optionPriceRuleId,
      optionId,
      unitId: values.unitId,
      pricingCategoryId: values.pricingCategoryId || null,
      pricingMode: values.pricingMode,
      sellAmountCents: Math.round(values.sell * 100),
      costAmountCents: Math.round(values.cost * 100),
      minQuantity: typeof values.minQuantity === "number" ? values.minQuantity : null,
      maxQuantity: typeof values.maxQuantity === "number" ? values.maxQuantity : null,
      sortOrder: values.sortOrder,
      active: values.active,
      notes: values.notes || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: cell.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Price" : "Set Price"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Unit</Label>
                <select
                  {...form.register("unitId")}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select…</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.unitType})
                    </option>
                  ))}
                </select>
                {form.formState.errors.unitId && (
                  <p className="text-xs text-destructive">{form.formState.errors.unitId.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <PricingCategoryCombobox
                  value={form.watch("pricingCategoryId")}
                  onChange={(value) =>
                    form.setValue("pricingCategoryId", value ?? "", { shouldDirty: true })
                  }
                  placeholder="Search pricing categories…"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Pricing mode</Label>
              <Select
                items={UNIT_PRICING_MODES}
                value={form.watch("pricingMode")}
                onValueChange={(v) =>
                  form.setValue("pricingMode", v as CellFormValues["pricingMode"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_PRICING_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sell</Label>
                <Input {...form.register("sell")} type="number" step="0.01" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Cost</Label>
                <Input {...form.register("cost")} type="number" step="0.01" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Min quantity</Label>
                <Input {...form.register("minQuantity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max quantity</Label>
                <Input {...form.register("maxQuantity")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(v) => form.setValue("active", v)}
                />
                <Label>Active</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Set Price"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
