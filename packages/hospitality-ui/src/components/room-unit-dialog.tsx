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
} from "@voyantjs/ui/components"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { useHospitalityUiMessagesOrDefault } from "../i18n/index.js"
import type { RoomUnitStatus } from "../i18n/messages.js"
import { RoomTypeCombobox } from "./room-type-combobox.js"

const STATUSES = ["active", "inactive", "out_of_order", "archived"] as const

function createFormSchema(messages: ReturnType<typeof useHospitalityUiMessagesOrDefault>) {
  return z.object({
    roomTypeId: z.string().min(1, messages.roomUnitDialog.validation.roomTypeRequired),
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
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

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
  const messages = useHospitalityUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

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
          <DialogTitle>
            {isEditing
              ? messages.roomUnitDialog.titles.edit
              : messages.roomUnitDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.roomUnitDialog.fields.roomType}</Label>
              <RoomTypeCombobox
                propertyId={propertyId}
                value={form.watch("roomTypeId")}
                onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                placeholder={messages.roomUnitDialog.placeholders.roomType}
                disabled={!open}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.roomUnitDialog.fields.roomNumber}</Label>
                <Input
                  {...form.register("roomNumber")}
                  placeholder={messages.roomUnitDialog.placeholders.roomNumber}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomUnitDialog.fields.code}</Label>
                <Input
                  {...form.register("code")}
                  placeholder={messages.roomUnitDialog.placeholders.code}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.roomUnitDialog.fields.floor}</Label>
                <Input
                  {...form.register("floor")}
                  placeholder={messages.roomUnitDialog.placeholders.floor}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomUnitDialog.fields.wing}</Label>
                <Input
                  {...form.register("wing")}
                  placeholder={messages.roomUnitDialog.placeholders.wing}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.roomUnitDialog.fields.status}</Label>
                <Select
                  items={STATUSES.map((value) => ({
                    label: messages.common.roomUnitStatusLabels[value as RoomUnitStatus],
                    value,
                  }))}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as RoomUnitRecord["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {messages.common.roomUnitStatusLabels[status as RoomUnitStatus]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomUnitDialog.fields.viewCode}</Label>
                <Input
                  {...form.register("viewCode")}
                  placeholder={messages.roomUnitDialog.placeholders.viewCode}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.roomUnitDialog.fields.accessibility}</Label>
                <Input
                  {...form.register("accessibilityCode")}
                  placeholder={messages.roomUnitDialog.placeholders.accessibility}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.roomUnitDialog.fields.genderRestriction}</Label>
                <Input
                  {...form.register("genderRestriction")}
                  placeholder={messages.roomUnitDialog.placeholders.genderRestriction}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.roomUnitDialog.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : messages.roomUnitDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
