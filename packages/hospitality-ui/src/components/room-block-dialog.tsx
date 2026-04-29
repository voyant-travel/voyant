import { type RoomBlockRecord, useRoomBlockMutation } from "@voyantjs/hospitality-react"
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
} from "@voyantjs/ui/components"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useHospitalityUiMessagesOrDefault } from "../i18n"
import type { RoomBlockStatus } from "../i18n/messages"
import { RoomTypeCombobox } from "./room-type-combobox"
import { RoomUnitCombobox } from "./room-unit-combobox"

export type RoomBlockData = RoomBlockRecord

const STATUSES = ["draft", "held", "confirmed", "released", "cancelled"] as const
type Status = RoomBlockRecord["status"]

function createFormSchema(messages: ReturnType<typeof useHospitalityUiMessagesOrDefault>) {
  return z.object({
    roomTypeId: z.string().optional().nullable(),
    roomUnitId: z.string().optional().nullable(),
    startsOn: z.string().min(1, messages.roomBlockDialog.validation.startsOnRequired),
    endsOn: z.string().min(1, messages.roomBlockDialog.validation.endsOnRequired),
    status: z.enum(STATUSES),
    blockReason: z.string().optional().nullable(),
    quantity: z.coerce.number().int().min(1, messages.roomBlockDialog.validation.quantityMin),
    notes: z.string().optional().nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

export interface RoomBlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  block?: RoomBlockRecord
  onSuccess?: (block: RoomBlockRecord) => void
}

export function RoomBlockDialog({
  open,
  onOpenChange,
  propertyId,
  block,
  onSuccess,
}: RoomBlockDialogProps) {
  const isEditing = Boolean(block)
  const { create, update } = useRoomBlockMutation()
  const messages = useHospitalityUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomTypeId: "",
      roomUnitId: "",
      startsOn: "",
      endsOn: "",
      status: "draft",
      blockReason: "",
      quantity: 1,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && block) {
      form.reset({
        roomTypeId: block.roomTypeId ?? "",
        roomUnitId: block.roomUnitId ?? "",
        startsOn: block.startsOn,
        endsOn: block.endsOn,
        status: block.status,
        blockReason: block.blockReason ?? "",
        quantity: block.quantity,
        notes: block.notes ?? "",
      })
    } else if (open) {
      form.reset({
        roomTypeId: "",
        roomUnitId: "",
        startsOn: "",
        endsOn: "",
        status: "draft",
        blockReason: "",
        quantity: 1,
        notes: "",
      })
    }
  }, [open, block, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      propertyId,
      roomTypeId: values.roomTypeId || null,
      roomUnitId: values.roomUnitId || null,
      startsOn: values.startsOn,
      endsOn: values.endsOn,
      status: values.status,
      blockReason: values.blockReason || null,
      quantity: values.quantity,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: block!.id, input: payload })
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
              ? messages.roomBlockDialog.titles.edit
              : messages.roomBlockDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.roomBlockDialog.fields.roomType}</Label>
                <RoomTypeCombobox
                  propertyId={propertyId}
                  value={form.watch("roomTypeId")}
                  onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                  placeholder={messages.roomBlockDialog.placeholders.roomType}
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomBlockDialog.fields.roomUnit}</Label>
                <RoomUnitCombobox
                  propertyId={propertyId}
                  value={form.watch("roomUnitId")}
                  onChange={(value) => form.setValue("roomUnitId", value ?? "")}
                  placeholder={messages.roomBlockDialog.placeholders.roomUnit}
                  disabled={!open}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.roomBlockDialog.fields.startsOn}</Label>
                <DatePicker
                  value={form.watch("startsOn") || null}
                  onChange={(next) =>
                    form.setValue("startsOn", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.roomBlockDialog.placeholders.startsOn}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomBlockDialog.fields.endsOn}</Label>
                <DatePicker
                  value={form.watch("endsOn") || null}
                  onChange={(next) =>
                    form.setValue("endsOn", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.roomBlockDialog.placeholders.endsOn}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{messages.roomBlockDialog.fields.status}</Label>
                <Select
                  items={STATUSES.map((status) => ({
                    label: messages.common.roomBlockStatusLabels[status],
                    value: status,
                  }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as Status)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {messages.common.roomBlockStatusLabels[status as RoomBlockStatus]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomBlockDialog.fields.quantity}</Label>
                <Input {...form.register("quantity")} type="number" min="1" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomBlockDialog.fields.reason}</Label>
                <Input
                  {...form.register("blockReason")}
                  placeholder={messages.roomBlockDialog.placeholders.reason}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.roomBlockDialog.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : messages.roomBlockDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
