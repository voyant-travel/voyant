import { type StayRuleRecord, useStayRuleMutation } from "@voyantjs/hospitality-react"
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
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"
import { RatePlanCombobox } from "./rate-plan-combobox"
import { RoomTypeCombobox } from "./room-type-combobox"

export type StayRuleData = StayRuleRecord

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
type Weekday = (typeof WEEKDAYS)[number]

const intOrEmpty = z.coerce.number().int().optional().or(z.literal("")).nullable()

const formSchema = z.object({
  ratePlanId: z.string().optional().nullable(),
  roomTypeId: z.string().optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  minNights: intOrEmpty,
  maxNights: intOrEmpty,
  minAdvanceDays: intOrEmpty,
  maxAdvanceDays: intOrEmpty,
  releaseDays: intOrEmpty,
  closedToArrival: z.boolean(),
  closedToDeparture: z.boolean(),
  arrivalWeekdays: z.array(z.string()),
  departureWeekdays: z.array(z.string()),
  active: z.boolean(),
  priority: z.coerce.number().int(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface StayRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  rule?: StayRuleRecord
  onSuccess?: (rule: StayRuleRecord) => void
}

export function StayRuleDialog({
  open,
  onOpenChange,
  propertyId,
  rule,
  onSuccess,
}: StayRuleDialogProps) {
  const isEditing = Boolean(rule)
  const { create, update } = useStayRuleMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ratePlanId: "",
      roomTypeId: "",
      validFrom: "",
      validTo: "",
      minNights: "",
      maxNights: "",
      minAdvanceDays: "",
      maxAdvanceDays: "",
      releaseDays: "",
      closedToArrival: false,
      closedToDeparture: false,
      arrivalWeekdays: [],
      departureWeekdays: [],
      active: true,
      priority: 0,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        ratePlanId: rule.ratePlanId ?? "",
        roomTypeId: rule.roomTypeId ?? "",
        validFrom: rule.validFrom ?? "",
        validTo: rule.validTo ?? "",
        minNights: rule.minNights ?? "",
        maxNights: rule.maxNights ?? "",
        minAdvanceDays: rule.minAdvanceDays ?? "",
        maxAdvanceDays: rule.maxAdvanceDays ?? "",
        releaseDays: rule.releaseDays ?? "",
        closedToArrival: rule.closedToArrival,
        closedToDeparture: rule.closedToDeparture,
        arrivalWeekdays: rule.arrivalWeekdays ?? [],
        departureWeekdays: rule.departureWeekdays ?? [],
        active: rule.active,
        priority: rule.priority,
        notes: rule.notes ?? "",
      })
    } else if (open) {
      form.reset({
        ratePlanId: "",
        roomTypeId: "",
        validFrom: "",
        validTo: "",
        minNights: "",
        maxNights: "",
        minAdvanceDays: "",
        maxAdvanceDays: "",
        releaseDays: "",
        closedToArrival: false,
        closedToDeparture: false,
        arrivalWeekdays: [],
        departureWeekdays: [],
        active: true,
        priority: 0,
        notes: "",
      })
    }
  }, [form, open, rule])

  const toggleWeekday = (
    field: "arrivalWeekdays" | "departureWeekdays",
    day: Weekday,
    checked: boolean,
  ) => {
    const current = form.watch(field) ?? []
    const next = checked ? [...current, day] : current.filter((value) => value !== day)
    form.setValue(field, next)
  }

  const onSubmit = async (values: FormOutput) => {
    const toInt = (value: number | string | null | undefined) =>
      typeof value === "number" ? value : null

    const payload = {
      propertyId,
      ratePlanId: values.ratePlanId || null,
      roomTypeId: values.roomTypeId || null,
      validFrom: values.validFrom || null,
      validTo: values.validTo || null,
      minNights: toInt(values.minNights),
      maxNights: toInt(values.maxNights),
      minAdvanceDays: toInt(values.minAdvanceDays),
      maxAdvanceDays: toInt(values.maxAdvanceDays),
      releaseDays: toInt(values.releaseDays),
      closedToArrival: values.closedToArrival,
      closedToDeparture: values.closedToDeparture,
      arrivalWeekdays: values.arrivalWeekdays.length > 0 ? values.arrivalWeekdays : null,
      departureWeekdays: values.departureWeekdays.length > 0 ? values.departureWeekdays : null,
      active: values.active,
      priority: values.priority,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: rule!.id, input: payload })
      : await create.mutateAsync(payload)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const arrivalWeekdays = form.watch("arrivalWeekdays") ?? []
  const departureWeekdays = form.watch("departureWeekdays") ?? []
  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Stay Rule" : "Add Stay Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Rate plan (optional)</Label>
                <RatePlanCombobox
                  propertyId={propertyId}
                  value={form.watch("ratePlanId")}
                  onChange={(value) => form.setValue("ratePlanId", value ?? "")}
                  placeholder="All rate plans"
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Room type (optional)</Label>
                <RoomTypeCombobox
                  propertyId={propertyId}
                  value={form.watch("roomTypeId")}
                  onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                  placeholder="All room types"
                  disabled={!open}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Valid from</Label>
                <DatePicker
                  value={form.watch("validFrom") || null}
                  onChange={(next) =>
                    form.setValue("validFrom", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select start date"
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Valid to</Label>
                <DatePicker
                  value={form.watch("validTo") || null}
                  onChange={(next) =>
                    form.setValue("validTo", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select end date"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Min nights</Label>
                <Input {...form.register("minNights")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max nights</Label>
                <Input {...form.register("maxNights")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Release days</Label>
                <Input {...form.register("releaseDays")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Min advance days</Label>
                <Input {...form.register("minAdvanceDays")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max advance days</Label>
                <Input {...form.register("maxAdvanceDays")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Priority</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
            </div>

            <div>
              <Label>Arrival weekdays</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm capitalize">
                    <input
                      type="checkbox"
                      checked={arrivalWeekdays.includes(day)}
                      onChange={(event) =>
                        toggleWeekday("arrivalWeekdays", day, event.target.checked)
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Departure weekdays</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm capitalize">
                    <input
                      type="checkbox"
                      checked={departureWeekdays.includes(day)}
                      onChange={(event) =>
                        toggleWeekday("departureWeekdays", day, event.target.checked)
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("closedToArrival")}
                  onCheckedChange={(checked) => form.setValue("closedToArrival", checked)}
                />
                <Label>Closed to arrival</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("closedToDeparture")}
                  onCheckedChange={(checked) => form.setValue("closedToDeparture", checked)}
                />
                <Label>Closed to departure</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>Active</Label>
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
              {isEditing ? "Save Changes" : "Add Stay Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
