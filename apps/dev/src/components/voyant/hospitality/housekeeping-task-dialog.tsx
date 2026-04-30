import {
  type HousekeepingTaskRecord,
  useHousekeepingTaskMutation,
} from "@voyantjs/hospitality-react"
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

const STATUSES = ["open", "in_progress", "completed", "cancelled"] as const
type Status = (typeof STATUSES)[number]

const formSchema = z.object({
  roomUnitId: z.string().min(1, "Room unit is required"),
  stayBookingItemId: z.string().optional().nullable(),
  taskType: z.string().min(1, "Task type is required"),
  status: z.enum(STATUSES),
  priority: z.coerce.number().int().default(0),
  dueAt: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export type HousekeepingTaskData = HousekeepingTaskRecord

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  task?: HousekeepingTaskData
  onSuccess: () => void
}

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

export function HousekeepingTaskDialog({ open, onOpenChange, propertyId, task, onSuccess }: Props) {
  const isEditing = !!task
  const { create, update } = useHousekeepingTaskMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomUnitId: "",
      stayBookingItemId: "",
      taskType: "cleaning",
      status: "open",
      priority: 0,
      dueAt: "",
      startedAt: "",
      completedAt: "",
      assignedTo: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && task) {
      form.reset({
        roomUnitId: task.roomUnitId,
        stayBookingItemId: task.stayBookingItemId ?? "",
        taskType: task.taskType,
        status: task.status,
        priority: task.priority,
        dueAt: toLocal(task.dueAt),
        startedAt: toLocal(task.startedAt),
        completedAt: toLocal(task.completedAt),
        assignedTo: task.assignedTo ?? "",
        notes: task.notes ?? "",
      })
    } else if (open) {
      form.reset({
        roomUnitId: "",
        stayBookingItemId: "",
        taskType: "cleaning",
        status: "open",
        priority: 0,
        dueAt: "",
        startedAt: "",
        completedAt: "",
        assignedTo: "",
        notes: "",
      })
    }
  }, [open, task, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      propertyId,
      roomUnitId: values.roomUnitId,
      stayBookingItemId: values.stayBookingItemId || null,
      taskType: values.taskType,
      status: values.status,
      priority: values.priority,
      dueAt: fromLocal(values.dueAt),
      startedAt: fromLocal(values.startedAt),
      completedAt: fromLocal(values.completedAt),
      assignedTo: values.assignedTo || null,
      notes: values.notes || null,
    }
    if (isEditing) {
      await update.mutateAsync({ id: task.id, input: payload })
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
          <DialogTitle>
            {isEditing ? "Edit Housekeeping Task" : "Add Housekeeping Task"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Room unit</Label>
                <RoomUnitCombobox
                  propertyId={propertyId}
                  value={form.watch("roomUnitId")}
                  onChange={(value) => form.setValue("roomUnitId", value ?? "")}
                  placeholder="Select…"
                  disabled={!open}
                />
                {form.formState.errors.roomUnitId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.roomUnitId.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Stay booking item (optional)</Label>
                <Input {...form.register("stayBookingItemId")} placeholder="sbit_…" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Task type</Label>
                <Input {...form.register("taskType")} placeholder="cleaning" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={STATUSES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as Status)}
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
              <div className="flex flex-col gap-2">
                <Label>Priority</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Due at</Label>
                <Input {...form.register("dueAt")} type="datetime-local" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Assigned to</Label>
                <Input {...form.register("assignedTo")} placeholder="staff name" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Started at</Label>
                <Input {...form.register("startedAt")} type="datetime-local" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Completed at</Label>
                <Input {...form.register("completedAt")} type="datetime-local" />
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
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
