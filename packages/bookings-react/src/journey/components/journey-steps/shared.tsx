"use client"

/**
 * Cross-used leaf helpers + shared types for the journey step components.
 * Everything else imports shared helpers from here.
 */

import type { BookingDraftShape } from "@voyant-travel/catalog-contracts/booking-engine/draft-shape"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import { PhoneInput } from "@voyant-travel/ui/components/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components/select"
import { formatMessage, useBookingsUiMessagesOrDefault } from "../../../i18n/index.js"
import type { Draft } from "../../lib/draft-state.js"
import type { DeparturePickerProps, UnitsPickerProps } from "../../types.js"

/** Injectable departure-picker render slot, threaded from BookingJourneyProps. */
export type RenderDeparturePicker = (props: DeparturePickerProps) => React.ReactNode
/** Injectable units (rooms) render slot, threaded from BookingJourneyProps. */
export type RenderUnitsPicker = (props: UnitsPickerProps) => React.ReactNode

export interface StepCommonProps {
  draft: Draft
  // Accepts a value or a functional updater (the underlying `useState`
  // dispatcher), so effects can merge onto the latest draft without clobbering
  // concurrent updates.
  setDraft: (next: Draft | ((prev: Draft) => Draft)) => void
  shape: BookingDraftShape
}

/**
 * Soft validation warnings for a step, rendered INSIDE its card (below the
 * content) so they're visibly scoped to the block they belong to.
 */
export function JourneyWarnings({
  warnings,
}: {
  warnings?: ReadonlyArray<string>
}): React.ReactElement | null {
  if (!warnings || warnings.length === 0) return null
  return (
    <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      {warnings.map((w) => (
        <li key={w}>⚠ {w}</li>
      ))}
    </ul>
  )
}

export function JourneyErrors({
  errors,
}: {
  errors?: ReadonlyArray<string>
}): React.ReactElement | null {
  if (!errors || errors.length === 0) return null
  return (
    <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive text-sm">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  )
}

export function Field({
  id,
  label,
  value,
  onChange,
  type,
  placeholder,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  error?: string
}): React.ReactElement {
  const errorId = `${id}-error`
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type ?? "text"}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p id={errorId} className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PhoneField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <PhoneInput
        id={id}
        defaultCountry="GB"
        international
        value={value || undefined}
        onChange={(v) => onChange(v ? String(v) : "")}
      />
    </div>
  )
}

/**
 * Date field that uses the shared `<DatePicker />` from
 * `@voyant-travel/ui` with a month + year dropdown caption so users can
 * jump across decades without arrow-clicking. The `range` hint picks
 * a reasonable startMonth/endMonth window per use case:
 *
 *   - `"past"`     — DOB-style picks (today back ~120 years)
 *   - `"future"`   — departure / check-in / check-out (today forward ~5 years)
 *   - `"document"` — passport / ID expiry (today forward ~20 years)
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  range = "future",
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  range?: "past" | "future" | "document"
}): React.ReactElement {
  const today = new Date()
  const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const startMonth =
    range === "past"
      ? new Date(today.getFullYear() - 120, 0, 1)
      : range === "document"
        ? todayMonth
        : todayMonth
  const endMonth =
    range === "past"
      ? new Date(today.getFullYear() + 1, 11, 1)
      : range === "document"
        ? new Date(today.getFullYear() + 20, 11, 1)
        : new Date(today.getFullYear() + 5, 11, 1)
  const defaultMonth =
    range === "past" && !value ? new Date(today.getFullYear() - 30, 0, 1) : undefined

  return (
    <div className="space-y-1" id={id}>
      <Label>{label}</Label>
      <DatePicker
        value={value || null}
        onChange={(v) => onChange(v ?? "")}
        captionLayout="dropdown"
        startMonth={startMonth}
        endMonth={endMonth}
        defaultMonth={defaultMonth}
        displayFormat="PPP"
      />
    </div>
  )
}

export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (v: string) => void
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={messages.bookingJourney.values.selectPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Years between an ISO date-of-birth and today. Returns `null` for
 * unparseable input or future dates so the UI can hide the badge
 * gracefully rather than rendering "age -3".
 */
export function computeAge(dob: string): number | null {
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age >= 0 ? age : null
}

export function ageHint(
  min: number | undefined,
  max: number | undefined,
  messages: ReturnType<typeof useBookingsUiMessagesOrDefault>,
): string {
  if (min != null && max != null) {
    return formatMessage(messages.bookingJourney.configure.ageHintRange, {
      min,
      max,
    })
  }
  if (min != null) {
    return formatMessage(messages.bookingJourney.configure.ageHintMinimum, {
      min,
    })
  }
  if (max != null) {
    return formatMessage(messages.bookingJourney.configure.ageHintMaximum, {
      max,
    })
  }
  return ""
}

// i18n-literal-ok Generic helper type signature, not user-visible copy.
export function bucketBy<T>(items: ReadonlyArray<T>, keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    let bucket = map.get(key)
    if (!bucket) {
      bucket = []
      map.set(key, bucket)
    }
    bucket.push(item)
  }
  return map
}

export function cryptoRowId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `r_${Math.random().toString(36).slice(2, 10)}`
}
