import {
  type MaintenanceBlockRecord,
  useMaintenanceBlockMutation,
} from "@voyantjs/hospitality-react"
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
import type { MaintenanceBlockStatus } from "../i18n/messages"
import { RoomTypeCombobox } from "./room-type-combobox"
import { RoomUnitCombobox } from "./room-unit-combobox"

export type MaintenanceBlockData = MaintenanceBlockRecord

const STATUSES = ["open", "in_progress", "resolved", "cancelled"] as const
type Status = MaintenanceBlockRecord["status"]

function createFormSchema(messages: ReturnType<typeof useHospitalityUiMessagesOrDefault>) {
  return z.object({
    roomTypeId: z.string().optional().nullable(),
    roomUnitId: z.string().optional().nullable(),
    startsOn: z.string().min(1, messages.maintenanceBlockDialog.validation.startsOnRequired),
    endsOn: z.string().min(1, messages.maintenanceBlockDialog.validation.endsOnRequired),
    status: z.enum(STATUSES),
    reason: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

export interface MaintenanceBlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  block?: MaintenanceBlockRecord
  onSuccess?: (block: MaintenanceBlockRecord) => void
}

export function MaintenanceBlockDialog({
  open,
  onOpenChange,
  propertyId,
  block,
  onSuccess,
}: MaintenanceBlockDialogProps) {
  const isEditing = Boolean(block)
  const { create, update } = useMaintenanceBlockMutation()
  const messages = useHospitalityUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomTypeId: "",
      roomUnitId: "",
      startsOn: "",
      endsOn: "",
      status: "open",
      reason: "",
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
        reason: block.reason ?? "",
        notes: block.notes ?? "",
      })
    } else if (open) {
      form.reset({
        roomTypeId: "",
        roomUnitId: "",
        startsOn: "",
        endsOn: "",
        status: "open",
        reason: "",
        notes: "",
      })
    }
  }, [block, form, open])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      propertyId,
      roomTypeId: values.roomTypeId || null,
      roomUnitId: values.roomUnitId || null,
      startsOn: values.startsOn,
      endsOn: values.endsOn,
      status: values.status,
      reason: values.reason || null,
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
              ? messages.maintenanceBlockDialog.titles.edit
              : messages.maintenanceBlockDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.maintenanceBlockDialog.fields.roomType}</Label>
                <RoomTypeCombobox
                  propertyId={propertyId}
                  value={form.watch("roomTypeId")}
                  onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                  placeholder={messages.maintenanceBlockDialog.placeholders.roomType}
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.maintenanceBlockDialog.fields.roomUnit}</Label>
                <RoomUnitCombobox
                  propertyId={propertyId}
                  value={form.watch("roomUnitId")}
                  onChange={(value) => form.setValue("roomUnitId", value ?? "")}
                  placeholder={messages.maintenanceBlockDialog.placeholders.roomUnit}
                  disabled={!open}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.maintenanceBlockDialog.fields.startsOn}</Label>
                <DatePicker
                  value={form.watch("startsOn") || null}
                  onChange={(next) =>
                    form.setValue("startsOn", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.maintenanceBlockDialog.placeholders.startsOn}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.maintenanceBlockDialog.fields.endsOn}</Label>
                <DatePicker
                  value={form.watch("endsOn") || null}
                  onChange={(next) =>
                    form.setValue("endsOn", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.maintenanceBlockDialog.placeholders.endsOn}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.maintenanceBlockDialog.fields.status}</Label>
                <Select
                  items={STATUSES.map((status) => ({
                    label: messages.common.maintenanceBlockStatusLabels[status],
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
                        {
                          messages.common.maintenanceBlockStatusLabels[
                            status as MaintenanceBlockStatus
                          ]
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.maintenanceBlockDialog.fields.reason}</Label>
                <Input
                  {...form.register("reason")}
                  placeholder={messages.maintenanceBlockDialog.placeholders.reason}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.maintenanceBlockDialog.fields.notes}</Label>
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
                : messages.maintenanceBlockDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
