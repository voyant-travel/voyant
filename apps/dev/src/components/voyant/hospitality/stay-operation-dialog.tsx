import { type StayOperationRecord, useStayOperationMutation } from "@voyantjs/hospitality-react"
import { RoomUnitCombobox } from "@voyantjs/hospitality-ui/components/room-unit-combobox"
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
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const STATUSES = [
  "reserved",
  "expected_arrival",
  "checked_in",
  "checked_out",
  "no_show",
  "cancelled",
] as const
type Status = (typeof STATUSES)[number]

const formSchema = z.object({
  stayBookingItemId: z.string().min(1, "Stay booking item is required"),
  roomUnitId: z.string().optional().nullable(),
  operationStatus: z.enum(STATUSES),
  expectedArrivalAt: z.string().optional().nullable(),
  expectedDepartureAt: z.string().optional().nullable(),
  checkedInAt: z.string().optional().nullable(),
  checkedOutAt: z.string().optional().nullable(),
  noShowRecordedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export type StayOperationData = StayOperationRecord

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  operation?: StayOperationData
  onSuccess: () => void
}

// datetime-local input wants "YYYY-MM-DDTHH:mm"; convert to/from ISO
const toLocal = (iso: string | null): string => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocal = (local: string | null | undefined): string | null => {
  if (!local) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function StayOperationDialog({
  open,
  onOpenChange,
  propertyId,
  operation,
  onSuccess,
}: Props) {
  const isEditing = !!operation
  const { create, update } = useStayOperationMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stayBookingItemId: "",
      roomUnitId: "",
      operationStatus: "reserved",
      expectedArrivalAt: "",
      expectedDepartureAt: "",
      checkedInAt: "",
      checkedOutAt: "",
      noShowRecordedAt: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && operation) {
      form.reset({
        stayBookingItemId: operation.stayBookingItemId,
        roomUnitId: operation.roomUnitId ?? "",
        operationStatus: operation.operationStatus,
        expectedArrivalAt: toLocal(operation.expectedArrivalAt),
        expectedDepartureAt: toLocal(operation.expectedDepartureAt),
        checkedInAt: toLocal(operation.checkedInAt),
        checkedOutAt: toLocal(operation.checkedOutAt),
        noShowRecordedAt: toLocal(operation.noShowRecordedAt),
        notes: operation.notes ?? "",
      })
    } else if (open) {
      form.reset({
        stayBookingItemId: "",
        roomUnitId: "",
        operationStatus: "reserved",
        expectedArrivalAt: "",
        expectedDepartureAt: "",
        checkedInAt: "",
        checkedOutAt: "",
        noShowRecordedAt: "",
        notes: "",
      })
    }
  }, [open, operation, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      stayBookingItemId: values.stayBookingItemId,
      propertyId,
      roomUnitId: values.roomUnitId || null,
      operationStatus: values.operationStatus,
      expectedArrivalAt: fromLocal(values.expectedArrivalAt),
      expectedDepartureAt: fromLocal(values.expectedDepartureAt),
      checkedInAt: fromLocal(values.checkedInAt),
      checkedOutAt: fromLocal(values.checkedOutAt),
      noShowRecordedAt: fromLocal(values.noShowRecordedAt),
      notes: values.notes || null,
    }
    if (isEditing) {
      await update.mutateAsync({ id: operation.id, input: payload })
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
          <DialogTitle>{isEditing ? "Edit Stay Operation" : "Add Stay Operation"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Stay booking item ID</Label>
              <Input
                {...form.register("stayBookingItemId")}
                placeholder="sbit_…"
                disabled={isEditing}
              />
              {form.formState.errors.stayBookingItemId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.stayBookingItemId.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Room unit (optional)</Label>
                <RoomUnitCombobox
                  propertyId={propertyId}
                  value={form.watch("roomUnitId")}
                  onChange={(value) => form.setValue("roomUnitId", value ?? "")}
                  placeholder="None"
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Operation status</Label>
                <Select
                  items={STATUSES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("operationStatus")}
                  onValueChange={(v) => form.setValue("operationStatus", v as Status)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Expected arrival</Label>
                <Input {...form.register("expectedArrivalAt")} type="datetime-local" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Expected departure</Label>
                <Input {...form.register("expectedDepartureAt")} type="datetime-local" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Checked in at</Label>
                <Input {...form.register("checkedInAt")} type="datetime-local" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Checked out at</Label>
                <Input {...form.register("checkedOutAt")} type="datetime-local" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>No-show recorded at</Label>
              <Input {...form.register("noShowRecordedAt")} type="datetime-local" />
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
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Operation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
