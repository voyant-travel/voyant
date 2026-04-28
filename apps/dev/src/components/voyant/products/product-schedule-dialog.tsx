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
} from "@voyantjs/ui/components"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { ToggleGroup, ToggleGroupItem } from "@voyantjs/ui/components/toggle-group"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { api } from "@/lib/api-client"
import { getTimezoneLabel, TIMEZONE_IDS, TIMEZONE_OPTIONS } from "@/lib/timezone-options"
import { zodResolver } from "@/lib/zod-resolver"

const WEEKDAY_OPTIONS = [
  { value: "MO", label: "Mon" },
  { value: "TU", label: "Tue" },
  { value: "WE", label: "Wed" },
  { value: "TH", label: "Thu" },
  { value: "FR", label: "Fri" },
  { value: "SA", label: "Sat" },
  { value: "SU", label: "Sun" },
] as const

const WEEKDAY_VALUES = WEEKDAY_OPTIONS.map((d) => d.value)
type Weekday = (typeof WEEKDAY_VALUES)[number]

const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
] as const
type Frequency = (typeof FREQUENCY_OPTIONS)[number]["value"]

const scheduleFormSchema = z
  .object({
    timezone: z.string().min(1, "Timezone is required"),
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    interval: z.coerce.number().int().min(1).max(365),
    byWeekdays: z.array(z.enum(WEEKDAY_VALUES)),
    byMonthDays: z.array(z.coerce.number().int().min(1).max(31)),
    maxCapacity: z.coerce.number().int().min(0),
    cutoffMinutes: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    active: z.boolean(),
  })
  .refine(
    (v) => {
      if (v.frequency !== "WEEKLY") return true
      return v.byWeekdays.length > 0
    },
    { message: "Select at least one weekday", path: ["byWeekdays"] },
  )
  .refine(
    (v) => {
      if (v.frequency !== "MONTHLY") return true
      return v.byMonthDays.length > 0
    },
    { message: "Select at least one day of the month", path: ["byMonthDays"] },
  )

type ScheduleFormValues = z.input<typeof scheduleFormSchema>
type ScheduleFormOutput = z.output<typeof scheduleFormSchema>

export type AvailabilityRule = {
  id: string
  productId: string
  timezone: string
  recurrenceRule: string
  maxCapacity: number
  cutoffMinutes: number | null
  active: boolean
}

type ScheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  rule?: AvailabilityRule
  onSuccess: () => void
}

function parseRRule(rrule: string): {
  frequency: Frequency
  interval: number
  byWeekdays: Weekday[]
  byMonthDays: number[]
} {
  const parts = rrule
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
  const map = new Map<string, string>()
  for (const part of parts) {
    const [key, value] = part.split("=")
    if (key && value !== undefined) map.set(key.toUpperCase(), value)
  }

  const rawFreq = (map.get("FREQ") ?? "DAILY").toUpperCase()
  const frequency: Frequency =
    rawFreq === "WEEKLY" || rawFreq === "MONTHLY" ? (rawFreq as Frequency) : "DAILY"

  const interval = Number.parseInt(map.get("INTERVAL") ?? "1", 10) || 1

  const byday = map.get("BYDAY") ?? ""
  const byWeekdays = byday
    .split(",")
    .map((d) => d.trim().toUpperCase())
    .filter((d): d is Weekday => WEEKDAY_VALUES.includes(d as Weekday))

  const bymonthday = map.get("BYMONTHDAY") ?? ""
  const byMonthDays = bymonthday
    .split(",")
    .map((d) => Number.parseInt(d.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 31)

  return { frequency, interval, byWeekdays, byMonthDays }
}

function buildRRule(values: {
  frequency: Frequency
  interval: number
  byWeekdays: Weekday[]
  byMonthDays: number[]
}): string {
  const parts = [`FREQ=${values.frequency}`]
  if (values.interval > 1) parts.push(`INTERVAL=${values.interval}`)
  if (values.frequency === "WEEKLY" && values.byWeekdays.length > 0) {
    // Preserve calendar order Mon→Sun
    const ordered = WEEKDAY_VALUES.filter((d) => values.byWeekdays.includes(d))
    parts.push(`BYDAY=${ordered.join(",")}`)
  }
  if (values.frequency === "MONTHLY" && values.byMonthDays.length > 0) {
    const ordered = [...values.byMonthDays].sort((a, b) => a - b)
    parts.push(`BYMONTHDAY=${ordered.join(",")}`)
  }
  return parts.join(";")
}

function describeRRule(values: {
  frequency: Frequency
  interval: number
  byWeekdays: Weekday[]
  byMonthDays: number[]
}): string {
  const { frequency, interval, byWeekdays, byMonthDays } = values
  const unit = frequency === "DAILY" ? "day" : frequency === "WEEKLY" ? "week" : "month"
  const cadence = interval > 1 ? `every ${interval} ${unit}s` : `every ${unit}`

  if (frequency === "WEEKLY") {
    if (byWeekdays.length === 0) return `Generates ${cadence} — pick at least one weekday`
    const labels = WEEKDAY_OPTIONS.filter((d) => byWeekdays.includes(d.value)).map((d) => d.label)
    return `Generates ${cadence} on ${labels.join(", ")}`
  }
  if (frequency === "MONTHLY") {
    if (byMonthDays.length === 0) return `Generates ${cadence} — pick at least one day`
    const ordered = [...byMonthDays].sort((a, b) => a - b)
    return `Generates ${cadence} on day${ordered.length === 1 ? "" : "s"} ${ordered.join(", ")}`
  }
  return `Generates ${cadence}`
}

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export function ScheduleDialog({
  open,
  onOpenChange,
  productId,
  rule,
  onSuccess,
}: ScheduleDialogProps) {
  const isEditing = !!rule

  const defaultTz =
    typeof Intl !== "undefined"
      ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC")
      : "UTC"

  const form = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      timezone: defaultTz,
      frequency: "WEEKLY",
      interval: 1,
      byWeekdays: ["MO"],
      byMonthDays: [],
      maxCapacity: 0,
      cutoffMinutes: "",
      active: true,
    },
  })

  const active = form.watch("active")
  const timezone = form.watch("timezone")
  const frequency = form.watch("frequency")
  const interval = form.watch("interval")
  const byWeekdays = form.watch("byWeekdays") as Weekday[]
  const byMonthDays = form.watch("byMonthDays") as number[]

  const preview = useMemo(
    () =>
      describeRRule({
        frequency,
        interval: typeof interval === "number" ? interval : Number(interval) || 1,
        byWeekdays,
        byMonthDays,
      }),
    [frequency, interval, byWeekdays, byMonthDays],
  )

  useEffect(() => {
    if (open && rule) {
      const parsed = parseRRule(rule.recurrenceRule)
      form.reset({
        timezone: rule.timezone,
        frequency: parsed.frequency,
        interval: parsed.interval,
        byWeekdays: parsed.byWeekdays,
        byMonthDays: parsed.byMonthDays,
        maxCapacity: rule.maxCapacity,
        cutoffMinutes: rule.cutoffMinutes ?? "",
        active: rule.active,
      })
    } else if (open) {
      form.reset({
        timezone: defaultTz,
        frequency: "WEEKLY",
        interval: 1,
        byWeekdays: ["MO"],
        byMonthDays: [],
        maxCapacity: 0,
        cutoffMinutes: "",
        active: true,
      })
    }
  }, [open, rule, form, defaultTz])

  const onSubmit = async (values: ScheduleFormOutput) => {
    const cutoffMinutes = typeof values.cutoffMinutes === "number" ? values.cutoffMinutes : null
    const recurrenceRule = buildRRule({
      frequency: values.frequency,
      interval: values.interval,
      byWeekdays: values.byWeekdays,
      byMonthDays: values.byMonthDays,
    })

    const payload = {
      productId,
      timezone: values.timezone,
      recurrenceRule,
      maxCapacity: values.maxCapacity,
      cutoffMinutes,
      active: values.active,
    }

    if (isEditing) {
      await api.patch(`/v1/availability/rules/${rule.id}`, payload)
    } else {
      await api.post("/v1/availability/rules", payload)
    }
    onSuccess()
  }

  const unitLabel =
    frequency === "DAILY" ? "day(s)" : frequency === "WEEKLY" ? "week(s)" : "month(s)"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Schedule" : "New Recurring Schedule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-[160px_1fr] gap-4">
              <div className="flex flex-col gap-2">
                <Label>Repeats</Label>
                <Select
                  items={FREQUENCY_OPTIONS}
                  value={frequency}
                  onValueChange={(v) =>
                    form.setValue("frequency", v as Frequency, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Every</Label>
                <div className="flex items-center gap-2">
                  <Input
                    {...form.register("interval")}
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">{unitLabel}</span>
                </div>
                {form.formState.errors.interval && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.interval.message}
                  </p>
                )}
              </div>
            </div>

            {frequency === "WEEKLY" && (
              <div className="flex flex-col gap-2">
                <Label>On these days</Label>
                <ToggleGroup
                  multiple
                  value={byWeekdays}
                  onValueChange={(next) =>
                    form.setValue("byWeekdays", next as Weekday[], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  variant="outline"
                  spacing={1}
                >
                  {WEEKDAY_OPTIONS.map((d) => (
                    <ToggleGroupItem key={d.value} value={d.value} className="w-14">
                      {d.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {form.formState.errors.byWeekdays && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.byWeekdays.message}
                  </p>
                )}
              </div>
            )}

            {frequency === "MONTHLY" && (
              <div className="flex flex-col gap-2">
                <Label>On days of the month</Label>
                <ToggleGroup
                  multiple
                  value={byMonthDays.map(String)}
                  onValueChange={(next) =>
                    form.setValue(
                      "byMonthDays",
                      next.map((n) => Number.parseInt(n, 10)),
                      { shouldValidate: true, shouldDirty: true },
                    )
                  }
                  variant="outline"
                  spacing={1}
                  className="flex-wrap"
                >
                  {MONTH_DAYS.map((d) => (
                    <ToggleGroupItem key={d} value={String(d)} className="w-10">
                      {d}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {form.formState.errors.byMonthDays && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.byMonthDays.message}
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">{preview}</p>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Timezone</Label>
                <Combobox
                  items={TIMEZONE_IDS}
                  value={timezone || null}
                  autoHighlight
                  itemToStringValue={(id) => getTimezoneLabel(id as string)}
                  onValueChange={(next) => {
                    if (typeof next === "string") {
                      form.setValue("timezone", next, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  }}
                >
                  <ComboboxInput placeholder="Search timezones…" />
                  <ComboboxContent>
                    <ComboboxEmpty>No timezone found.</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxCollection>
                        {(id) => {
                          const tz = TIMEZONE_OPTIONS.find((t) => t.id === (id as string))
                          return (
                            <ComboboxItem key={id as string} value={id as string}>
                              <span className="font-mono text-xs">{id as string}</span>
                              {tz ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {tz.label}
                                </span>
                              ) : null}
                            </ComboboxItem>
                          )
                        }}
                      </ComboboxCollection>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {form.formState.errors.timezone && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.timezone.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Max capacity</Label>
                <Input {...form.register("maxCapacity")} type="number" min="0" step="1" />
                {form.formState.errors.maxCapacity && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.maxCapacity.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Cutoff (minutes)</Label>
                <Input
                  {...form.register("cutoffMinutes")}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="schedule-active"
                checked={active}
                onCheckedChange={(c) => form.setValue("active", c)}
              />
              <Label htmlFor="schedule-active" className="font-normal cursor-pointer">
                Active (generates new departures)
              </Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
