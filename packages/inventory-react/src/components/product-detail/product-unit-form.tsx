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
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useOptionUnitMutation } from "../../index.js"
import { useProductDetailMessages } from "./host.js"
import { zodResolver } from "./zod-resolver.js"

type UnitMessages = ReturnType<typeof useProductDetailMessages>["products"]["operations"]["units"]

type UnitType = OptionUnitData["unitType"]

// "Min/Max quantity" is meaningless to an agent — phrase it in terms of the
// thing being counted (rooms / vehicles / travelers) for the selected type.
function quantityLabels(unitType: UnitType, m: UnitMessages) {
  switch (unitType) {
    case "room":
      return { min: m.quantityRoomMin, max: m.quantityRoomMax }
    case "vehicle":
      return { min: m.quantityVehicleMin, max: m.quantityVehicleMax }
    case "person":
      return { min: m.quantityPersonMin, max: m.quantityPersonMax }
    default:
      return { min: m.minQuantityLabel, max: m.maxQuantityLabel }
  }
}

// Occupancy = how many people fit in one unit (guests per room, seats per
// vehicle, group size). Label it for the selected type.
function occupancyLabels(unitType: UnitType, m: UnitMessages) {
  switch (unitType) {
    case "room":
      return { min: m.occupancyRoomMin, max: m.occupancyRoomMax }
    case "vehicle":
      return { min: m.occupancyVehicleMin, max: m.occupancyVehicleMax }
    case "group":
      return { min: m.occupancyGroupMin, max: m.occupancyGroupMax }
    default:
      return { min: m.occupancyMinLabel, max: m.occupancyMaxLabel }
  }
}

const buildUnitFormSchema = (messages: UnitMessages) =>
  z.object({
    name: z.string().min(1, messages.validationNameRequired).max(255),
    code: z.string().max(100).optional().nullable(),
    description: z.string().optional().nullable(),
    unitType: z.enum(["person", "group", "room", "vehicle", "service", "other"]),
    minQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    maxQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    minAge: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    maxAge: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    occupancyMin: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    occupancyMax: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    isRequired: z.boolean(),
    isHidden: z.boolean(),
    sortOrder: z.coerce.number().int(),
  })

type UnitFormSchema = ReturnType<typeof buildUnitFormSchema>
type UnitFormValues = z.input<UnitFormSchema>
type UnitFormOutput = z.output<UnitFormSchema>

export type OptionUnitData = {
  id: string
  optionId: string
  name: string
  code: string | null
  description: string | null
  unitType: "person" | "group" | "room" | "vehicle" | "service" | "other"
  minQuantity: number | null
  maxQuantity: number | null
  minAge: number | null
  maxAge: number | null
  occupancyMin: number | null
  occupancyMax: number | null
  isRequired: boolean
  isHidden: boolean
  sortOrder: number
}

export interface UnitFormProps {
  optionId: string
  unit?: OptionUnitData
  /** Pre-selected unit type for the "add" path (e.g. Room vs Traveler type). */
  defaultUnitType?: OptionUnitData["unitType"]
  /**
   * Hide the unit-type picker entirely. Used when the form is opened from a
   * type-specific context (e.g. "Add room"), so the agent can't turn a room
   * into a vehicle and create a nonsensical mix in the pricing grid.
   */
  lockUnitType?: boolean
  nextSortOrder?: number
  onSuccess: () => void
  onCancel?: () => void
}

function initialValues(
  unit: OptionUnitData | undefined,
  nextSortOrder: number | undefined,
  defaultUnitType: OptionUnitData["unitType"] | undefined,
) {
  if (unit) {
    return {
      name: unit.name,
      code: unit.code ?? "",
      description: unit.description ?? "",
      unitType: unit.unitType,
      minQuantity: unit.minQuantity ?? "",
      maxQuantity: unit.maxQuantity ?? "",
      minAge: unit.minAge ?? "",
      maxAge: unit.maxAge ?? "",
      occupancyMin: unit.occupancyMin ?? "",
      occupancyMax: unit.occupancyMax ?? "",
      isRequired: unit.isRequired,
      isHidden: unit.isHidden,
      sortOrder: unit.sortOrder,
    } satisfies UnitFormValues
  }
  return {
    name: "",
    code: "",
    description: "",
    unitType: defaultUnitType ?? "person",
    minQuantity: "",
    maxQuantity: "",
    minAge: "",
    maxAge: "",
    occupancyMin: "",
    occupancyMax: "",
    isRequired: false,
    isHidden: false,
    sortOrder: nextSortOrder ?? 0,
  } satisfies UnitFormValues
}

export function UnitForm({
  optionId,
  unit,
  defaultUnitType,
  lockUnitType,
  nextSortOrder,
  onSuccess,
  onCancel,
}: UnitFormProps) {
  const messages = useProductDetailMessages()
  const productMessages = messages.products.core
  const unitMessages = messages.products.operations.units
  const isEditing = !!unit
  const { create, update } = useOptionUnitMutation()
  const unitFormSchema = buildUnitFormSchema(unitMessages)
  const unitTypes = [
    { value: "person", label: unitMessages.typePerson },
    { value: "group", label: unitMessages.typeGroup },
    { value: "room", label: unitMessages.typeRoom },
    { value: "vehicle", label: unitMessages.typeVehicle },
    { value: "service", label: unitMessages.typeService },
    { value: "other", label: unitMessages.typeOther },
  ] as const

  const form = useForm<UnitFormValues, unknown, UnitFormOutput>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: initialValues(unit, nextSortOrder, defaultUnitType),
  })

  useEffect(() => {
    form.reset(initialValues(unit, nextSortOrder, defaultUnitType))
  }, [unit, nextSortOrder, defaultUnitType, form])

  const onSubmit = async (values: UnitFormOutput) => {
    const canHaveAge = values.unitType === "person"
    const canHaveOccupancy =
      values.unitType === "group" || values.unitType === "room" || values.unitType === "vehicle"

    const payload = {
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      unitType: values.unitType,
      minQuantity: typeof values.minQuantity === "number" ? values.minQuantity : null,
      maxQuantity: typeof values.maxQuantity === "number" ? values.maxQuantity : null,
      minAge: canHaveAge && typeof values.minAge === "number" ? values.minAge : null,
      maxAge: canHaveAge && typeof values.maxAge === "number" ? values.maxAge : null,
      occupancyMin:
        canHaveOccupancy && typeof values.occupancyMin === "number" ? values.occupancyMin : null,
      occupancyMax:
        canHaveOccupancy && typeof values.occupancyMax === "number" ? values.occupancyMax : null,
      isRequired: values.isRequired,
      isHidden: values.isHidden,
      sortOrder: values.sortOrder,
    }

    if (isEditing) {
      await update.mutateAsync({ id: unit.id, input: payload })
    } else {
      await create.mutateAsync({ optionId, ...payload })
    }
    onSuccess()
  }

  const unitType = form.watch("unitType")
  const qtyLabels = quantityLabels(unitType, unitMessages)
  const occLabels = occupancyLabels(unitType, unitMessages)

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-4 overflow-hidden"
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{unitMessages.nameLabel}</Label>
            <Input {...form.register("name")} placeholder={unitMessages.namePlaceholder} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{unitMessages.codeLabel}</Label>
            <Input {...form.register("code")} placeholder={unitMessages.codePlaceholder} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {lockUnitType ? null : (
            <div className="flex flex-col gap-2">
              <Label>{unitMessages.typeLabel}</Label>
              <Select
                value={unitType}
                onValueChange={(v) => form.setValue("unitType", v as UnitFormValues["unitType"])}
                items={unitTypes}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>{unitMessages.sortOrderLabel}</Label>
            <Input {...form.register("sortOrder")} type="number" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{qtyLabels.min}</Label>
            <Input {...form.register("minQuantity")} type="number" min="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{qtyLabels.max}</Label>
            <Input {...form.register("maxQuantity")} type="number" min="0" />
          </div>
        </div>

        {unitType === "person" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>{unitMessages.minAgeLabel}</Label>
              <Input {...form.register("minAge")} type="number" min="0" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{unitMessages.maxAgeLabel}</Label>
              <Input {...form.register("maxAge")} type="number" min="0" />
            </div>
          </div>
        )}

        {(unitType === "room" || unitType === "vehicle" || unitType === "group") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>{occLabels.min}</Label>
              <Input {...form.register("occupancyMin")} type="number" min="0" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{occLabels.max}</Label>
              <Input {...form.register("occupancyMax")} type="number" min="0" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>{unitMessages.descriptionLabel}</Label>
          <Textarea {...form.register("description")} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.watch("isRequired")}
              onCheckedChange={(v) => form.setValue("isRequired", v)}
            />
            <Label>{unitMessages.requiredLabel}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.watch("isHidden")}
              onCheckedChange={(v) => form.setValue("isHidden", v)}
            />
            <Label>{unitMessages.hiddenLabel}</Label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {productMessages.cancel}
          </Button>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={form.formState.isSubmitting || create.isPending || update.isPending}
        >
          {(form.formState.isSubmitting || create.isPending || update.isPending) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isEditing ? productMessages.saveChanges : unitMessages.create}
        </Button>
      </div>
    </form>
  )
}
