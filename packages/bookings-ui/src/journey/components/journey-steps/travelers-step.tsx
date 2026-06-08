"use client"

import type { BookingDraftShape } from "@voyantjs/catalog/booking-engine"
import { Separator } from "@voyantjs/ui/components"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Label } from "@voyantjs/ui/components/label"
import { formatMessage, useBookingsUiMessagesOrDefault } from "../../../i18n/index.js"
import {
  canCopyBillingContactToTraveler,
  type Draft,
  patchPaxCount,
  setTravelers,
  totalPax,
} from "../../lib/draft-state.js"
import type { TravelerContactPickerProps } from "../../types.js"
import { PaxBands, PaxDependencyWarnings } from "./configure-steps.js"
import {
  computeAge,
  cryptoRowId,
  DateField,
  Field,
  JourneyWarnings,
  PhoneField,
  SelectField,
  type StepCommonProps,
} from "./shared.js"

// ─────────────────────────────────────────────────────────────────
// Travelers
// ─────────────────────────────────────────────────────────────────

export function TravelersStep({
  draft,
  setDraft,
  shape,
  renderTravelerContactPicker,
  warnings,
}: StepCommonProps & {
  renderTravelerContactPicker?: (props: TravelerContactPickerProps) => React.ReactNode
  warnings?: ReadonlyArray<string>
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const total = totalPax(draft)
  // Auto-resize the travelers list to match pax counts. Newly-added
  // rows pick a band based on the lowest-count band that's not yet
  // saturated — naive but predictable.
  const ensured = ensureTravelerRows(draft, total, shape)
  if (ensured !== draft.travelers) {
    setDraft(setTravelers(draft, ensured))
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.travelers.title}</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4">
        {/* The traveler counts live here (not in Configure): set how many of
            each type, and the rows below fill in who they are. The price
            re-quotes as the counts change. */}
        <PaxBands draft={draft} setDraft={setDraft} shape={shape} />
        <PaxDependencyWarnings draft={draft} shape={shape} />
        {ensured.length > 0 ? (
          <div className="flex flex-col gap-3">
            <Label>{messages.bookingJourney.travelers.details}</Label>
            {ensured.map((traveler, idx) => {
              const apply: TravelerContactPickerProps["apply"] = (contact) => {
                const next = [...ensured]
                next[idx] = {
                  ...next[idx]!,
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  email: contact.email,
                  phone: contact.phone,
                  personId: contact.personId,
                }
                setDraft(setTravelers(draft, next))
              }
              return (
                <TravelerCard
                  key={traveler.rowId ?? idx}
                  idx={idx}
                  traveler={traveler}
                  shape={shape}
                  draft={draft}
                  setDraft={setDraft}
                  renderTravelerContactPicker={renderTravelerContactPicker}
                  apply={apply}
                />
              )
            })}
          </div>
        ) : null}
        <JourneyWarnings warnings={warnings} />
      </CardContent>
    </Card>
  )
}

/**
 * One traveler block — name, optional contact, age, and any
 * descriptor-driven document fields. Honors `appliesToBands` so DOB
 * is required for child / infant bands and adult-only fields like
 * passport drop off the form for non-adult travelers.
 *
 * The first three canonical keys (firstName/lastName/email) are
 * rendered inline as fixed widgets; the rest comes off
 * `shape.travelerFields` so verticals can extend the set without
 * touching the wizard.
 */
function TravelerCard({
  idx,
  traveler,
  shape,
  draft,
  setDraft,
  renderTravelerContactPicker,
  apply,
  onRemove,
}: {
  idx: number
  traveler: Draft["travelers"][number]
  shape: BookingDraftShape
  draft: Draft
  setDraft: (next: Draft) => void
  renderTravelerContactPicker?: (props: TravelerContactPickerProps) => React.ReactNode
  apply: TravelerContactPickerProps["apply"]
  onRemove?: () => void
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  // The band is bookkeeping — only show fields that apply to this
  // band per the descriptor, but never expose the band tag in the UI.
  // The user just sees a flat traveler list.
  const applicableFields = shape.travelerFields.filter((f) => {
    if (!f.appliesToBands || f.appliesToBands.length === 0) return true
    return f.appliesToBands.includes(traveler.band)
  })

  const dobField = applicableFields.find((f) => f.key === "dateOfBirth")
  const phoneField = applicableFields.find((f) => f.key === "phone")
  const dynamicFields = applicableFields.filter(
    (f) => !["firstName", "lastName", "email", "phone", "dateOfBirth"].includes(f.key),
  )

  // Live age from DOB — surfaces in the header so the user gets
  // feedback as they pick a date.
  const computedAge = traveler.dateOfBirth ? computeAge(traveler.dateOfBirth) : null

  // The DOB drives band assignment. When the user picks a date that
  // would land in a different band, we silently reband the row and
  // shift the pax counters so the engine quotes the right price.
  // No "Move to X" prompts — the system just does the right thing.
  const onDobChange = (v: string) => {
    const age = v ? computeAge(v) : null
    let next = updateTravelerImmutable(draft, idx, { dateOfBirth: v })
    if (age != null) {
      const targetBand = shape.paxBands.find((b) => {
        if (b.minAge != null && age < b.minAge) return false
        if (b.maxAge != null && age > b.maxAge) return false
        return true
      })
      if (targetBand && targetBand.code !== traveler.band) {
        next = rebandTraveler(next, idx, traveler.band, targetBand.code)
      }
    }
    setDraft(next)
  }

  // Out-of-range warning — only fires when the entered DOB doesn't
  // fit ANY of the descriptor's bands (e.g. older than the supplier
  // accepts). We can't auto-fix that one — the booking would be
  // rejected and the user needs to know.
  const ageOutOfBounds =
    computedAge != null &&
    !shape.paxBands.some((b) => {
      if (b.minAge != null && computedAge < b.minAge) return false
      if (b.maxAge != null && computedAge > b.maxAge) return false
      return true
    })

  // Quick-fill from billing — useful when the lead booker is also a
  // traveler (the common B2C case). Doesn't touch travel-document
  // fields since those are personal to each traveler.
  const billingContact = draft.billing.contact
  const canCopyFromBilling = canCopyBillingContactToTraveler(billingContact)
  const copyFromBilling = () => {
    updateTraveler(draft, setDraft, idx, {
      firstName: billingContact.firstName,
      lastName: billingContact.lastName,
      email: billingContact.email || undefined,
      phone: billingContact.phone || undefined,
      // Carry the linked CRM person so the picker shows it as selected.
      personId: billingContact.personId || undefined,
    })
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      {/* Header: who this traveler is, with subtle row-level actions. */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {formatMessage(messages.bookingJourney.travelers.travelerNumber, {
            number: idx + 1,
          })}
          {computedAge != null ? (
            <span className="text-muted-foreground font-normal">
              {" · "}
              {formatMessage(messages.bookingJourney.travelers.ageLabel, {
                age: computedAge,
              })}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {canCopyFromBilling ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground"
              onClick={copyFromBilling}
            >
              {messages.bookingJourney.travelers.copyFromBilling}
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              {messages.bookingJourney.travelers.remove}
            </Button>
          ) : null}
        </div>
      </div>
      {/* Link an existing CRM contact (or create one) — full-width, the
          primary action; it auto-fills the name fields below. */}
      {renderTravelerContactPicker ? (
        <div>
          {renderTravelerContactPicker({
            rowIndex: idx,
            apply,
            selectedPersonId: traveler.personId,
          })}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id={`bj-trav-${idx}-first`}
          label={messages.bookingJourney.billing.firstName}
          value={traveler.firstName}
          onChange={(v) => updateTraveler(draft, setDraft, idx, { firstName: v })}
        />
        <Field
          id={`bj-trav-${idx}-last`}
          label={messages.bookingJourney.billing.lastName}
          value={traveler.lastName}
          onChange={(v) => updateTraveler(draft, setDraft, idx, { lastName: v })}
        />
        {applicableFields.some((f) => f.key === "email") ? (
          <Field
            id={`bj-trav-${idx}-email`}
            label={messages.bookingJourney.billing.email}
            type="email"
            value={traveler.email ?? ""}
            onChange={(v) => updateTraveler(draft, setDraft, idx, { email: v })}
          />
        ) : null}
        {phoneField ? (
          <PhoneField
            id={`bj-trav-${idx}-phone`}
            // i18n-literal-ok Required marker appended to a descriptor-supplied field label.
            label={phoneField.label + (phoneField.required ? " *" : "")}
            value={traveler.phone ?? ""}
            onChange={(v) => updateTraveler(draft, setDraft, idx, { phone: v })}
          />
        ) : null}
        {dobField ? (
          <div className="space-y-1">
            <DateField
              id={`bj-trav-${idx}-dob`}
              // i18n-literal-ok Required marker appended to a descriptor-supplied field label.
              label={dobField.label + (dobField.required ? " *" : "")}
              value={traveler.dateOfBirth ?? ""}
              onChange={onDobChange}
              range="past"
            />
            {ageOutOfBounds ? (
              <p className="text-amber-600 text-xs dark:text-amber-400">
                ⚠{" "}
                {formatMessage(messages.bookingJourney.validation.ageOutOfRange, {
                  age: computedAge,
                })}
              </p>
            ) : null}
          </div>
        ) : null}
        {dynamicFields.map((field) => {
          const value = (traveler.documents?.[field.key] as string | undefined) ?? ""
          const onFieldChange = (v: string) =>
            updateTraveler(draft, setDraft, idx, {
              documents: { ...traveler.documents, [field.key]: v },
            })
          // i18n-literal-ok Required marker appended to a descriptor-supplied field label.
          const labelText = field.label + (field.required ? " *" : "")
          if (field.type === "select" && field.options) {
            return (
              <SelectField
                key={field.key}
                id={`bj-trav-${idx}-${field.key}`}
                label={labelText}
                value={value}
                options={field.options}
                onChange={onFieldChange}
              />
            )
          }
          if (field.type === "date") {
            return (
              <DateField
                key={field.key}
                id={`bj-trav-${idx}-${field.key}`}
                label={labelText}
                value={value}
                onChange={onFieldChange}
                range={field.key === "documentExpiry" ? "document" : "future"}
              />
            )
          }
          return (
            <Field
              key={field.key}
              id={`bj-trav-${idx}-${field.key}`}
              label={labelText}
              type="text"
              value={value}
              onChange={onFieldChange}
            />
          )
        })}
      </div>
    </div>
  )
}

function ensureTravelerRows(
  draft: Draft,
  total: number,
  shape: BookingDraftShape,
): Draft["travelers"] {
  // Return the same reference when no resize is needed — the caller
  // uses identity equality to decide whether to call setDraft, and a
  // fresh array on every render would loop infinitely (set during
  // render → re-render → set again).
  if (draft.travelers.length === total) return draft.travelers
  const list = [...draft.travelers]
  while (list.length > total) list.pop()
  while (list.length < total) {
    const idx = list.length
    const band = pickBandForIndex(draft, idx, shape)
    list.push({
      rowId: cryptoRowId(),
      firstName: "",
      lastName: "",
      band,
    })
  }
  return list
}

function pickBandForIndex(
  draft: Draft,
  idx: number,
  shape: BookingDraftShape,
): "adult" | "child" | "infant" | "senior" | "student" | "other" {
  // Pick by remaining quota: distribute travelers in band order based
  // on counts in `configure.pax`.
  let cursor = 0
  for (const band of shape.paxBands) {
    const count = draft.configure.pax?.[band.code] ?? 0
    if (idx < cursor + count) {
      return (band.code as "adult" | "child" | "infant" | "senior" | "student" | "other") ?? "adult"
    }
    cursor += count
  }
  return "adult"
}

function updateTraveler(
  draft: Draft,
  setDraft: (next: Draft) => void,
  idx: number,
  patch: Partial<Draft["travelers"][number]>,
): void {
  setDraft(updateTravelerImmutable(draft, idx, patch))
}

/**
 * Patch one traveler row and return a new draft. Useful when the
 * caller wants to chain multiple draft updates (e.g. setting DOB +
 * rebanding) into a single setDraft call.
 */
function updateTravelerImmutable(
  draft: Draft,
  idx: number,
  patch: Partial<Draft["travelers"][number]>,
): Draft {
  const next = [...draft.travelers]
  if (!next[idx]) return draft
  next[idx] = { ...next[idx], ...patch }
  return setTravelers(draft, next)
}

/**
 * Move one traveler row from one band to another, keeping the pax
 * counters consistent. Used by the auto-reband path on DOB change.
 */
function rebandTraveler(draft: Draft, idx: number, fromBand: string, toBand: string): Draft {
  const fromCount = draft.configure.pax?.[fromBand] ?? 0
  const toCount = draft.configure.pax?.[toBand] ?? 0
  let next = updateTravelerImmutable(draft, idx, { band: toBand as never })
  next = patchPaxCount(next, fromBand, Math.max(0, fromCount - 1))
  next = patchPaxCount(next, toBand, toCount + 1)
  return next
}
