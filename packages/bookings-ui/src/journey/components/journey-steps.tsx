"use client"

/**
 * Step components rendered inside `<BookingJourney />`. Each takes a
 * draft + setDraft pair plus the active descriptor; updates flow up
 * via setDraft and the shell re-quotes on the next debounce tick.
 *
 * Per booking-journey-architecture §3.
 */

import type { BookingDraftShape } from "@voyantjs/catalog/booking-engine"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { CountryCombobox } from "@voyantjs/ui/components/country-combobox"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { PhoneInput } from "@voyantjs/ui/components/phone-input"
import { RadioGroup, RadioGroupItem } from "@voyantjs/ui/components/radio-group"
import { Textarea } from "@voyantjs/ui/components/textarea"
import { Loader2 } from "lucide-react"
import { formatMessage, useBookingsUiMessagesOrDefault } from "../../i18n/index.js"
import {
  canCopyBillingContactToTraveler,
  type Draft,
  patchBilling,
  patchConfigure,
  patchPaxCount,
  setAccommodation,
  setAddons,
  setPayment,
  setTravelers,
  totalPax,
} from "../lib/draft-state.js"
import type {
  LeadContactPickerProps,
  PaymentProviderCapabilities,
  PaymentProviderStepRenderProps,
  TravelerContactPickerProps,
} from "../types.js"

interface StepCommonProps {
  draft: Draft
  setDraft: (next: Draft) => void
  shape: BookingDraftShape
}

// ─────────────────────────────────────────────────────────────────
// Configure
// ─────────────────────────────────────────────────────────────────

export function ConfigureStep({
  draft,
  setDraft,
  shape,
}: StepCommonProps & {
  renderExtras?: () => React.ReactNode
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.steps.configure}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <PaxBands draft={draft} setDraft={setDraft} shape={shape} />
        <DepartureFields draft={draft} setDraft={setDraft} shape={shape} />
      </CardContent>
    </Card>
  )
}

function PaxBands({ draft, setDraft, shape }: StepCommonProps): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <div className="space-y-3">
      <Label>{messages.bookingJourney.configure.travelers}</Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {shape.paxBands.map((band) => {
          const value = draft.configure.pax?.[band.code] ?? 0
          return (
            <div key={band.code} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{band.label}</div>
                {band.minAge != null || band.maxAge != null ? (
                  <div className="text-muted-foreground text-xs">
                    {ageHint(band.minAge, band.maxAge, messages)}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={value <= band.minCount}
                  onClick={() => setDraft(patchPaxCount(draft, band.code, value - 1))}
                >
                  −
                </Button>
                <span className="min-w-6 text-center">{value}</span>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={value >= band.maxCount}
                  onClick={() => setDraft(patchPaxCount(draft, band.code, value + 1))}
                >
                  +
                </Button>
              </div>
            </div>
          )
        })}
      </div>
      <PaxValidation draft={draft} shape={shape} />
    </div>
  )
}

function PaxValidation({
  draft,
  shape,
}: {
  draft: Draft
  shape: BookingDraftShape
}): React.ReactNode {
  const messages = useBookingsUiMessagesOrDefault()
  const total = totalPax(draft)
  const { min, max } = shape.paxBandsAllowedTotal
  if (total < min) {
    return (
      <p className="text-sm text-amber-600">
        {formatMessage(messages.bookingJourney.validation.addAtLeastTravelers, {
          count: min,
          plural: min === 1 ? "" : "s",
        })}
      </p>
    )
  }
  if (total > max) {
    return (
      <p className="text-sm text-destructive">
        {formatMessage(messages.bookingJourney.validation.maxTravelersPerBooking, {
          count: max,
        })}
      </p>
    )
  }
  return null
}

function DepartureFields({ draft, setDraft, shape }: StepCommonProps): React.ReactNode {
  const subSteps = shape.configureSubSteps ?? []
  // Render every sub-step kind the descriptor declares. Cruise
  // (cabin-category, cabin-number) lands here in Phase F.
  if (subSteps.length === 0) {
    return <DepartureBasic draft={draft} setDraft={setDraft} />
  }
  return (
    <div className="space-y-4">
      {subSteps.map((sub) => {
        // Sub-step kinds are unique per descriptor — kind serves as
        // a stable key.
        if (sub.kind === "departure") {
          return <DepartureBasic key="departure" draft={draft} setDraft={setDraft} />
        }
        if (sub.kind === "product-option") {
          return (
            <ProductOptionFields
              key="product-option"
              draft={draft}
              setDraft={setDraft}
              options={sub.options}
            />
          )
        }
        if (sub.kind === "date-range") {
          return (
            <DateRangeFields
              key="date-range"
              draft={draft}
              setDraft={setDraft}
              minNights={sub.minNights}
              maxNights={sub.maxNights}
            />
          )
        }
        if (sub.kind === "cabin-category") {
          return (
            <CabinCategoryFields
              key="cabin-category"
              draft={draft}
              setDraft={setDraft}
              categories={sub.categories}
            />
          )
        }
        if (sub.kind === "cabin-number") {
          return (
            <CabinNumberFields
              key="cabin-number"
              draft={draft}
              setDraft={setDraft}
              perCategory={sub.perCategory}
            />
          )
        }
        if (sub.kind === "air-arrangement") {
          return <AirArrangementFields key="air-arrangement" draft={draft} setDraft={setDraft} />
        }
        // "occupancy" — already rendered as PaxBands above; no sub-row.
        return null
      })}
    </div>
  )
}

function ProductOptionFields({
  draft,
  setDraft,
  options,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
  options: ReadonlyArray<{
    id: string
    code?: string | null
    name: string
    description?: string | null
    isDefault?: boolean
  }>
}): React.ReactElement | null {
  const messages = useBookingsUiMessagesOrDefault()
  const selectedId = draft.configure.variantId
  if (options.length === 0) return null
  return (
    <div className="space-y-2">
      <Label>{messages.bookingJourney.configure.option}</Label>
      <div className="grid grid-cols-1 gap-2">
        {options.map((option) => {
          const selected = option.id === selectedId
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setDraft(patchConfigure(draft, { variantId: option.id }))}
              className={`w-full rounded border p-3 text-left text-sm ${
                selected ? "border-primary ring-2 ring-primary" : ""
              }`}
            >
              <span className="font-medium">{option.name}</span>
              {option.code ? (
                <span className="ml-2 text-muted-foreground text-xs uppercase">{option.code}</span>
              ) : null}
              {option.description ? (
                <span className="mt-1 block text-muted-foreground text-xs">
                  {option.description}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DepartureBasic({
  draft,
  setDraft,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <DateField
        id="bj-departure-date"
        label={messages.bookingJourney.configure.departureDate}
        value={draft.configure.departureDate ?? ""}
        onChange={(v) => setDraft(patchConfigure(draft, { departureDate: v }))}
        range="future"
      />
      <div className="space-y-1">
        <Label htmlFor="bj-departure-time">{messages.bookingJourney.configure.timeOptional}</Label>
        <Input
          id="bj-departure-time"
          type="time"
          value={draft.configure.departureTime ?? ""}
          onChange={(e) => setDraft(patchConfigure(draft, { departureTime: e.target.value }))}
        />
      </div>
    </div>
  )
}

function DateRangeFields({
  draft,
  setDraft,
  minNights,
  maxNights,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
  minNights: number
  maxNights: number
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const range = draft.configure.dateRange
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <DateField
        id="bj-checkin"
        label={messages.bookingJourney.configure.checkIn}
        value={range?.checkIn ?? ""}
        onChange={(v) =>
          setDraft(
            patchConfigure(draft, {
              dateRange: { checkIn: v, checkOut: range?.checkOut ?? "" },
            }),
          )
        }
        range="future"
      />
      <DateField
        id="bj-checkout"
        label={formatMessage(messages.bookingJourney.configure.checkOutWithNights, {
          minNights,
          maxNights,
        })}
        value={range?.checkOut ?? ""}
        onChange={(v) =>
          setDraft(
            patchConfigure(draft, {
              dateRange: { checkIn: range?.checkIn ?? "", checkOut: v },
            }),
          )
        }
        range="future"
      />
    </div>
  )
}

function CabinCategoryFields({
  draft,
  setDraft,
  categories,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
  categories: ReadonlyArray<{ id: string; name: string; description?: string }>
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <div className="space-y-2">
      <Label>{messages.bookingJourney.configure.cabinCategory}</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {categories.map((cat) => {
          const selected = draft.configure.cabinCategoryId === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              className={`rounded border p-3 text-left ${
                selected ? "border-primary ring-2 ring-primary" : ""
              }`}
              onClick={() =>
                setDraft(
                  patchConfigure(draft, { cabinCategoryId: cat.id, cabinNumberId: undefined }),
                )
              }
            >
              <div className="font-medium">{cat.name}</div>
              {cat.description ? (
                <div className="text-muted-foreground text-xs">{cat.description}</div>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AirArrangementFields({
  draft,
  setDraft,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const current = draft.configure.airArrangement
  const options: Array<{
    value: "cruise_line" | "independent" | "none"
    label: string
    description: string
  }> = [
    {
      value: "cruise_line",
      label: messages.bookingJourney.configure.airOptions.cruise_line.label,
      description: messages.bookingJourney.configure.airOptions.cruise_line.description,
    },
    {
      value: "independent",
      label: messages.bookingJourney.configure.airOptions.independent.label,
      description: messages.bookingJourney.configure.airOptions.independent.description,
    },
    {
      value: "none",
      label: messages.bookingJourney.configure.airOptions.none.label,
      description: messages.bookingJourney.configure.airOptions.none.description,
    },
  ]
  return (
    <div className="space-y-2">
      <Label>{messages.bookingJourney.configure.airArrangements}</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const selected = current === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              className={`rounded border p-3 text-left text-sm ${
                selected ? "border-primary ring-2 ring-primary" : ""
              }`}
              onClick={() => setDraft(patchConfigure(draft, { airArrangement: opt.value }))}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-muted-foreground text-xs">{opt.description}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CabinNumberFields({
  draft,
  setDraft,
  perCategory,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
  perCategory: Record<string, ReadonlyArray<{ id: string; label: string }>>
}): React.ReactNode {
  const messages = useBookingsUiMessagesOrDefault()
  const catId = draft.configure.cabinCategoryId
  if (!catId) return null
  const cabins = perCategory[catId] ?? []
  return (
    <div className="space-y-2">
      <Label>{messages.bookingJourney.configure.cabinNumber}</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cabins.map((cabin) => {
          const selected = draft.configure.cabinNumberId === cabin.id
          return (
            <button
              key={cabin.id}
              type="button"
              className={`rounded border p-2 text-sm ${
                selected ? "border-primary ring-2 ring-primary" : ""
              }`}
              onClick={() => setDraft(patchConfigure(draft, { cabinNumberId: cabin.id }))}
            >
              {cabin.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Billing
// ─────────────────────────────────────────────────────────────────

export function BillingStep({
  draft,
  setDraft,
  renderLeadContactPicker,
  renderExtras,
}: StepCommonProps & {
  renderLeadContactPicker?: (props: LeadContactPickerProps) => React.ReactNode
  renderExtras?: () => React.ReactNode
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const billing = draft.billing
  const apply: LeadContactPickerProps["apply"] = (contact) => {
    setDraft(
      patchBilling(draft, {
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email ?? "",
          phone: contact.phone,
        },
      }),
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.billing.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{messages.bookingJourney.billing.buyerType}</Label>
          <RadioGroup
            value={billing.buyerType}
            onValueChange={(v) => setDraft(patchBilling(draft, { buyerType: v as "B2C" | "B2B" }))}
            className="flex gap-4"
          >
            {/* RadioGroupItem from radix wires its own internal label association — biome can't see it */}
            {/* biome-ignore lint/a11y/noLabelWithoutControl: radix RadioGroupItem provides the control */}
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="B2C" /> {messages.bookingJourney.billing.individual}
            </label>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: radix RadioGroupItem provides the control */}
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="B2B" /> {messages.bookingJourney.billing.company}
            </label>
          </RadioGroup>
        </div>

        {renderLeadContactPicker ? <div>{renderLeadContactPicker({ apply })}</div> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            id="bj-billing-firstName"
            label={messages.bookingJourney.billing.firstName}
            value={billing.contact.firstName}
            onChange={(v) =>
              setDraft(patchBilling(draft, { contact: { ...billing.contact, firstName: v } }))
            }
          />
          <Field
            id="bj-billing-lastName"
            label={messages.bookingJourney.billing.lastName}
            value={billing.contact.lastName}
            onChange={(v) =>
              setDraft(patchBilling(draft, { contact: { ...billing.contact, lastName: v } }))
            }
          />
          <Field
            id="bj-billing-email"
            label={messages.bookingJourney.billing.email}
            type="email"
            value={billing.contact.email}
            onChange={(v) =>
              setDraft(patchBilling(draft, { contact: { ...billing.contact, email: v } }))
            }
          />
          <PhoneField
            id="bj-billing-phone"
            label={messages.bookingJourney.billing.phone}
            value={billing.contact.phone ?? ""}
            onChange={(v) =>
              setDraft(patchBilling(draft, { contact: { ...billing.contact, phone: v } }))
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            id="bj-billing-line1"
            label={messages.bookingJourney.billing.addressLine1}
            value={billing.address.line1 ?? ""}
            onChange={(v) =>
              setDraft(patchBilling(draft, { address: { ...billing.address, line1: v } }))
            }
          />
          <Field
            id="bj-billing-line2"
            label={messages.bookingJourney.billing.addressLine2Optional}
            value={billing.address.line2 ?? ""}
            onChange={(v) =>
              setDraft(patchBilling(draft, { address: { ...billing.address, line2: v } }))
            }
          />
          <Field
            id="bj-billing-city"
            label={messages.bookingJourney.billing.city}
            value={billing.address.city ?? ""}
            onChange={(v) =>
              setDraft(patchBilling(draft, { address: { ...billing.address, city: v } }))
            }
          />
          <Field
            id="bj-billing-postal"
            label={messages.bookingJourney.billing.postalCode}
            value={billing.address.postal ?? ""}
            onChange={(v) =>
              setDraft(patchBilling(draft, { address: { ...billing.address, postal: v } }))
            }
          />
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="bj-billing-country">{messages.bookingJourney.billing.country}</Label>
            <CountryCombobox
              value={billing.address.country ?? null}
              onChange={(code) =>
                setDraft(
                  patchBilling(draft, {
                    address: { ...billing.address, country: code ?? "" },
                  }),
                )
              }
            />
          </div>
        </div>

        {billing.buyerType === "B2B" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id="bj-billing-companyName"
              label={messages.bookingJourney.billing.companyName}
              value={billing.company?.name ?? ""}
              onChange={(v) =>
                setDraft(
                  patchBilling(draft, {
                    company: { ...(billing.company ?? { name: "" }), name: v },
                  }),
                )
              }
            />
            <Field
              id="bj-billing-vatId"
              label={messages.bookingJourney.billing.vatId}
              value={billing.company?.vatId ?? ""}
              onChange={(v) =>
                setDraft(
                  patchBilling(draft, {
                    company: { ...(billing.company ?? { name: "" }), vatId: v },
                  }),
                )
              }
            />
          </div>
        ) : null}

        {renderExtras ? <div>{renderExtras()}</div> : null}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────
// Travelers
// ─────────────────────────────────────────────────────────────────

export function TravelersStep({
  draft,
  setDraft,
  shape,
  renderTravelerContactPicker,
}: StepCommonProps & {
  renderTravelerContactPicker?: (props: TravelerContactPickerProps) => React.ReactNode
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
  // Bands are bookkeeping for the pricing engine — the user only
  // sees a flat list of travelers. Adding a traveler bumps the
  // adult-band counter by default; the row's band is reassigned
  // automatically once a DOB is entered (see TravelerCard's onDob).
  const defaultAddBand = shape.paxBands.find((b) => b.code === "adult") ?? shape.paxBands[0]
  const totalCap = shape.paxBandsAllowedTotal.max
  const canAddMore = ensured.length < totalCap && Boolean(defaultAddBand)
  const removeTraveler = (rowIdx: number) => {
    const band = ensured[rowIdx]?.band
    if (!band) return
    const current = draft.configure.pax?.[band] ?? 0
    const spec = shape.paxBands.find((b) => b.code === band)
    if (spec && current <= spec.minCount) return
    setDraft(patchPaxCount(draft, band, current - 1))
  }
  const addTraveler = () => {
    if (!defaultAddBand) return
    const current = draft.configure.pax?.[defaultAddBand.code] ?? 0
    if (current >= defaultAddBand.maxCount) return
    setDraft(patchPaxCount(draft, defaultAddBand.code, current + 1))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.travelers.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ensured.length === 0 ? (
          <p className="text-muted-foreground text-sm">{messages.bookingJourney.travelers.empty}</p>
        ) : null}
        {ensured.map((traveler, idx) => {
          const apply: TravelerContactPickerProps["apply"] = (contact) => {
            const next = [...ensured]
            next[idx] = {
              ...next[idx]!,
              firstName: contact.firstName,
              lastName: contact.lastName,
              email: contact.email,
              phone: contact.phone,
            }
            setDraft(setTravelers(draft, next))
          }
          const bandSpec = shape.paxBands.find((b) => b.code === traveler.band)
          const currentBandCount = draft.configure.pax?.[traveler.band] ?? 0
          const canRemove = !bandSpec || currentBandCount > bandSpec.minCount
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
              onRemove={canRemove ? () => removeTraveler(idx) : undefined}
            />
          )
        })}
        {canAddMore ? (
          <div className="border-t pt-3">
            <Button type="button" variant="outline" size="sm" onClick={addTraveler}>
              {messages.bookingJourney.travelers.addTraveler}
            </Button>
          </div>
        ) : null}
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
    })
  }

  return (
    <div className="rounded border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="font-medium">
            {formatMessage(messages.bookingJourney.travelers.travelerNumber, {
              number: idx + 1,
            })}
            {computedAge != null ? (
              <span className="text-muted-foreground font-normal">
                {" "}
                ·{" "}
                {formatMessage(messages.bookingJourney.travelers.ageLabel, {
                  age: computedAge,
                })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canCopyFromBilling ? (
            <Button type="button" variant="outline" size="sm" onClick={copyFromBilling}>
              {messages.bookingJourney.travelers.copyFromBilling}
            </Button>
          ) : null}
          {renderTravelerContactPicker
            ? renderTravelerContactPicker({ rowIndex: idx, apply })
            : null}
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              {messages.bookingJourney.travelers.remove}
            </Button>
          ) : null}
        </div>
      </div>
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

// ─────────────────────────────────────────────────────────────────
// Accommodation
// ─────────────────────────────────────────────────────────────────

export function AccommodationStep({ draft, setDraft, shape }: StepCommonProps): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const subSteps = shape.accommodation?.subSteps ?? []
  const rooms = shape.accommodation?.roomOptions ?? []
  const accommodation = draft.accommodation ?? { rooms: [], travelerAssignments: {} }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.accommodation.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rooms.length === 0 && subSteps.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {messages.bookingJourney.accommodation.empty}
          </p>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => {
              const current = accommodation.rooms.find((r) => r.optionUnitId === room.id)
              const ratePlans = room.ratePlans ?? []
              return (
                <div key={room.id} className="space-y-3 rounded border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{room.name}</div>
                      {room.description ? (
                        <div className="text-muted-foreground text-xs">{room.description}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          const list = accommodation.rooms.filter((r) => r.optionUnitId !== room.id)
                          const qty = (current?.quantity ?? 0) - 1
                          if (qty > 0) {
                            list.push({
                              optionUnitId: room.id,
                              quantity: qty,
                              ratePlanId: current?.ratePlanId,
                            })
                          }
                          setDraft(setAccommodation(draft, { ...accommodation, rooms: list }))
                        }}
                      >
                        −
                      </Button>
                      <span className="min-w-6 text-center">{current?.quantity ?? 0}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          const list = accommodation.rooms.filter((r) => r.optionUnitId !== room.id)
                          const qty = (current?.quantity ?? 0) + 1
                          // Auto-select the only rate plan when there's
                          // exactly one — saves a click on the common case.
                          const ratePlanId =
                            current?.ratePlanId ??
                            (ratePlans.length === 1 ? ratePlans[0]?.id : undefined)
                          list.push({ optionUnitId: room.id, quantity: qty, ratePlanId })
                          setDraft(setAccommodation(draft, { ...accommodation, rooms: list }))
                        }}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  {current && current.quantity > 0 && ratePlans.length > 0 ? (
                    <RatePlanPicker
                      roomId={room.id}
                      ratePlans={ratePlans}
                      selected={current.ratePlanId}
                      onSelect={(planId) => {
                        const list = accommodation.rooms.map((r) =>
                          r.optionUnitId === room.id ? { ...r, ratePlanId: planId } : r,
                        )
                        setDraft(setAccommodation(draft, { ...accommodation, rooms: list }))
                      }}
                    />
                  ) : null}
                </div>
              )
            })}
            {subSteps.map((sub) =>
              sub.kind === "extensions" ? (
                <div key="extensions" className="rounded border p-3 text-muted-foreground text-sm">
                  {formatMessage(messages.bookingJourney.accommodation.extensionsAvailable, {
                    count: sub.options.length,
                    plural: sub.options.length === 1 ? "" : "s",
                  })}
                </div>
              ) : null,
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RatePlanPicker({
  roomId,
  ratePlans,
  selected,
  onSelect,
}: {
  roomId: string
  ratePlans: ReadonlyArray<{
    id: string
    name: string
    description?: string | null
    chargeFrequency?: "per_night" | "per_stay"
    cancellationPolicy?: string | null
    inclusions?: ReadonlyArray<string>
  }>
  selected?: string
  onSelect: (id: string) => void
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor={`bj-rate-plan-${roomId}`}>
        {messages.bookingJourney.accommodation.ratePlan}
      </Label>
      <div className="space-y-2">
        {ratePlans.map((plan) => {
          const isSelected = plan.id === selected
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={`w-full rounded border p-2 text-left text-sm ${
                isSelected ? "border-primary ring-2 ring-primary" : ""
              }`}
            >
              <div className="font-medium">{plan.name}</div>
              {plan.description ? (
                <div className="text-muted-foreground text-xs">{plan.description}</div>
              ) : null}
              {plan.cancellationPolicy ? (
                <div className="text-muted-foreground text-xs">
                  {messages.bookingJourney.accommodation.cancellationPrefix}{" "}
                  {plan.cancellationPolicy}
                </div>
              ) : null}
              {plan.inclusions && plan.inclusions.length > 0 ? (
                <div className="text-muted-foreground text-xs">
                  {messages.bookingJourney.accommodation.includesPrefix}{" "}
                  {plan.inclusions.join(", ")}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Add-ons
// ─────────────────────────────────────────────────────────────────

export function AddonsStep({ draft, setDraft, shape }: StepCommonProps): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const flat = shape.addons?.catalog ?? []
  const groups = shape.addons?.groups ?? []
  const all = [...flat, ...groups.flatMap((g) => g.items)]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.addons.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {all.length === 0 ? (
          <p className="text-muted-foreground text-sm">{messages.bookingJourney.addons.empty}</p>
        ) : null}
        {groups.map((group) => {
          // Group by port/day when the descriptor asks — cruise
          // excursions arrive grouped by port name.
          const buckets =
            group.groupBy === "port" || group.groupBy === "day"
              ? bucketBy(
                  group.items,
                  (i) => i.groupKey ?? messages.bookingJourney.addons.otherBucket,
                )
              : new Map([["", group.items as ReadonlyArray<(typeof group.items)[number]>]])
          return (
            <div key={group.label} className="space-y-3">
              <div className="font-medium text-sm">{group.label}</div>
              {[...buckets.entries()].map(([bucket, items]) => (
                <div key={bucket || "all"} className="space-y-2">
                  {bucket ? (
                    <div className="text-muted-foreground text-xs uppercase">{bucket}</div>
                  ) : null}
                  {items.map((item) => (
                    <AddonRow key={item.id} draft={draft} setDraft={setDraft} item={item} />
                  ))}
                </div>
              ))}
            </div>
          )
        })}
        {flat.length > 0 && groups.length === 0 ? (
          <div className="space-y-2">
            {flat.map((item) => (
              <AddonRow key={item.id} draft={draft} setDraft={setDraft} item={item} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AddonRow({
  draft,
  setDraft,
  item,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
  item: { id: string; name: string; description?: string | null }
}): React.ReactElement {
  const current = draft.addons.find((a) => a.extraId === item.id)
  return (
    <div className="flex items-center justify-between rounded border p-3">
      <div>
        <div className="font-medium">{item.name}</div>
        {item.description ? (
          <div className="text-muted-foreground text-xs">{item.description}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => {
            const list = draft.addons.filter((a) => a.extraId !== item.id)
            const qty = (current?.quantity ?? 0) - 1
            if (qty > 0) list.push({ extraId: item.id, quantity: qty })
            setDraft(setAddons(draft, list))
          }}
        >
          −
        </Button>
        <span className="min-w-6 text-center">{current?.quantity ?? 0}</span>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => {
            const list = draft.addons.filter((a) => a.extraId !== item.id)
            const qty = (current?.quantity ?? 0) + 1
            list.push({ extraId: item.id, quantity: qty })
            setDraft(setAddons(draft, list))
          }}
        >
          +
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Payment
// ─────────────────────────────────────────────────────────────────

export function PaymentStep({
  draft,
  setDraft,
  shape,
  capabilities,
  renderProviderStep,
}: StepCommonProps & {
  capabilities: PaymentProviderCapabilities
  renderProviderStep?: (props: PaymentProviderStepRenderProps) => React.ReactNode
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  // The descriptor lists what the *engine* supports; capabilities
  // narrow further to what the *deployment* turned on. Both must
  // accept an intent for the user to see it.
  const allowed = shape.paymentIntents.filter((i) => isCapabilityEnabled(i, capabilities))
  const intent = draft.payment.intent

  // Snap the draft's intent to the first allowed value when the
  // current pick isn't on the list — covers descriptor changes
  // mid-flow (e.g. owned→sourced switch narrows the list).
  if (allowed.length > 0 && !allowed.includes(intent)) {
    setDraft(setPayment(draft, { ...draft.payment, intent: allowed[0] as never }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.payment.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {allowed.length === 0 ? (
          <p className="text-muted-foreground text-sm">{messages.bookingJourney.payment.empty}</p>
        ) : (
          <RadioGroup
            value={intent}
            onValueChange={(v) =>
              setDraft(setPayment(draft, { ...draft.payment, intent: v as never }))
            }
            className="grid grid-cols-1 gap-2"
          >
            {allowed.map((i) => {
              const meta = intentMeta(i, messages)
              const selected = i === intent
              return (
                // biome-ignore lint/a11y/noLabelWithoutControl: RadioGroupItem provides the control
                <label
                  key={i}
                  className={
                    "flex cursor-pointer items-start gap-3 rounded border p-3 text-sm transition-colors " +
                    (selected ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50")
                  }
                >
                  <RadioGroupItem value={i} className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-medium">{meta.label}</div>
                    <div className="text-muted-foreground text-xs">{meta.description}</div>
                  </div>
                </label>
              )
            })}
          </RadioGroup>
        )}

        {intent === "card" ? (
          renderProviderStep ? (
            <div>
              {renderProviderStep({
                intent,
                schedule: draft.payment.schedule,
                capabilities,
              })}
            </div>
          ) : (
            // Most deployments use a redirect-style PSP (Netopia / Stripe
            // Checkout / etc) where the journey hands off to a hosted
            // payment page after the customer accepts the contract. Inline
            // card collection is opt-in via `renderPaymentProviderStep`.
            <p className="text-muted-foreground text-sm">
              {messages.bookingJourney.payment.redirectedAfterConfirm}
            </p>
          )
        ) : null}

        {intent === "bank_transfer" ? <BankTransferDetails capabilities={capabilities} /> : null}

        {intent === "inquiry" ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            {messages.bookingJourney.payment.inquiryNotice}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function BankTransferDetails({
  capabilities,
}: {
  capabilities: PaymentProviderCapabilities
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const note = capabilities.config?.bankTransferNote
  return (
    <div className="rounded border bg-muted/30 p-3 text-sm">
      <p className="font-medium">{messages.bookingJourney.payment.bankTransferInstructions}</p>
      <p className="text-muted-foreground text-xs">
        {typeof note === "string" && note.length > 0
          ? note
          : messages.bookingJourney.payment.bankTransferDefaultNote}
      </p>
    </div>
  )
}

function isCapabilityEnabled(
  intent: "hold" | "card" | "bank_transfer" | "ticket_on_credit" | "inquiry",
  capabilities: PaymentProviderCapabilities,
): boolean {
  switch (intent) {
    case "card":
      return capabilities.acceptsCard
    case "hold":
      return capabilities.acceptsHold
    case "bank_transfer":
      return capabilities.acceptsBankTransfer === true
    case "ticket_on_credit":
      return capabilities.acceptsTicketOnCredit
    case "inquiry":
      return capabilities.acceptsInquiry === true
  }
}

function intentMeta(
  intent: "hold" | "card" | "bank_transfer" | "ticket_on_credit" | "inquiry",
  messages: ReturnType<typeof useBookingsUiMessagesOrDefault>,
): {
  label: string
  description: string
} {
  return {
    label: messages.bookingJourney.payment.intentLabels[intent],
    description: messages.bookingJourney.payment.intentDescriptions[intent],
  }
}

// ─────────────────────────────────────────────────────────────────
// Review
// ─────────────────────────────────────────────────────────────────

export function ReviewStep({
  draft,
  setDraft,
  isCommitting,
  onConfirm,
  renderExtras,
  surface,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
  isCommitting: boolean
  onConfirm: () => void
  renderExtras?: () => React.ReactNode
  /**
   * Drives the notes field. Public storefronts collect
   * customer-facing "anything we should know?" notes; operator
   * surfaces collect operator-only internal notes. Defaults to
   * `admin` so existing operator usage stays unchanged.
   */
  surface?: "admin" | "public"
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const isPublic = surface === "public"
  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.review.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="font-medium">{messages.bookingJourney.review.leadContact}</div>
          <div className="text-muted-foreground text-sm">
            {draft.billing.contact.firstName} {draft.billing.contact.lastName} ·{" "}
            {draft.billing.contact.email}
          </div>
        </div>
        <div>
          <div className="font-medium">{messages.bookingJourney.review.travelers}</div>
          <ul className="text-muted-foreground text-sm">
            {draft.travelers.map((t, i) => (
              <li key={t.rowId ?? i}>
                {t.firstName} {t.lastName} ({t.band})
              </li>
            ))}
          </ul>
        </div>
        {isPublic ? (
          <div className="space-y-1">
            <Label htmlFor="bj-customer-notes">
              {messages.bookingJourney.review.customerNotes}
            </Label>
            <Textarea
              id="bj-customer-notes"
              placeholder={messages.bookingJourney.review.customerNotesPlaceholder}
              value={draft.customerNotes ?? ""}
              onChange={(e) => setDraft({ ...draft, customerNotes: e.target.value })}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="bj-internal-notes">
              {messages.bookingJourney.review.internalNotes}
            </Label>
            <Textarea
              id="bj-internal-notes"
              value={draft.internalNotes ?? ""}
              onChange={(e) => setDraft({ ...draft, internalNotes: e.target.value })}
            />
          </div>
        )}
        {renderExtras ? <div>{renderExtras()}</div> : null}
        <Button onClick={onConfirm} disabled={isCommitting}>
          {isCommitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {messages.bookingJourney.review.confirming}
            </>
          ) : (
            messages.bookingJourney.review.confirmBooking
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function Field({
  id,
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type ?? "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function PhoneField({
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
 * `@voyantjs/ui` with a month + year dropdown caption so users can
 * jump across decades without arrow-clicking. The `range` hint picks
 * a reasonable startMonth/endMonth window per use case:
 *
 *   - `"past"`     — DOB-style picks (today back ~120 years)
 *   - `"future"`   — departure / check-in / check-out (today forward ~5 years)
 *   - `"document"` — passport / ID expiry (today forward ~20 years)
 */
function DateField({
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

function SelectField({
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
      <select
        id={id}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{messages.bookingJourney.values.selectPlaceholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Years between an ISO date-of-birth and today. Returns `null` for
 * unparseable input or future dates so the UI can hide the badge
 * gracefully rather than rendering "age -3".
 */
function computeAge(dob: string): number | null {
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age >= 0 ? age : null
}

function ageHint(
  min: number | undefined,
  max: number | undefined,
  messages: ReturnType<typeof useBookingsUiMessagesOrDefault>,
): string {
  if (min != null && max != null) {
    return formatMessage(messages.bookingJourney.configure.ageHintRange, { min, max })
  }
  if (min != null) {
    return formatMessage(messages.bookingJourney.configure.ageHintMinimum, { min })
  }
  if (max != null) {
    return formatMessage(messages.bookingJourney.configure.ageHintMaximum, { max })
  }
  return ""
}

// i18n-literal-ok Generic helper type signature, not user-visible copy.
function bucketBy<T>(items: ReadonlyArray<T>, keyFn: (item: T) => string): Map<string, T[]> {
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

function cryptoRowId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `r_${Math.random().toString(36).slice(2, 10)}`
}
