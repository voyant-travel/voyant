import { type RoomTypeRecord, useRoomTypeMutation } from "@voyantjs/hospitality-react"
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

const INVENTORY_MODES = ["virtual", "pooled", "serialized"] as const

type InventoryMode = RoomTypeRecord["inventoryMode"]

const intOrEmpty = z.coerce.number().int().optional().or(z.literal("")).nullable()

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  inventoryMode: z.enum(INVENTORY_MODES),
  maxAdults: intOrEmpty,
  maxChildren: intOrEmpty,
  maxInfants: intOrEmpty,
  standardOccupancy: intOrEmpty,
  maxOccupancy: intOrEmpty,
  minOccupancy: intOrEmpty,
  bedroomCount: intOrEmpty,
  bathroomCount: intOrEmpty,
  smokingAllowed: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export type RoomTypeData = RoomTypeRecord

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  roomType?: RoomTypeData
  onSuccess: () => void
}

export function RoomTypeDialog({ open, onOpenChange, propertyId, roomType, onSuccess }: Props) {
  const isEditing = !!roomType
  const { create, update } = useRoomTypeMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      inventoryMode: "pooled",
      maxAdults: "",
      maxChildren: "",
      maxInfants: "",
      standardOccupancy: "",
      maxOccupancy: "",
      minOccupancy: "",
      bedroomCount: "",
      bathroomCount: "",
      smokingAllowed: false,
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && roomType) {
      form.reset({
        name: roomType.name,
        code: roomType.code ?? "",
        description: roomType.description ?? "",
        inventoryMode: roomType.inventoryMode,
        maxAdults: roomType.maxAdults ?? "",
        maxChildren: roomType.maxChildren ?? "",
        maxInfants: roomType.maxInfants ?? "",
        standardOccupancy: roomType.standardOccupancy ?? "",
        maxOccupancy: roomType.maxOccupancy ?? "",
        minOccupancy: roomType.minOccupancy ?? "",
        bedroomCount: roomType.bedroomCount ?? "",
        bathroomCount: roomType.bathroomCount ?? "",
        smokingAllowed: roomType.smokingAllowed,
        active: roomType.active,
        sortOrder: roomType.sortOrder,
      })
    } else if (open) {
      form.reset({
        name: "",
        code: "",
        description: "",
        inventoryMode: "pooled",
        maxAdults: "",
        maxChildren: "",
        maxInfants: "",
        standardOccupancy: "",
        maxOccupancy: "",
        minOccupancy: "",
        bedroomCount: "",
        bathroomCount: "",
        smokingAllowed: false,
        active: true,
        sortOrder: 0,
      })
    }
  }, [open, roomType, form])

  const onSubmit = async (values: FormOutput) => {
    const toInt = (v: number | string | null | undefined) => (typeof v === "number" ? v : null)
    const payload = {
      propertyId,
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      inventoryMode: values.inventoryMode,
      maxAdults: toInt(values.maxAdults),
      maxChildren: toInt(values.maxChildren),
      maxInfants: toInt(values.maxInfants),
      standardOccupancy: toInt(values.standardOccupancy),
      maxOccupancy: toInt(values.maxOccupancy),
      minOccupancy: toInt(values.minOccupancy),
      bedroomCount: toInt(values.bedroomCount),
      bathroomCount: toInt(values.bathroomCount),
      smokingAllowed: values.smokingAllowed,
      active: values.active,
      sortOrder: values.sortOrder,
    }
    if (isEditing) {
      await update.mutateAsync({ id: roomType.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Room Type" : "Add Room Type"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Deluxe Double" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="DLX-DBL" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Inventory mode</Label>
                <Select
                  items={INVENTORY_MODES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("inventoryMode")}
                  onValueChange={(v) => form.setValue("inventoryMode", v as InventoryMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_MODES.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">
                        {m}
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

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Std. occupancy</Label>
                <Input {...form.register("standardOccupancy")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Min occupancy</Label>
                <Input {...form.register("minOccupancy")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max occupancy</Label>
                <Input {...form.register("maxOccupancy")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Max adults</Label>
                <Input {...form.register("maxAdults")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max children</Label>
                <Input {...form.register("maxChildren")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max infants</Label>
                <Input {...form.register("maxInfants")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Bedrooms</Label>
                <Input {...form.register("bedroomCount")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Bathrooms</Label>
                <Input {...form.register("bathroomCount")} type="number" min="0" />
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("smokingAllowed")}
                  onCheckedChange={(v) => form.setValue("smokingAllowed", v)}
                />
                <Label>Smoking allowed</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(v) => form.setValue("active", v)}
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
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Room Type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
