import { useOptionUnitMutation } from "@voyantjs/products-react"
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
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

type UnitMessages = ReturnType<typeof useAdminMessages>["products"]["operations"]["units"]

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
  nextSortOrder?: number
  onSuccess: () => void
  onCancel?: () => void
}

function initialValues(unit: OptionUnitData | undefined, nextSortOrder: number | undefined) {
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
    unitType: "person",
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

export function UnitForm({ optionId, unit, nextSortOrder, onSuccess, onCancel }: UnitFormProps) {
  const messages = useAdminMessages()
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
    defaultValues: initialValues(unit, nextSortOrder),
  })

  useEffect(() => {
    form.reset(initialValues(unit, nextSortOrder))
  }, [unit, nextSortOrder, form])

  const onSubmit = async (values: UnitFormOutput) => {
    const payload = {
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      unitType: values.unitType,
      minQuantity: typeof values.minQuantity === "number" ? values.minQuantity : null,
      maxQuantity: typeof values.maxQuantity === "number" ? values.maxQuantity : null,
      minAge: typeof values.minAge === "number" ? values.minAge : null,
      maxAge: typeof values.maxAge === "number" ? values.maxAge : null,
      occupancyMin: typeof values.occupancyMin === "number" ? values.occupancyMin : null,
      occupancyMax: typeof values.occupancyMax === "number" ? values.occupancyMax : null,
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

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-4 overflow-hidden"
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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
          <div className="flex flex-col gap-2">
            <Label>{unitMessages.sortOrderLabel}</Label>
            <Input {...form.register("sortOrder")} type="number" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{unitMessages.minQuantityLabel}</Label>
            <Input {...form.register("minQuantity")} type="number" min="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{unitMessages.maxQuantityLabel}</Label>
            <Input {...form.register("maxQuantity")} type="number" min="0" />
          </div>
        </div>

        {unitType === "person" && (
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>{unitMessages.occupancyMinLabel}</Label>
              <Input {...form.register("occupancyMin")} type="number" min="0" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{unitMessages.occupancyMaxLabel}</Label>
              <Input {...form.register("occupancyMax")} type="number" min="0" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>{unitMessages.descriptionLabel}</Label>
          <Textarea {...form.register("description")} />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
