import { useOptionUnitPriceRuleMutation } from "@voyantjs/pricing-react"
import { PricingCategoryCombobox } from "@voyantjs/pricing-ui/components/pricing-category-combobox"
import {
  Button,
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
import { useProductDetailMessages } from "./host.js"
import type { OptionUnitData } from "./product-unit-form.js"
import { zodResolver } from "./zod-resolver.js"

type UnitPriceMessages = ReturnType<
  typeof useProductDetailMessages
>["products"]["operations"]["unitPrices"]

function getUnitTypeLabel(
  type: OptionUnitData["unitType"],
  messages: ReturnType<typeof useProductDetailMessages>["products"]["operations"]["units"],
) {
  switch (type) {
    case "person":
      return messages.typePerson
    case "group":
      return messages.typeGroup
    case "room":
      return messages.typeRoom
    case "vehicle":
      return messages.typeVehicle
    case "service":
      return messages.typeService
    case "other":
      return messages.typeOther
    default:
      return type
  }
}

const buildCellFormSchema = (messages: UnitPriceMessages) =>
  z.object({
    unitId: z.string().min(1, messages.validationUnitRequired),
    pricingCategoryId: z.string().optional().nullable(),
    pricingMode: z.enum([
      "per_unit",
      "per_person",
      "per_booking",
      "included",
      "free",
      "on_request",
    ]),
    sell: z.coerce.number().min(0),
    cost: z.coerce.number().min(0),
    minQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    maxQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    sortOrder: z.coerce.number().int(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })

type CellFormSchema = ReturnType<typeof buildCellFormSchema>
type CellFormValues = z.input<CellFormSchema>
type CellFormOutput = z.output<CellFormSchema>

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

export interface UnitPriceRuleFormProps {
  optionPriceRuleId: string
  optionId: string
  units: OptionUnitData[]
  preselectedUnitId?: string
  preselectedCategoryId?: string | null
  cell?: OptionUnitPriceRuleData
  onSuccess: () => void
  onCancel?: () => void
}

function initialValues(
  cell: OptionUnitPriceRuleData | undefined,
  preselectedUnitId: string | undefined,
  preselectedCategoryId: string | null | undefined,
): CellFormValues {
  if (cell) {
    return {
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
    }
  }
  return {
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
  }
}

export function UnitPriceRuleForm({
  optionPriceRuleId,
  optionId,
  units,
  preselectedUnitId,
  preselectedCategoryId,
  cell,
  onSuccess,
  onCancel,
}: UnitPriceRuleFormProps) {
  const messages = useProductDetailMessages()
  const productMessages = messages.products.core
  const unitPriceMessages = messages.products.operations.unitPrices
  const unitMessages = messages.products.operations.units
  const isEditing = !!cell
  const { create, update } = useOptionUnitPriceRuleMutation()
  const cellFormSchema = buildCellFormSchema(unitPriceMessages)
  const pricingModes = [
    { value: "per_unit", label: unitPriceMessages.pricingModePerUnit },
    { value: "per_person", label: unitPriceMessages.pricingModePerPerson },
    { value: "per_booking", label: unitPriceMessages.pricingModePerBooking },
    { value: "included", label: unitPriceMessages.pricingModeIncluded },
    { value: "free", label: unitPriceMessages.pricingModeFree },
    { value: "on_request", label: unitPriceMessages.pricingModeOnRequest },
  ] as const

  const form = useForm<CellFormValues, unknown, CellFormOutput>({
    resolver: zodResolver(cellFormSchema),
    defaultValues: initialValues(cell, preselectedUnitId, preselectedCategoryId),
  })

  useEffect(() => {
    form.reset(initialValues(cell, preselectedUnitId, preselectedCategoryId))
  }, [cell, preselectedUnitId, preselectedCategoryId, form])

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
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-4 overflow-hidden"
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{unitPriceMessages.unitLabel}</Label>
            <Select
              value={form.watch("unitId") || undefined}
              onValueChange={(v) => form.setValue("unitId", v ?? "", { shouldValidate: true })}
              items={units.map((u) => ({
                value: u.id,
                label: `${u.name} (${getUnitTypeLabel(u.unitType, unitMessages)})`,
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={unitPriceMessages.unitPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({getUnitTypeLabel(u.unitType, unitMessages)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.unitId && (
              <p className="text-xs text-destructive">{form.formState.errors.unitId.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{unitPriceMessages.categoryLabel}</Label>
            <PricingCategoryCombobox
              value={form.watch("pricingCategoryId")}
              onChange={(value) =>
                form.setValue("pricingCategoryId", value ?? "", { shouldDirty: true })
              }
              placeholder={unitPriceMessages.categoryPlaceholder}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{unitPriceMessages.pricingModeLabel}</Label>
          <Select
            value={form.watch("pricingMode")}
            onValueChange={(v) => form.setValue("pricingMode", v as CellFormValues["pricingMode"])}
            items={pricingModes}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pricingModes.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{unitPriceMessages.sellLabel}</Label>
            <Input {...form.register("sell")} type="number" step="0.01" min="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{unitPriceMessages.costLabel}</Label>
            <Input {...form.register("cost")} type="number" step="0.01" min="0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{unitPriceMessages.minQuantityLabel}</Label>
            <Input {...form.register("minQuantity")} type="number" min="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{unitPriceMessages.maxQuantityLabel}</Label>
            <Input {...form.register("maxQuantity")} type="number" min="0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{unitPriceMessages.sortOrderLabel}</Label>
            <Input {...form.register("sortOrder")} type="number" />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.watch("active")}
              onCheckedChange={(v) => form.setValue("active", v)}
            />
            <Label>{unitPriceMessages.activeLabel}</Label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{unitPriceMessages.notesLabel}</Label>
          <Textarea {...form.register("notes")} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {productMessages.cancel}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? productMessages.saveChanges : unitPriceMessages.create}
        </Button>
      </div>
    </form>
  )
}
