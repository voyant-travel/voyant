import { type RoomUnitRecord, useRoomUnitMutation } from "@voyantjs/hospitality-react"
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
  Textarea,
} from "@voyantjs/voyant-ui/components"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { RoomTypeCombobox } from "./room-type-combobox"

const STATUSES = ["active", "inactive", "out_of_order", "archived"] as const
type Status = RoomUnitRecord["status"]

const formSchema = z.object({
  roomTypeId: z.string().min(1, "Room type is required"),
  code: z.string().optional().nullable(),
  roomNumber: z.string().optional().nullable(),
  floor: z.string().optional().nullable(),
  wing: z.string().optional().nullable(),
  status: z.enum(STATUSES),
  viewCode: z.string().optional().nullable(),
  accessibilityCode: z.string().optional().nullable(),
  genderRestriction: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface RoomUnitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  unit?: RoomUnitRecord
  onSuccess?: (unit: RoomUnitRecord) => void
}

export function RoomUnitDialog({
  open,
  onOpenChange,
  propertyId,
  unit,
  onSuccess,
}: RoomUnitDialogProps) {
  const isEditing = Boolean(unit)
  const { create, update } = useRoomUnitMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomTypeId: "",
      code: "",
      roomNumber: "",
      floor: "",
      wing: "",
      status: "active",
      viewCode: "",
      accessibilityCode: "",
      genderRestriction: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && unit) {
      form.reset({
        roomTypeId: unit.roomTypeId,
        code: unit.code ?? "",
        roomNumber: unit.roomNumber ?? "",
        floor: unit.floor ?? "",
        wing: unit.wing ?? "",
        status: unit.status,
        viewCode: unit.viewCode ?? "",
        accessibilityCode: unit.accessibilityCode ?? "",
        genderRestriction: unit.genderRestriction ?? "",
        notes: unit.notes ?? "",
      })
    } else if (open) {
      form.reset({
        roomTypeId: "",
        code: "",
        roomNumber: "",
        floor: "",
        wing: "",
        status: "active",
        viewCode: "",
        accessibilityCode: "",
        genderRestriction: "",
        notes: "",
      })
    }
  }, [form, open, unit])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      propertyId,
      roomTypeId: values.roomTypeId,
      code: values.code || null,
      roomNumber: values.roomNumber || null,
      floor: values.floor || null,
      wing: values.wing || null,
      status: values.status,
      viewCode: values.viewCode || null,
      accessibilityCode: values.accessibilityCode || null,
      genderRestriction: values.genderRestriction || null,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: unit!.id, input: payload })
      : await create.mutateAsync(payload)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Room Unit" : "Add Room Unit"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Room type</Label>
              <RoomTypeCombobox
                propertyId={propertyId}
                value={form.watch("roomTypeId")}
                onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                placeholder="Select a room type…"
                disabled={!open}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Room number</Label>
                <Input {...form.register("roomNumber")} placeholder="412" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="DLX-412" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Floor</Label>
                <Input {...form.register("floor")} placeholder="4" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Wing</Label>
                <Input {...form.register("wing")} placeholder="North" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={STATUSES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as Status)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>View code</Label>
                <Input {...form.register("viewCode")} placeholder="sea" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Accessibility</Label>
                <Input {...form.register("accessibilityCode")} placeholder="wheelchair" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Gender restriction</Label>
                <Input {...form.register("genderRestriction")} placeholder="female_only" />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Room Unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
