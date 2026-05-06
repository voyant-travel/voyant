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
import { useHospitalityUiMessagesOrDefault } from "../i18n/index.js"
import { RoomTypeCombobox } from "./room-type-combobox.js"

export type RoomInventoryData = RoomInventoryRecord

function createFormSchema(messages: ReturnType<typeof useHospitalityUiMessagesOrDefault>) {
  const intOrEmpty = z.coerce
    .number()
    .int()
    .min(0, messages.roomInventoryDialog.validation.nonNegative)
    .optional()
    .or(z.literal(""))
    .nullable()

  return z.object({
    roomTypeId: z.string().min(1, messages.roomInventoryDialog.validation.roomTypeRequired),
    date: z.string().min(1, messages.roomInventoryDialog.validation.dateRequired),
    totalUnits: z.coerce.number().int().min(0, messages.roomInventoryDialog.validation.nonNegative),
    availableUnits: z.coerce
      .number()
      .int()
      .min(0, messages.roomInventoryDialog.validation.nonNegative),
    heldUnits: z.coerce.number().int().min(0, messages.roomInventoryDialog.validation.nonNegative),
    soldUnits: z.coerce.number().int().min(0, messages.roomInventoryDialog.validation.nonNegative),
    outOfOrderUnits: z.coerce
      .number()
      .int()
      .min(0, messages.roomInventoryDialog.validation.nonNegative),
    overbookLimit: intOrEmpty,
    stopSell: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

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
  const messages = useHospitalityUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

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
          <DialogTitle>
            {isEditing
              ? messages.roomInventoryDialog.titles.edit
              : messages.roomInventoryDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.roomInventoryDialog.fields.roomType}</Label>
                <RoomTypeCombobox
                  propertyId={propertyId}
                  value={form.watch("roomTypeId")}
                  onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                  placeholder={messages.roomInventoryDialog.placeholders.roomType}
                  disabled={isEditing}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomInventoryDialog.fields.date}</Label>
                <DatePicker
                  value={form.watch("date") || null}
                  onChange={(next) =>
                    form.setValue("date", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.roomInventoryDialog.placeholders.date}
                  className="w-full"
                  disabled={isEditing}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{messages.roomInventoryDialog.fields.total}</Label>
                <Input {...form.register("totalUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomInventoryDialog.fields.available}</Label>
                <Input {...form.register("availableUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomInventoryDialog.fields.held}</Label>
                <Input {...form.register("heldUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomInventoryDialog.fields.sold}</Label>
                <Input {...form.register("soldUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomInventoryDialog.fields.outOfOrder}</Label>
                <Input {...form.register("outOfOrderUnits")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomInventoryDialog.fields.overbookLimit}</Label>
                <Input {...form.register("overbookLimit")} type="number" min="0" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("stopSell")}
                onCheckedChange={(checked) => form.setValue("stopSell", checked)}
              />
              <Label>{messages.roomInventoryDialog.fields.stopSell}</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.roomInventoryDialog.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing
                ? messages.common.saveChanges
                : messages.roomInventoryDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
