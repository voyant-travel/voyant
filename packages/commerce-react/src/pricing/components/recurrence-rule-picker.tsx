"use client"

import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { ChevronDown } from "lucide-react"
import { useMemo } from "react"
import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import {
  monthDisplayName,
  parseRecurrence,
  RECURRENCE_MONTHS,
  RECURRENCE_WEEKDAYS,
  type RecurrenceFrequency,
  type RecurrenceState,
  type RecurrenceWeekdayToken,
  serializeRecurrence,
  weekdayDisplayName,
} from "./recurrence-rule.js"

export interface RecurrenceRulePickerProps {
  value: string
  onChange: (rule: string) => void
  disabled?: boolean
}

const FREQUENCY_OPTIONS: RecurrenceFrequency[] = ["yearly", "monthly", "weekly", "custom"]

export function RecurrenceRulePicker({ value, onChange, disabled }: RecurrenceRulePickerProps) {
  const messages = usePricingUiMessagesOrDefault()
  const recurrence = messages.recurrence

  const state = useMemo(() => parseRecurrence(value), [value])

  const emit = (next: RecurrenceState) => {
    onChange(serializeRecurrence(next))
  }

  const handleFrequencyChange = (frequency: RecurrenceFrequency) => {
    if (frequency === "custom") {
      // Preserve whatever is currently expressed as the editable raw string.
      emit({ ...state, frequency: "custom", raw: value })
      return
    }
    emit({ ...state, frequency, raw: value })
  }

  const toggleMonth = (month: number) => {
    const months = state.months.includes(month)
      ? state.months.filter((value) => value !== month)
      : [...state.months, month]
    emit({ ...state, frequency: "yearly", months })
  }

  const toggleWeekday = (token: RecurrenceWeekdayToken) => {
    const weekdays = state.weekdays.includes(token)
      ? state.weekdays.filter((value) => value !== token)
      : [...state.weekdays, token]
    emit({ ...state, frequency: "weekly", weekdays })
  }

  const handleMonthDayChange = (raw: string) => {
    const parsed = Number.parseInt(raw, 10)
    const monthDay = Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : null
    emit({ ...state, frequency: "monthly", monthDay })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label>{recurrence.frequencyLabel}</Label>
        <Select
          items={FREQUENCY_OPTIONS.map((option) => ({
            label: recurrence.frequencyOptions[option],
            value: option,
          }))}
          value={state.frequency}
          onValueChange={(next) => handleFrequencyChange(next as RecurrenceFrequency)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {recurrence.frequencyOptions[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.frequency === "yearly" ? (
        <div className="flex flex-col gap-2">
          <Label>{recurrence.monthsLabel}</Label>
          <div className="grid grid-cols-4 gap-2">
            {RECURRENCE_MONTHS.map((month) => {
              const selected = state.months.includes(month.value)
              return (
                <Button
                  key={month.value}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  disabled={disabled}
                  onClick={() => toggleMonth(month.value)}
                  aria-pressed={selected}
                >
                  {monthDisplayName(month.index)}
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}

      {state.frequency === "weekly" ? (
        <div className="flex flex-col gap-2">
          <Label>{recurrence.weekdaysLabel}</Label>
          <div className="grid grid-cols-7 gap-2">
            {RECURRENCE_WEEKDAYS.map((day) => {
              const selected = state.weekdays.includes(day.token)
              return (
                <Button
                  key={day.token}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  disabled={disabled}
                  onClick={() => toggleWeekday(day.token)}
                  aria-pressed={selected}
                >
                  {weekdayDisplayName(day.index)}
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}

      {state.frequency === "monthly" ? (
        <div className="flex flex-col gap-2">
          <Label>{recurrence.monthDayLabel}</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={state.monthDay ?? ""}
            disabled={disabled}
            placeholder={recurrence.monthDayPlaceholder}
            onChange={(event) => handleMonthDayChange(event.target.value)}
          />
        </div>
      ) : null}

      {state.frequency === "custom" ? (
        <div className="flex flex-col gap-2">
          <Label>{recurrence.rawRuleLabel}</Label>
          <Input
            value={value}
            disabled={disabled}
            placeholder={recurrence.rawRulePlaceholder}
            className="font-mono text-xs"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      ) : null}

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="w-fit gap-1 px-0">
            <ChevronDown className="h-4 w-4" />
            {recurrence.advancedLabel}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="flex flex-col gap-2">
            <Label>{recurrence.rawRuleLabel}</Label>
            <Input
              value={value}
              disabled={disabled}
              placeholder={recurrence.rawRulePlaceholder}
              className="font-mono text-xs"
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
