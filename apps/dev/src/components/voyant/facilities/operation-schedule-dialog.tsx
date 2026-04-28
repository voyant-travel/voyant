import {
  type CreateFacilityOperationScheduleInput,
  type FacilityOperationScheduleRecord,
  type UpdateFacilityOperationScheduleInput,
  useFacilityOperationScheduleMutation,
} from "@voyantjs/facilities-react"
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

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

const formSchema = z.object({
  dayOfWeek: z.string().optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  opensAt: z.string().optional().nullable(),
  closesAt: z.string().optional().nullable(),
  closed: z.boolean(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  facilityId: string
  schedule?: FacilityOperationScheduleRecord
  onSuccess: () => void
}

export function OperationScheduleDialog({
  open,
  onOpenChange,
  facilityId,
  schedule,
  onSuccess,
}: Props) {
  const isEditing = Boolean(schedule)
  const { create, update } = useFacilityOperationScheduleMutation()
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dayOfWeek: "",
      validFrom: "",
      validTo: "",
      opensAt: "",
      closesAt: "",
      closed: false,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && schedule) {
      form.reset({
        dayOfWeek: schedule.dayOfWeek ?? "",
        validFrom: schedule.validFrom ?? "",
        validTo: schedule.validTo ?? "",
        opensAt: schedule.opensAt ?? "",
        closesAt: schedule.closesAt ?? "",
        closed: schedule.closed,
        notes: schedule.notes ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        dayOfWeek: "",
        validFrom: "",
        validTo: "",
        opensAt: "",
        closesAt: "",
        closed: false,
        notes: "",
      })
    }
  }, [form, open, schedule])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      dayOfWeek: values.dayOfWeek || null,
      validFrom: values.validFrom || null,
      validTo: values.validTo || null,
      opensAt: values.opensAt || null,
      closesAt: values.closesAt || null,
      closed: values.closed,
      notes: values.notes || null,
    }

    if (isEditing) {
      await update.mutateAsync({
        id: schedule!.id,
        input: payload as UpdateFacilityOperationScheduleInput,
      })
    } else {
      await create.mutateAsync({
        facilityId,
        ...(payload as Omit<CreateFacilityOperationScheduleInput, "facilityId">),
      })
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Schedule" : "Add Schedule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Day of week</Label>
              <Select
                items={[
                  { label: "Any day", value: "any" },
                  ...DAYS_OF_WEEK.map((day) => ({ label: day, value: day })),
                ]}
                value={form.watch("dayOfWeek") || "any"}
                onValueChange={(value) => form.setValue("dayOfWeek", value === "any" ? "" : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any day</SelectItem>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day} value={day} className="capitalize">
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Valid from</Label>
                <Input {...form.register("validFrom")} type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Valid to</Label>
                <Input {...form.register("validTo")} type="date" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Opens at</Label>
                <Input {...form.register("opensAt")} placeholder="09:00" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Closes at</Label>
                <Input {...form.register("closesAt")} placeholder="22:00" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("closed")}
                onCheckedChange={(value) => form.setValue("closed", value)}
              />
              <Label>Closed</Label>
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
              {isEditing ? "Save Changes" : "Add Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
