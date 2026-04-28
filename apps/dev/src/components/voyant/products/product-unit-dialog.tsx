import { useOptionUnitMutation } from "@voyantjs/products-react"
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

const unitFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
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

type UnitFormValues = z.input<typeof unitFormSchema>
type UnitFormOutput = z.output<typeof unitFormSchema>

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

type UnitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  optionId: string
  unit?: OptionUnitData
  nextSortOrder?: number
  onSuccess: () => void
}

const UNIT_TYPES = [
  { value: "person", label: "Person" },
  { value: "group", label: "Group" },
  { value: "room", label: "Room" },
  { value: "vehicle", label: "Vehicle" },
  { value: "service", label: "Service" },
  { value: "other", label: "Other" },
] as const

export function UnitDialog({
  open,
  onOpenChange,
  optionId,
  unit,
  nextSortOrder,
  onSuccess,
}: UnitDialogProps) {
  const isEditing = !!unit
  const { create, update } = useOptionUnitMutation()

  const form = useForm<UnitFormValues, unknown, UnitFormOutput>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
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
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && unit) {
      form.reset({
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
      })
    } else if (open) {
      form.reset({
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
      })
    }
  }, [open, unit, nextSortOrder, form])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Unit" : "New Unit"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Adult" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="adult" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select
                  items={UNIT_TYPES}
                  value={form.watch("unitType")}
                  onValueChange={(v) => form.setValue("unitType", v as UnitFormValues["unitType"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input {...form.register("sortOrder")} type="number" />
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

            {form.watch("unitType") === "person" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Min age</Label>
                  <Input {...form.register("minAge")} type="number" min="0" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Max age</Label>
                  <Input {...form.register("maxAge")} type="number" min="0" />
                </div>
              </div>
            )}

            {(form.watch("unitType") === "room" ||
              form.watch("unitType") === "vehicle" ||
              form.watch("unitType") === "group") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Occupancy min</Label>
                  <Input {...form.register("occupancyMin")} type="number" min="0" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Occupancy max</Label>
                  <Input {...form.register("occupancyMax")} type="number" min="0" />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isRequired")}
                  onCheckedChange={(v) => form.setValue("isRequired", v)}
                />
                <Label>Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isHidden")}
                  onCheckedChange={(v) => form.setValue("isHidden", v)}
                />
                <Label>Hidden</Label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || create.isPending || update.isPending}
            >
              {(form.formState.isSubmitting || create.isPending || update.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Save Changes" : "Create Unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
