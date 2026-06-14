"use client"

import type {
  FlightPassenger,
  PassengerCounts,
  PassengerType,
  TravelDocument,
} from "@voyant-travel/flights/contract/types"
import { Checkbox } from "@voyant-travel/ui/components/checkbox"
import { CountryCombobox } from "@voyant-travel/ui/components/country-combobox"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components/select"
import { CircleAlert, IdCard } from "lucide-react"
import { type ReactNode, useEffect, useMemo } from "react"
import { flightsUiEn } from "../i18n/en.js"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"

/** Subset of FlightPassenger that a picker can pre-fill into a card. */
export type PassengerPrefill = Partial<
  Pick<
    FlightPassenger,
    "firstName" | "middleName" | "lastName" | "dateOfBirth" | "gender" | "email" | "phone"
  >
>

// Date-of-birth range — anyone born within the last 110 years is plausible;
// future dates make no sense. Computed once at module load.
const DOB_END_MONTH = new Date()
const DOB_START_MONTH = new Date(DOB_END_MONTH.getFullYear() - 110, 0, 1)

// Travel-document expiry range — passports/national IDs are typically valid
// 10 years; visas can extend further. Cap at +30 years to keep the year
// dropdown manageable. Past dates are disabled (an expired doc isn't usable
// for booking).
const EXPIRY_START_MONTH = new Date()
const EXPIRY_END_MONTH = new Date(EXPIRY_START_MONTH.getFullYear() + 30, 11, 31)

export interface FlightPassengerFormProps {
  /** How many passengers of each type the booking is for. */
  counts: PassengerCounts
  /** Current passenger details (one entry per pax slot). */
  value: FlightPassenger[]
  onChange: (next: FlightPassenger[]) => void
  /**
   * Surface a banner above the cards prompting the operator to add travel
   * documents — typically true when the route looks international. Documents
   * remain optional (skip-to-check-in is one click), but the prompt nudges
   * the operator to fill them up-front.
   */
  documentsRequired?: boolean
  /**
   * Optional render slot for a person picker. Rendered next to each
   * passenger card title — typically a "Pick from contacts" button. Calling
   * `onPicked` with prefill data merges it into the card without
   * overwriting fields the picker doesn't carry (e.g. CRM has no DOB).
   */
  renderPicker?: (
    slot: { passengerId: string; type: PassengerType },
    onPicked: (prefill: PassengerPrefill) => void,
  ) => ReactNode
}

/**
 * Editable list of passenger forms — one card per pax slot derived from
 * `counts`. Synthesizes stable `passengerId`s ("pax_adult_1", "pax_child_1",
 * etc.) so the booking adapter can link tickets to passengers.
 *
 * Required fields per pax: type (set), firstName, lastName, dateOfBirth.
 * Gender + email/phone are optional. A travel-document subsection lives on
 * each card — collapsed by default ("Add at check-in instead"), expanded
 * when the operator opts to capture passport / national-id up front. When
 * filled, the document is written to `value.documents[0]` so it ships
 * straight through `bookFlight`.
 */
export function FlightPassengerForm({
  counts,
  value,
  onChange,
  documentsRequired,
  renderPicker,
}: FlightPassengerFormProps) {
  const messages = useFlightsUiMessagesOrDefault()
  // Derive the canonical pax slots from `counts`. Passenger ids are stable
  // by position so re-ordering is safe.
  const slots = useMemo(() => buildSlots(counts), [counts])

  // Materialize missing rows so the UI always has one value per slot.
  // (Keeps existing values when the user navigates back to this step.)
  useEffect(() => {
    if (slots.length === value.length) return
    const next = slots.map((slot) => {
      const existing = value.find((p) => p.passengerId === slot.passengerId)
      return existing ?? blankPassenger(slot.passengerId, slot.type)
    })
    onChange(next)
    // We intentionally only re-sync when slot identities change (counts edit).
  }, [slots, value.length, value.find, onChange])

  const set = (passengerId: string, patch: Partial<FlightPassenger>) => {
    onChange(value.map((p) => (p.passengerId === passengerId ? { ...p, ...patch } : p)))
  }

  return (
    <div className="flex flex-col gap-4">
      {documentsRequired && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-amber-700 text-sm">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{messages.flightPassengerForm.documentsRequiredNotice}</span>
        </div>
      )}
      {slots.map((slot, i) => {
        const pax =
          value.find((p) => p.passengerId === slot.passengerId) ??
          blankPassenger(slot.passengerId, slot.type)
        const idx = sameTypeIndex(slots, slot, i) + 1
        return (
          <PassengerCard
            key={slot.passengerId}
            label={`${labelFor(slot.type, messages)} ${idx}`}
            messages={messages}
            value={pax}
            onChange={(patch) => set(slot.passengerId, patch)}
            picker={renderPicker?.(slot, (prefill) =>
              set(slot.passengerId, stripUndefined(prefill)),
            )}
          />
        )
      })}
    </div>
  )
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) (out as Record<string, unknown>)[k] = v
  }
  return out
}

function PassengerCard({
  label,
  value,
  onChange,
  picker,
  messages,
}: {
  label: string
  value: FlightPassenger
  onChange: (patch: Partial<FlightPassenger>) => void
  picker?: ReactNode
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  const doc = value.documents?.[0] ?? null
  const setDoc = (next: TravelDocument | null) => {
    onChange({ documents: next ? [next] : undefined })
  }
  const updateDoc = (patch: Partial<TravelDocument>) => {
    setDoc({ ...(doc ?? emptyDoc()), ...patch })
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">{label}</h3>
        {picker}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={messages.flightPassengerForm.fields.firstName} required>
          <Input
            value={value.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            placeholder={messages.flightPassengerForm.placeholders.asOnPassport}
          />
        </Field>
        <Field label={messages.flightPassengerForm.fields.middleName}>
          <Input
            value={value.middleName ?? ""}
            onChange={(e) => onChange({ middleName: e.target.value })}
            placeholder={messages.flightPassengerForm.placeholders.optional}
          />
        </Field>
        <Field label={messages.flightPassengerForm.fields.lastName} required>
          <Input
            value={value.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            placeholder={messages.flightPassengerForm.placeholders.asOnPassport}
          />
        </Field>
        <Field label={messages.flightPassengerForm.fields.dateOfBirth} required>
          <DatePicker
            value={value.dateOfBirth || null}
            onChange={(v) => onChange({ dateOfBirth: v ?? "" })}
            placeholder={messages.flightPassengerForm.placeholders.selectDate}
            className="w-full"
            captionLayout="dropdown"
            startMonth={DOB_START_MONTH}
            endMonth={DOB_END_MONTH}
            disabled={{ after: DOB_END_MONTH }}
          />
        </Field>
        <Field label={messages.flightPassengerForm.fields.gender}>
          <Select
            value={value.gender ?? ""}
            onValueChange={(v: string | null) => {
              if (v) onChange({ gender: v as "M" | "F" | "X" })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={messages.flightPassengerForm.placeholders.select} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">{messages.common.genderLabels.M}</SelectItem>
              <SelectItem value="F">{messages.common.genderLabels.F}</SelectItem>
              <SelectItem value="X">{messages.common.genderLabels.X}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium text-sm">
            <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
            {messages.flightPassengerForm.fields.travelDocument}
          </span>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Checkbox
              id={`pax-${value.passengerId}-doc-toggle`}
              checked={doc != null}
              onCheckedChange={(v) => setDoc(v ? emptyDoc() : null)}
            />
            <label htmlFor={`pax-${value.passengerId}-doc-toggle`} className="cursor-pointer">
              {messages.flightPassengerForm.addNow}
            </label>
          </div>
        </div>
        {!doc && (
          <p className="text-muted-foreground text-xs">
            {messages.flightPassengerForm.skipDocuments}
          </p>
        )}
        {doc && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={messages.flightPassengerForm.fields.documentType} required>
              <Select
                value={doc.type}
                onValueChange={(v: string | null) => {
                  if (!v) return
                  updateDoc({ type: v as TravelDocument["type"] })
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">
                    {messages.common.documentTypeLabels.passport}
                  </SelectItem>
                  <SelectItem value="national_id">
                    {messages.common.documentTypeLabels.national_id}
                  </SelectItem>
                  <SelectItem value="visa">{messages.common.documentTypeLabels.visa}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={messages.flightPassengerForm.fields.documentNumber} required>
              <Input
                value={doc.number}
                onChange={(e) => updateDoc({ number: e.target.value })}
                placeholder={messages.flightPassengerForm.placeholders.asPrintedOnDocument}
                autoCapitalize="characters"
              />
            </Field>
            <Field label={messages.flightPassengerForm.fields.countryOfIssue} required>
              <CountryCombobox
                value={doc.countryOfIssue || null}
                onChange={(code) => updateDoc({ countryOfIssue: code ?? "" })}
              />
            </Field>
            <Field label={messages.flightPassengerForm.fields.countryOfNationality}>
              <CountryCombobox
                value={doc.countryOfNationality ?? null}
                onChange={(code) => updateDoc({ countryOfNationality: code ?? undefined })}
              />
            </Field>
            <Field label={messages.flightPassengerForm.fields.expiryDate} required>
              <DatePicker
                value={doc.expiryDate ?? null}
                onChange={(v) => updateDoc({ expiryDate: v ?? undefined })}
                placeholder={messages.flightPassengerForm.placeholders.selectDate}
                className="w-full"
                captionLayout="dropdown"
                startMonth={EXPIRY_START_MONTH}
                endMonth={EXPIRY_END_MONTH}
                disabled={{ before: EXPIRY_START_MONTH }}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}

function emptyDoc(): TravelDocument {
  return {
    type: "passport",
    number: "",
    countryOfIssue: "",
  }
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot derivation
// ─────────────────────────────────────────────────────────────────────────────

interface PassengerSlot {
  passengerId: string
  type: PassengerType
}

function buildSlots(counts: PassengerCounts): PassengerSlot[] {
  const slots: PassengerSlot[] = []
  for (let i = 1; i <= counts.adults; i++) {
    slots.push({ passengerId: `pax_adult_${i}`, type: "adult" })
  }
  for (let i = 1; i <= (counts.children ?? 0); i++) {
    slots.push({ passengerId: `pax_child_${i}`, type: "child" })
  }
  for (let i = 1; i <= (counts.infants ?? 0); i++) {
    slots.push({ passengerId: `pax_infant_${i}`, type: "infant" })
  }
  return slots
}

function blankPassenger(passengerId: string, type: PassengerType): FlightPassenger {
  return {
    passengerId,
    type,
    firstName: "",
    lastName: "",
    dateOfBirth: "",
  }
}

function labelFor(
  type: PassengerType,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): string {
  return messages.common.passengerTypeLabels[type]
}

function sameTypeIndex(slots: PassengerSlot[], slot: PassengerSlot, idx: number): number {
  let count = 0
  for (let i = 0; i < idx; i++) {
    if (slots[i]?.type === slot.type) count++
  }
  return count
}

/**
 * Validate a list of passengers — returns the list of errors keyed by
 * passenger id, or an empty object when everything's filled. Used by the
 * journey to gate the Continue button. Documents are optional, but when
 * the operator opted to add one its required fields must be filled.
 */
export function validatePassengers(value: FlightPassenger[]): Record<string, string> {
  const messages = flightsUiEn.flightPassengerForm.validation
  const errors: Record<string, string> = {}
  for (const p of value) {
    if (!p.firstName.trim()) errors[p.passengerId] = messages.firstNameRequired
    else if (!p.lastName.trim()) errors[p.passengerId] = messages.lastNameRequired
    else if (!p.dateOfBirth) errors[p.passengerId] = messages.dateOfBirthRequired
    else {
      const doc = p.documents?.[0]
      if (doc) {
        if (!doc.number.trim()) errors[p.passengerId] = messages.documentNumberRequired
        else if (!doc.countryOfIssue.trim())
          errors[p.passengerId] = messages.documentCountryRequired
        else if (!doc.expiryDate) errors[p.passengerId] = messages.documentExpiryRequired
      }
    }
  }
  return errors
}
