import { type RoomInventoryRecord, useRoomInventoryMutation } from "@voyantjs/hospitality-react"
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
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { RoomTypeCombobox } from "./room-type-combobox"

export type RoomInventoryData = RoomInventoryRecord

const intOrEmpty = z.coerce.number().int().optional().or(z.literal("")).nullable()

const formSchema = z.object({
  roomTypeId: z.string().min(1, "Room type is required"),
  date: z.string().min(1, "Date is required"),
  totalUnits: z.coerce.number().int().min(0),
  availableUnits: z.coerce.number().int().min(0),
  heldUnits: z.coerce.number().int().min(0),
  soldUnits: z.coerce.number().int().min(0),
  outOfOrderUnits: z.coerce.number().int().min(0),
  overbookLimit: intOrEmpty,
  stopSell: z.boolean(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface RoomInventoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  inventory?: RoomInventoryRecord
  onSuccess?: (inventory: RoomInventoryRecord) => void
}

export function RoomInventoryDialog({
  open,
  onOpenChange,
  propertyId,
  inventory,
  onSuccess,
}: RoomInventoryDialogProps) {
  const isEditing = Boolean(inventory)
  const { create, update } = useRoomInventoryMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomTypeId: "",
      date: "",
      totalUnits: 0,
      availableUnits: 0,
      heldUnits: 0,
      soldUnits: 0,
      outOfOrderUnits: 0,
      overbookLimit: "",
      stopSell: false,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && inventory) {
      form.reset({
        roomTypeId: inventory.roomTypeId,
        date: inventory.date,
        totalUnits: inventory.totalUnits,
        availableUnits: inventory.availableUnits,
        heldUnits: inventory.heldUnits,
        soldUnits: inventory.soldUnits,
        outOfOrderUnits: inventory.outOfOrderUnits,
        overbookLimit: inventory.overbookLimit ?? "",
        stopSell: inventory.stopSell,
        notes: inventory.notes ?? "",
      })
    } else if (open) {
      form.reset({
        roomTypeId: "",
        date: "",
        totalUnits: 0,
        availableUnits: 0,
        heldUnits: 0,
        soldUnits: 0,
        outOfOrderUnits: 0,
        overbookLimit: "",
        stopSell: false,
        notes: "",
      })
    }
  }, [open, inventory, form])

  const onSubmit = async (values: FormOutput) => {
    const toInt = (value: number | string | null | undefined) =>
      typeof value === "number" ? value : null

    const payload = {
      propertyId,
      roomTypeId: values.roomTypeId,
      date: values.date,
      totalUnits: values.totalUnits,
      availableUnits: values.availableUnits,
      heldUnits: values.heldUnits,
      soldUnits: values.soldUnits,
      outOfOrderUnits: values.outOfOrderUnits,
      overbookLimit: toInt(values.overbookLimit),
      stopSell: values.stopSell,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: inventory!.id, input: payload })
      : await create.mutateAsync(payload)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Room Inventory" : "Add Room Inventory"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Room type</Label>
                <RoomTypeCombobox
                  propertyId={propertyId}
                  value={form.watch("roomTypeId")}
                  onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                  placeholder="Select a room type…"
                  disabled={isEditing}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Date</Label>
                <DatePicker
                  value={form.watch("date") || null}
                  onChange={(next) =>
                    form.setValue("date", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select date"
                  className="w-full"
                  disabled={isEditing}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Total</Label>
                <Input {...form.register("totalUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Available</Label>
                <Input {...form.register("availableUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Held</Label>
                <Input {...form.register("heldUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sold</Label>
                <Input {...form.register("soldUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Out of order</Label>
                <Input {...form.register("outOfOrderUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Overbook limit</Label>
                <Input {...form.register("overbookLimit")} type="number" min="0" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("stopSell")}
                onCheckedChange={(checked) => form.setValue("stopSell", checked)}
              />
              <Label>Stop sell</Label>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Inventory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
