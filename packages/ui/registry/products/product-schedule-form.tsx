"use client"

import {
  buildRRule,
  type Frequency,
  parseRRule,
  WEEKDAYS,
  type Weekday,
} from "@voyantjs/availability/rrule"
import {
  type AvailabilityRuleRecord,
  useAvailabilityRuleMutation,
} from "@voyantjs/availability-react"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { formatMessage, useRegistryProductsMessagesOrDefault } from "./i18n/provider"
import {
  getDefaultTimezone,
  getTimezoneOptions,
  toNullableNumber,
} from "./product-availability-shared"

type Mode = { kind: "create"; productId: string } | { kind: "edit"; rule: AvailabilityRuleRecord }

export interface ProductScheduleFormProps {
  mode: Mode
  onSuccess?: (rule: AvailabilityRuleRecord) => void
  onCancel?: () => void
}

interface FormState {
  timezone: string
  frequency: Frequency
  interval: string
  byWeekdays: Weekday[]
  byMonthDays: string[]
  maxCapacity: string
  maxPickupCapacity: string
  minTotalPax: string
  cutoffMinutes: string
  earlyBookingLimitMinutes: string
  active: boolean
}

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1))

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    const parsed = parseRRule(mode.rule.recurrenceRule)
    return {
      timezone: mode.rule.timezone,
      frequency: parsed.frequency,
      interval: String(parsed.interval),
      byWeekdays: parsed.byWeekdays,
      byMonthDays: parsed.byMonthDays.map(String),
      maxCapacity: String(mode.rule.maxCapacity),
      maxPickupCapacity:
        mode.rule.maxPickupCapacity == null ? "" : String(mode.rule.maxPickupCapacity),
      minTotalPax: mode.rule.minTotalPax == null ? "" : String(mode.rule.minTotalPax),
      cutoffMinutes: mode.rule.cutoffMinutes == null ? "" : String(mode.rule.cutoffMinutes),
      earlyBookingLimitMinutes:
        mode.rule.earlyBookingLimitMinutes == null
          ? ""
          : String(mode.rule.earlyBookingLimitMinutes),
      active: mode.rule.active,
    }
  }

  return {
    timezone: getDefaultTimezone(),
    frequency: "WEEKLY", // i18n-literal-ok enum default
    interval: "1",
    byWeekdays: ["MO"],
    byMonthDays: [],
    maxCapacity: "0",
    maxPickupCapacity: "",
    minTotalPax: "",
    cutoffMinutes: "",
    earlyBookingLimitMinutes: "",
    active: true,
  }
}

function describeSchedule(
  state: FormState,
  messages: ReturnType<typeof useRegistryProductsMessagesOrDefault>,
) {
  const interval = Math.max(1, Number.parseInt(state.interval || "1", 10) || 1)
  const singularUnit =
    state.frequency === "DAILY"
      ? messages.productScheduleForm.preview.units.day
      : state.frequency === "WEEKLY"
        ? messages.productScheduleForm.preview.units.week
        : messages.productScheduleForm.preview.units.month
  const pluralUnit =
    state.frequency === "DAILY"
      ? messages.productScheduleForm.preview.units.days
      : state.frequency === "WEEKLY"
        ? messages.productScheduleForm.preview.units.weeks
        : messages.productScheduleForm.preview.units.months
  const cadence =
    interval === 1
      ? formatMessage(messages.productScheduleForm.preview.everyUnit, {
          unit: singularUnit,
        })
      : formatMessage(messages.productScheduleForm.preview.everyIntervalUnits, {
          interval,
          unitPlural: pluralUnit,
        })

  if (state.frequency === "WEEKLY") {
    if (state.byWeekdays.length === 0) {
      return `${cadence} ${messages.productScheduleForm.preview.chooseWeekdays}`
    }
    const labels = WEEKDAYS.filter((weekday) => state.byWeekdays.includes(weekday)).map(
      (weekday) => messages.productScheduleForm.preview.weekdayLabels[weekday],
    )
    return formatMessage(messages.productScheduleForm.preview.onWeekdays, {
      cadence,
      labels: labels.join(", "),
    })
  }

  if (state.frequency === "MONTHLY") {
    if (state.byMonthDays.length === 0) {
      return `${cadence} ${messages.productScheduleForm.preview.chooseDays}`
    }
    const ordered = [...state.byMonthDays]
      .map((value) => Number.parseInt(value, 10))
      .filter(Number.isFinite)
      .sort((left, right) => left - right)
    return formatMessage(messages.productScheduleForm.preview.onMonthDays, {
      cadence,
      daySuffix: ordered.length === 1 ? "" : "s",
      days: ordered.join(", "),
    })
  }

  return cadence
}

export function ProductScheduleForm({ mode, onSuccess, onCancel }: ProductScheduleFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useAvailabilityRuleMutation()
  const messages = useRegistryProductsMessagesOrDefault()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending
  const timezoneOptions = React.useMemo(() => getTimezoneOptions(state.timezone), [state.timezone])
  const preview = React.useMemo(() => describeSchedule(state, messages), [messages, state])
  const frequencyOptions = React.useMemo(
    () => [
      // i18n-literal-ok enum values
      { value: "DAILY", label: messages.productScheduleForm.frequencyLabels.DAILY }, // i18n-literal-ok enum value
      { value: "WEEKLY", label: messages.productScheduleForm.frequencyLabels.WEEKLY }, // i18n-literal-ok enum value
      { value: "MONTHLY", label: messages.productScheduleForm.frequencyLabels.MONTHLY }, // i18n-literal-ok enum value
    ],
    [messages],
  )

  const field =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setState((previous) => ({ ...previous, [key]: value }))
    }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.timezone) {
      setError(messages.productScheduleForm.validation.timezoneRequired)
      return
    }
    if (state.frequency === "WEEKLY" && state.byWeekdays.length === 0) {
      setError(messages.productScheduleForm.validation.weekdayRequired)
      return
    }
    if (state.frequency === "MONTHLY" && state.byMonthDays.length === 0) {
      setError(messages.productScheduleForm.validation.monthDayRequired)
      return
    }

    const interval = Math.max(1, Number.parseInt(state.interval || "1", 10) || 1)
    const recurrenceRule = buildRRule({
      frequency: state.frequency,
      interval,
      byWeekdays: state.frequency === "WEEKLY" ? state.byWeekdays : [],
      byMonthDays:
        state.frequency === "MONTHLY"
          ? state.byMonthDays
              .map((value) => Number.parseInt(value, 10))
              .filter((value) => Number.isFinite(value) && value >= 1 && value <= 31) // i18n-literal-ok numeric bounds
          : [],
    })

    const payload = {
      productId: mode.kind === "create" ? mode.productId : mode.rule.productId,
      optionId: mode.kind === "edit" ? mode.rule.optionId : undefined,
      facilityId: mode.kind === "edit" ? mode.rule.facilityId : undefined,
      timezone: state.timezone,
      recurrenceRule,
      maxCapacity: Math.max(0, Number.parseInt(state.maxCapacity || "0", 10) || 0),
      maxPickupCapacity: toNullableNumber(state.maxPickupCapacity),
      minTotalPax: toNullableNumber(state.minTotalPax),
      cutoffMinutes: toNullableNumber(state.cutoffMinutes),
      earlyBookingLimitMinutes: toNullableNumber(state.earlyBookingLimitMinutes),
      active: state.active,
    }

    try {
      const rule =
        mode.kind === "create"
          ? await create.mutateAsync(payload)
          : await update.mutateAsync({ id: mode.rule.id, input: payload })
      onSuccess?.(rule)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : messages.productScheduleForm.validation.saveFailed,
      )
    }
  }

  return (
    <form data-slot="product-schedule-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{messages.productScheduleForm.fields.repeats}</Label>
          <Select
            items={frequencyOptions}
            value={state.frequency}
            onValueChange={(value) => field("frequency")(value as Frequency)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {frequencyOptions.map((frequency) => (
                <SelectItem key={frequency.value} value={frequency.value}>
                  {frequency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-schedule-interval">
            {messages.productScheduleForm.fields.every}
          </Label>
          <Input
            id="product-schedule-interval"
            type="number"
            min="1"
            value={state.interval}
            onChange={(event) => field("interval")(event.target.value)}
          />
        </div>
      </div>

      {state.frequency === "WEEKLY" ? (
        <div className="flex flex-col gap-1.5">
          <Label>{messages.productScheduleForm.fields.weekdays}</Label>
          <ToggleGroup
            type="multiple"
            value={state.byWeekdays}
            onValueChange={(value) => field("byWeekdays")(value as Weekday[])}
            className="justify-start"
          >
            {WEEKDAYS.map((weekday) => (
              <ToggleGroupItem key={weekday} value={weekday} aria-label={WEEKDAY_LABELS[weekday]}>
                {WEEKDAY_LABELS[weekday]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}

      {state.frequency === "MONTHLY" ? (
        <div className="flex flex-col gap-1.5">
          <Label>{messages.productScheduleForm.fields.monthDays}</Label>
          <ToggleGroup
            type="multiple"
            value={state.byMonthDays}
            onValueChange={(value) => field("byMonthDays")(value)}
            className="justify-start"
          >
            {MONTH_DAYS.map((day) => (
              <ToggleGroupItem key={day} value={day} aria-label={`Day ${day}`}>
                {day}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        {preview}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{messages.productScheduleForm.fields.timezone}</Label>
          <Select
            items={timezoneOptions.map((timezone) => ({ label: timezone, value: timezone }))}
            value={state.timezone}
            onValueChange={(value) => field("timezone")(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {timezoneOptions.map((timezone) => (
                <SelectItem key={timezone} value={timezone}>
                  {timezone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-schedule-max-capacity">
            {messages.productScheduleForm.fields.maxCapacity}
          </Label>
          <Input
            id="product-schedule-max-capacity"
            type="number"
            min="0"
            value={state.maxCapacity}
            onChange={(event) => field("maxCapacity")(event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-schedule-max-pickup-capacity">
            {messages.productScheduleForm.fields.maxPickupCapacity}
          </Label>
          <Input
            id="product-schedule-max-pickup-capacity"
            type="number"
            min="0"
            value={state.maxPickupCapacity}
            onChange={(event) => field("maxPickupCapacity")(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-schedule-min-total-pax">
            {messages.productScheduleForm.fields.minTotalPax}
          </Label>
          <Input
            id="product-schedule-min-total-pax"
            type="number"
            min="0"
            value={state.minTotalPax}
            onChange={(event) => field("minTotalPax")(event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-schedule-cutoff">
            {messages.productScheduleForm.fields.cutoffMinutes}
          </Label>
          <Input
            id="product-schedule-cutoff"
            type="number"
            min="0"
            value={state.cutoffMinutes}
            onChange={(event) => field("cutoffMinutes")(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-schedule-early-booking-limit">
            {messages.productScheduleForm.fields.earlyBookingLimitMinutes}
          </Label>
          <Input
            id="product-schedule-early-booking-limit"
            type="number"
            min="0"
            value={state.earlyBookingLimitMinutes}
            onChange={(event) => field("earlyBookingLimitMinutes")(event.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={state.active} onCheckedChange={(checked) => field("active")(checked)} />
        <Label>{messages.productScheduleForm.fields.active}</Label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {messages.common.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mode.kind === "create"
            ? messages.productScheduleForm.actions.createSchedule
            : messages.productScheduleForm.actions.saveSchedule}
        </Button>
      </div>
    </form>
  )
}
