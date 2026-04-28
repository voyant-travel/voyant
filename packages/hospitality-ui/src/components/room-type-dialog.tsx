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
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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

export interface RoomTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  roomType?: RoomTypeRecord
  onSuccess?: (roomType: RoomTypeRecord) => void
}

export function RoomTypeDialog({
  open,
  onOpenChange,
  propertyId,
  roomType,
  onSuccess,
}: RoomTypeDialogProps) {
  const isEditing = Boolean(roomType)
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
  }, [form, open, roomType])

  const onSubmit = async (values: FormOutput) => {
    const toInt = (value: number | string | null | undefined) =>
      typeof value === "number" ? value : null

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

    const saved = isEditing
      ? await update.mutateAsync({ id: roomType!.id, input: payload })
      : await create.mutateAsync(payload)

    onOpenChange(false)
    onSuccess?.(saved)
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
                  onValueChange={(value) => form.setValue("inventoryMode", value as InventoryMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode} className="capitalize">
                        {mode}
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
                  onCheckedChange={(checked) => form.setValue("smokingAllowed", checked)}
                />
                <Label>Smoking allowed</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
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
              {isEditing ? "Save Changes" : "Add Room Type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
