"use client"

import {
  type CreateGroundVehicleInput,
  type GroundVehicleRecord,
  type UpdateGroundVehicleInput,
  useGroundVehicleMutation,
} from "@voyantjs/ground-react"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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
} from "@/components/ui"
import { EntityCombobox } from "@/components/ui/entity-combobox"
import { zodResolver } from "@/lib/zod-resolver"
import { useRegistryGroundMessagesOrDefault } from "./i18n"

type ResourceRef = { id: string; name: string; kind?: string | null }
type OperatorRef = { id: string; name: string; code?: string | null }

const GROUND_VEHICLE_CATEGORIES = [
  "car",
  "sedan",
  "suv",
  "van",
  "minibus",
  "bus",
  "boat",
  "train",
  "other",
] as const

const GROUND_VEHICLE_CLASSES = [
  "economy",
  "standard",
  "premium",
  "luxury",
  "accessible",
  "other",
] as const

type VehicleCategory = (typeof GROUND_VEHICLE_CATEGORIES)[number]
type VehicleClass = (typeof GROUND_VEHICLE_CLASSES)[number]

export interface VehicleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: GroundVehicleRecord
  onSuccess?: (vehicle: GroundVehicleRecord) => void
}

function numberOrNull(value: number | "" | null | undefined) {
  return typeof value === "number" ? value : null
}

export function VehicleDialog({ open, onOpenChange, vehicle, onSuccess }: VehicleDialogProps) {
  const messages = useRegistryGroundMessagesOrDefault()
  const dialogMessages = messages.vehicleDialog
  const isEditing = Boolean(vehicle)
  const { create, update } = useGroundVehicleMutation()
  const formSchema = z.object({
    resourceId: z.string().min(1, dialogMessages.errors.resourceRequired),
    operatorId: z.string().optional().nullable(),
    category: z.enum(GROUND_VEHICLE_CATEGORIES),
    vehicleClass: z.enum(GROUND_VEHICLE_CLASSES),
    passengerCapacity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    checkedBagCapacity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    carryOnCapacity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    wheelchairCapacity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    childSeatCapacity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    isAccessible: z.boolean(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })

  type FormValues = z.input<typeof formSchema>
  type FormOutput = z.output<typeof formSchema>
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      resourceId: "",
      operatorId: "",
      category: "other",
      vehicleClass: "standard",
      passengerCapacity: "",
      checkedBagCapacity: "",
      carryOnCapacity: "",
      wheelchairCapacity: "",
      childSeatCapacity: "",
      isAccessible: false,
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && vehicle) {
      form.reset({
        resourceId: vehicle.resourceId,
        operatorId: vehicle.operatorId ?? "",
        category: vehicle.category,
        vehicleClass: vehicle.vehicleClass,
        passengerCapacity: vehicle.passengerCapacity ?? "",
        checkedBagCapacity: vehicle.checkedBagCapacity ?? "",
        carryOnCapacity: vehicle.carryOnCapacity ?? "",
        wheelchairCapacity: vehicle.wheelchairCapacity ?? "",
        childSeatCapacity: vehicle.childSeatCapacity ?? "",
        isAccessible: vehicle.isAccessible,
        active: vehicle.active,
        notes: vehicle.notes ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        resourceId: "",
        operatorId: "",
        category: "other",
        vehicleClass: "standard",
        passengerCapacity: "",
        checkedBagCapacity: "",
        carryOnCapacity: "",
        wheelchairCapacity: "",
        childSeatCapacity: "",
        isAccessible: false,
        active: true,
        notes: "",
      })
    }
  }, [form, open, vehicle])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateGroundVehicleInput | UpdateGroundVehicleInput = {
      resourceId: values.resourceId,
      operatorId: values.operatorId || null,
      category: values.category,
      vehicleClass: values.vehicleClass,
      passengerCapacity: numberOrNull(values.passengerCapacity),
      checkedBagCapacity: numberOrNull(values.checkedBagCapacity),
      carryOnCapacity: numberOrNull(values.carryOnCapacity),
      wheelchairCapacity: numberOrNull(values.wheelchairCapacity),
      childSeatCapacity: numberOrNull(values.childSeatCapacity),
      isAccessible: values.isAccessible,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: vehicle!.id, input: payload })
      : await create.mutateAsync(payload as CreateGroundVehicleInput)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.addTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.resource}</Label>
                <EntityCombobox<ResourceRef>
                  value={form.watch("resourceId") || null}
                  onChange={(id) => form.setValue("resourceId", id ?? "")}
                  endpoint="/v1/resources/resources"
                  detailEndpoint="/v1/resources/resources/:id"
                  queryKey={["resources", "picker"]}
                  getLabel={(resource) => resource.name}
                  getSecondary={(resource) => resource.kind ?? undefined}
                  placeholder={dialogMessages.placeholders.resource}
                  emptyText={dialogMessages.placeholders.resourceEmpty}
                />
                {form.formState.errors.resourceId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.resourceId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.operator}</Label>
                <EntityCombobox<OperatorRef>
                  value={form.watch("operatorId") ?? null}
                  onChange={(id) => form.setValue("operatorId", id)}
                  endpoint="/v1/ground/operators"
                  detailEndpoint="/v1/ground/operators/:id"
                  queryKey={["ground", "operators", "picker"]}
                  getLabel={(groundOperator) => groundOperator.name}
                  getSecondary={(groundOperator) => groundOperator.code ?? undefined}
                  placeholder={dialogMessages.placeholders.operator}
                  emptyText={dialogMessages.placeholders.operatorEmpty}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.category}</Label>
                <Select
                  items={GROUND_VEHICLE_CATEGORIES.map((x) => ({
                    label: messages.common.categoryLabels[x],
                    value: x,
                  }))}
                  value={form.watch("category")}
                  onValueChange={(value) => form.setValue("category", value as VehicleCategory)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUND_VEHICLE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category} className="capitalize">
                        {messages.common.categoryLabels[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.class}</Label>
                <Select
                  items={GROUND_VEHICLE_CLASSES.map((x) => ({
                    label: messages.common.classLabels[x],
                    value: x,
                  }))}
                  value={form.watch("vehicleClass")}
                  onValueChange={(value) => form.setValue("vehicleClass", value as VehicleClass)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUND_VEHICLE_CLASSES.map((vehicleClass) => (
                      <SelectItem key={vehicleClass} value={vehicleClass} className="capitalize">
                        {messages.common.classLabels[vehicleClass]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.passengers}</Label>
                <Input {...form.register("passengerCapacity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.checkedBags}</Label>
                <Input {...form.register("checkedBagCapacity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.carryOn}</Label>
                <Input {...form.register("carryOnCapacity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.wheelchairs}</Label>
                <Input {...form.register("wheelchairCapacity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.childSeats}</Label>
                <Input {...form.register("childSeatCapacity")} type="number" min="0" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isAccessible")}
                  onCheckedChange={(value) => form.setValue("isAccessible", value)}
                />
                <Label>{dialogMessages.fields.accessible}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(value) => form.setValue("active", value)}
                />
                <Label>{dialogMessages.fields.active}</Label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : dialogMessages.actions.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
