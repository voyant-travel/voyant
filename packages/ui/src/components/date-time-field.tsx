"use client"

import { format, isValid, parseISO } from "date-fns"
import { ChevronDownIcon } from "lucide-react"
import * as React from "react"

import { cn } from "../lib/utils.js"

import { Button } from "./button.js"
import { Calendar } from "./calendar.js"
import { Field, FieldGroup, FieldLabel } from "./field.js"
import { Input } from "./input.js"
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js"

export interface DateTimeFieldProps {
  /**
   * Current value formatted as `"YYYY-MM-DDTHH:mm"` — same shape as the
   * native `<input type="datetime-local">` element. `null` / `undefined`
   * means "no value".
   */
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  /** Date sub-field label. Pass `null` or empty string to hide. */
  dateLabel?: React.ReactNode
  /** Time sub-field label. Pass `null` or empty string to hide. */
  timeLabel?: React.ReactNode
  /** Trigger placeholder shown when no date is selected. */
  datePlaceholder?: React.ReactNode
  /** date-fns format used for the date trigger label. */
  dateFormat?: string
  /** id prefix; the date trigger gets `${id}-date`, the time input `${id}-time`. */
  id?: string
  disabled?: boolean
  /** Time granularity for `<input type="time" step>` (default 60 seconds). */
  step?: number | string
  className?: string
}

function parseValue(value?: string | null): Date | undefined {
  if (!value) return undefined
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function formatValue(date?: Date): string | null {
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : null
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hStr, mStr, sStr] = time.split(":")
  const next = new Date(date)
  next.setHours(Number(hStr) || 0, Number(mStr) || 0, Number(sStr) || 0, 0)
  return next
}

/**
 * Date + time picker rendered as two side-by-side fields — a Calendar popover
 * for the date and a native `<input type="time">` for the time. Value is
 * serialized as `"YYYY-MM-DDTHH:mm"` so callers can swap it in for native
 * `<input type="datetime-local">` without changing their state shape.
 */
export function DateTimeField({
  value,
  defaultValue,
  onChange,
  dateLabel = "Date",
  timeLabel = "Time",
  datePlaceholder = "Select date",
  dateFormat = "PPP",
  id,
  disabled,
  step = 60,
  className,
}: DateTimeFieldProps) {
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState<string | null>(defaultValue ?? null)
  const isControlled = value !== undefined
  const currentValue = isControlled ? (value ?? null) : internalValue
  const date = parseValue(currentValue)
  const dateId = id ? `${id}-date` : undefined
  const timeId = id ? `${id}-time` : undefined

  const emit = React.useCallback(
    (next: string | null) => {
      if (!isControlled) setInternalValue(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  const handleDaySelect = (nextDate?: Date) => {
    if (!nextDate) {
      emit(null)
      setOpen(false)
      return
    }
    const timeSource = date ?? new Date()
    const combined = combineDateAndTime(nextDate, format(timeSource, "HH:mm"))
    emit(formatValue(combined))
    setOpen(false)
  }

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = event.target.value
    const baseDate = date ?? new Date()
    const combined = combineDateAndTime(baseDate, time || "00:00")
    emit(formatValue(combined))
  }

  return (
    <FieldGroup className={cn("flex-row gap-2", className)}>
      <Field>
        {dateLabel ? <FieldLabel htmlFor={dateId}>{dateLabel}</FieldLabel> : null}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={dateId}
                type="button"
                variant="outline"
                disabled={disabled}
                data-empty={!date}
                className="w-full justify-between font-normal data-[empty=true]:text-muted-foreground"
              />
            }
          >
            <span className="truncate">{date ? format(date, dateFormat) : datePlaceholder}</span>
            <ChevronDownIcon className="size-4 shrink-0" />
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              defaultMonth={date}
              onSelect={handleDaySelect}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field className="w-40 shrink-0">
        {timeLabel ? <FieldLabel htmlFor={timeId}>{timeLabel}</FieldLabel> : null}
        <Input
          id={timeId}
          type="time"
          step={step}
          value={date ? format(date, "HH:mm") : ""}
          onChange={handleTimeChange}
          disabled={disabled || !date}
          className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </Field>
    </FieldGroup>
  )
}
