"use client"

import { format, isValid, parseISO } from "date-fns"
import { CalendarIcon, XIcon } from "lucide-react"
import * as React from "react"

import { cn } from "../lib/utils.js"

import { Button } from "./button.js"
import { Calendar } from "./calendar.js"
import { Input } from "./input.js"
import { Label } from "./label.js"
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js"
import { Separator } from "./separator.js"

type CalendarProps = React.ComponentProps<typeof Calendar>

export type DateTimePickerProps = {
  /**
   * Current value, formatted as `"YYYY-MM-DDTHH:mm"` (matching the native
   * `<input type="datetime-local">` format). `null` or `undefined` clears.
   */
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  placeholder?: React.ReactNode
  /** date-fns format string used for the trigger label. */
  displayFormat?: string
  className?: string
  contentClassName?: string
  /** Disable the entire picker (prevents opening the popover). */
  disabled?: boolean
  /** Per-day disable matcher, forwarded to the underlying Calendar. */
  dateDisabled?: CalendarProps["disabled"]
  clearable?: boolean
}

function parseDateTimeValue(value?: string | null): Date | undefined {
  if (!value) return undefined
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function formatDateTimeValue(date?: Date): string | null {
  // "YYYY-MM-DDTHH:mm" in local time — mirrors native datetime-local format.
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : null
}

function formatTime(date?: Date): string {
  return date ? format(date, "HH:mm") : ""
}

function combineDateAndTime(date: Date, time: string): Date {
  // time is "HH:mm" — use midnight as a fallback if malformed.
  const [hStr, mStr] = time.split(":")
  const next = new Date(date)
  next.setHours(Number(hStr) || 0, Number(mStr) || 0, 0, 0)
  return next
}

type TriggerProps = {
  className?: string
  empty: boolean
  disabled?: boolean
  children?: React.ReactNode
}

function DateTimePickerTrigger({ className, empty, disabled, children }: TriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      data-empty={empty}
      disabled={disabled}
      className={cn(
        "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
        className,
      )}
    >
      <CalendarIcon className="h-4 w-4" />
      <span className="truncate">{children}</span>
    </Button>
  )
}

/**
 * Combined date + time picker. Backed by Calendar + HH:mm time input, with
 * value serialized as `"YYYY-MM-DDTHH:mm"` so it's a drop-in replacement for
 * native `<input type="datetime-local">`.
 */
export function DateTimePicker({
  value,
  defaultValue,
  onChange,
  placeholder = "Pick date & time",
  displayFormat = "PPp",
  className,
  contentClassName,
  disabled,
  dateDisabled,
  clearable = true,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState<string | null>(defaultValue ?? null)

  const isControlled = value !== undefined
  const selectedValue = isControlled ? (value ?? null) : internalValue
  const selectedDate = parseDateTimeValue(selectedValue)

  const handleChange = React.useCallback(
    (nextValue: string | null) => {
      if (!isControlled) {
        setInternalValue(nextValue)
      }
      onChange?.(nextValue)
    },
    [isControlled, onChange],
  )

  const handleDaySelect = (nextDate?: Date) => {
    if (!nextDate) {
      handleChange(null)
      return
    }
    // Preserve the existing time-of-day when picking a new day.
    const timeSource = selectedDate ?? new Date()
    const combined = combineDateAndTime(nextDate, formatTime(timeSource))
    handleChange(formatDateTimeValue(combined))
  }

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = event.target.value
    // If the user clears the time input, keep the date and fall back to 00:00.
    const dateSource = selectedDate ?? new Date()
    const combined = combineDateAndTime(dateSource, nextTime || "00:00")
    handleChange(formatDateTimeValue(combined))
  }

  const label = selectedDate ? format(selectedDate, displayFormat) : placeholder

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <DateTimePickerTrigger className={className} empty={!selectedDate} disabled={disabled} />
        }
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-auto p-0", contentClassName)}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDaySelect}
          defaultMonth={selectedDate}
          disabled={dateDisabled}
        />
        <Separator />
        <div className="flex items-center gap-2 p-3">
          <Label htmlFor="datetime-picker-time" className="text-xs text-muted-foreground">
            Time
          </Label>
          <Input
            id="datetime-picker-time"
            type="time"
            value={selectedDate ? formatTime(selectedDate) : ""}
            onChange={handleTimeChange}
            className="h-8 w-auto"
            disabled={!selectedDate}
          />
        </div>
        {clearable && selectedDate ? (
          <>
            <Separator />
            <div className="flex justify-end p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleChange(null)
                  setOpen(false)
                }}
              >
                <XIcon className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
