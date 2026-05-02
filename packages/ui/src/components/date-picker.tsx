"use client"

import { format, isValid, parseISO } from "date-fns"
import { CalendarIcon, XIcon } from "lucide-react"
import * as React from "react"
import type { DateRange } from "react-day-picker"

import { cn } from "../lib/utils"

import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Separator } from "./separator"

type CalendarProps = React.ComponentProps<typeof Calendar>

type SinglePreset = {
  label: string
  value: string | null
}

type DateRangeValue = {
  from: string | null
  to: string | null
}

type RangePreset = {
  label: string
  value: DateRangeValue | null
}

type SharedProps = Omit<CalendarProps, "mode" | "selected" | "onSelect"> & {
  placeholder?: React.ReactNode
  displayFormat?: string
  className?: string
  contentClassName?: string
  clearable?: boolean
}

type DatePickerProps = SharedProps & {
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  presets?: SinglePreset[]
}

type DateRangePickerProps = SharedProps & {
  value?: DateRangeValue | null
  defaultValue?: DateRangeValue | null
  onChange?: (value: DateRangeValue | null) => void
  presets?: RangePreset[]
}

function parseDateValue(value?: string | null) {
  if (!value) return undefined

  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function formatDateValue(value?: Date) {
  return value ? format(value, "yyyy-MM-dd") : null
}

function hasRangeValue(value?: DateRangeValue | null) {
  return Boolean(value?.from || value?.to)
}

function formatRangeLabel(
  value: DateRangeValue | null | undefined,
  displayFormat: string,
  placeholder: React.ReactNode,
) {
  if (!value?.from && !value?.to) return placeholder

  const from = parseDateValue(value?.from)
  const to = parseDateValue(value?.to)

  if (from && to) {
    return `${format(from, displayFormat)} - ${format(to, displayFormat)}`
  }

  if (from) {
    return `${format(from, displayFormat)} -`
  }

  if (to) {
    return `- ${format(to, displayFormat)}`
  }

  return placeholder
}

type TriggerProps = React.ComponentProps<typeof Button> & {
  empty: boolean
}

function DatePickerTrigger({ className, empty, children, ...props }: TriggerProps) {
  // Spread `...props` so base-ui's `<PopoverTrigger render={<DatePickerTrigger />}>`
  // can forward its merged onClick / aria-expanded / ref onto the actual Button —
  // without this, the popover never opens because the click handler stops at this
  // wrapper.
  return (
    <Button
      {...props}
      variant="outline"
      data-empty={empty}
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

type FooterProps = {
  clearable: boolean
  hasValue: boolean
  onClear: () => void
}

function DatePickerFooter({ clearable, hasValue, onClear }: FooterProps) {
  if (!clearable || !hasValue) return null

  return (
    <>
      <Separator />
      <div className="flex justify-end p-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <XIcon className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </>
  )
}

type SinglePresetsProps = {
  presets: SinglePreset[]
  onSelect: (value: string | null) => void
}

function SinglePresets({ presets, onSelect }: SinglePresetsProps) {
  if (presets.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-2 p-3 pb-0">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="px-3 pt-3">
        <Separator />
      </div>
    </>
  )
}

type RangePresetsProps = {
  presets: RangePreset[]
  onSelect: (value: DateRangeValue | null) => void
}

function RangePresets({ presets, onSelect }: RangePresetsProps) {
  if (presets.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-2 p-3 pb-0">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="px-3 pt-3">
        <Separator />
      </div>
    </>
  )
}

export function DatePicker({
  value,
  defaultValue,
  onChange,
  presets = [],
  placeholder = "Pick a date",
  displayFormat = "PPP",
  className,
  contentClassName,
  clearable = true,
  ...calendarProps
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState<string | null>(defaultValue ?? null)

  const isControlled = value !== undefined
  const selectedValue = isControlled ? (value ?? null) : internalValue
  const selectedDate = parseDateValue(selectedValue)

  const handleChange = React.useCallback(
    (nextValue: string | null) => {
      if (!isControlled) {
        setInternalValue(nextValue)
      }

      onChange?.(nextValue)
    },
    [isControlled, onChange],
  )

  const handleSelect = (nextDate?: Date) => {
    handleChange(formatDateValue(nextDate))
    if (nextDate) {
      setOpen(false)
    }
  }

  const label = selectedDate ? format(selectedDate, displayFormat) : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<DatePickerTrigger className={className} empty={!selectedDate} />}>
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-auto p-0", contentClassName)}>
        <SinglePresets
          presets={presets}
          onSelect={(presetValue) => {
            handleChange(presetValue)
            setOpen(false)
          }}
        />
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate}
          {...calendarProps}
        />
        <DatePickerFooter
          clearable={clearable}
          hasValue={Boolean(selectedDate)}
          onClear={() => {
            handleChange(null)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export function DateRangePicker({
  value,
  defaultValue,
  onChange,
  presets = [],
  placeholder = "Pick a date range",
  displayFormat = "LLL d, y",
  className,
  contentClassName,
  clearable = true,
  numberOfMonths = 2,
  ...calendarProps
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState<DateRangeValue | null>(
    defaultValue ?? null,
  )

  const isControlled = value !== undefined
  const selectedValue = isControlled ? (value ?? null) : internalValue

  const selectedRange: DateRange | undefined = selectedValue
    ? {
        from: parseDateValue(selectedValue.from),
        to: parseDateValue(selectedValue.to),
      }
    : undefined

  const handleChange = React.useCallback(
    (nextValue: DateRangeValue | null) => {
      if (!isControlled) {
        setInternalValue(nextValue)
      }

      onChange?.(nextValue)
    },
    [isControlled, onChange],
  )

  const handleSelect = (nextRange?: DateRange) => {
    const nextValue =
      nextRange?.from || nextRange?.to
        ? {
            from: formatDateValue(nextRange.from),
            to: formatDateValue(nextRange.to),
          }
        : null

    handleChange(nextValue)

    if (nextRange?.from && nextRange.to) {
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<DatePickerTrigger className={className} empty={!hasRangeValue(selectedValue)} />}
      >
        {formatRangeLabel(selectedValue, displayFormat, placeholder)}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-auto p-0", contentClassName)}>
        <RangePresets
          presets={presets}
          onSelect={(presetValue) => {
            handleChange(presetValue)
            setOpen(false)
          }}
        />
        <Calendar
          mode="range"
          selected={selectedRange}
          onSelect={handleSelect}
          defaultMonth={selectedRange?.from}
          numberOfMonths={numberOfMonths}
          {...calendarProps}
        />
        <DatePickerFooter
          clearable={clearable}
          hasValue={hasRangeValue(selectedValue)}
          onClear={() => {
            handleChange(null)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export type { DatePickerProps, DateRangePickerProps, DateRangeValue }
