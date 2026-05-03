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
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@voyantjs/ui/components/radio-group"
import { Textarea } from "@voyantjs/ui/components/textarea"

import {
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <PaxBands draft={draft} setDraft={setDraft} shape={shape} />
        <DepartureFields draft={draft} setDraft={setDraft} shape={shape} />
      </CardContent>
    </Card>
  )
}

function PaxBands({ draft, setDraft, shape }: StepCommonProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <Label>Travelers</Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {shape.paxBands.map((band) => {
          const value = draft.configure.pax?.[band.code] ?? 0
          return (
            <div key={band.code} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{band.label}</div>
                {band.minAge != null || band.maxAge != null ? (
                  <div className="text-muted-foreground text-xs">
                    {ageHint(band.minAge, band.maxAge)}
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
  const total = totalPax(draft)
  const { min, max } = shape.paxBandsAllowedTotal
  if (total < min) {
    return (
      <p className="text-sm text-amber-600">
        Add at least {min} traveler{min === 1 ? "" : "s"} to continue.
      </p>
    )
  }
  if (total > max) {
    return <p className="text-sm text-destructive">Max {max} travelers per booking.</p>
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

function DepartureBasic({
  draft,
  setDraft,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="bj-departure-date">Departure date</Label>
        <Input
          id="bj-departure-date"
          type="date"
          value={draft.configure.departureDate ?? ""}
          onChange={(e) => setDraft(patchConfigure(draft, { departureDate: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bj-departure-time">Time (optional)</Label>
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
  const range = draft.configure.dateRange
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="bj-checkin">Check-in</Label>
        <Input
          id="bj-checkin"
          type="date"
          value={range?.checkIn ?? ""}
          onChange={(e) =>
            setDraft(
              patchConfigure(draft, {
                dateRange: { checkIn: e.target.value, checkOut: range?.checkOut ?? "" },
              }),
            )
          }
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bj-checkout">
          Check-out ({minNights}–{maxNights} nights)
        </Label>
        <Input
          id="bj-checkout"
          type="date"
          value={range?.checkOut ?? ""}
          onChange={(e) =>
            setDraft(
              patchConfigure(draft, {
                dateRange: { checkIn: range?.checkIn ?? "", checkOut: e.target.value },
              }),
            )
          }
        />
      </div>
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
  return (
    <div className="space-y-2">
      <Label>Cabin category</Label>
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
  const current = draft.configure.airArrangement
  const options: Array<{
    value: "cruise_line" | "independent" | "none"
    label: string
    description: string
  }> = [
    {
      value: "cruise_line",
      label: "Cruise-line-arranged flights",
      description:
        "The cruise line books your flights in a coordinated package. Operator follows up with the air desk.",
    },
    {
      value: "independent",
      label: "Independent flights",
      description: "Book flights yourself or via a separate flight booking line.",
    },
    {
      value: "none",
      label: "No flights needed",
      description: "Regional cruise / driving to the port.",
    },
  ]
  return (
    <div className="space-y-2">
      <Label>Air arrangements</Label>
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
  const catId = draft.configure.cabinCategoryId
  if (!catId) return null
  const cabins = perCategory[catId] ?? []
  return (
    <div className="space-y-2">
      <Label>Cabin number</Label>
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
        <CardTitle>Billing & lead contact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Buyer type</Label>
          <RadioGroup
            value={billing.buyerType}
            onValueChange={(v) => setDraft(patchBilling(draft, { buyerType: v as "B2C" | "B2B" }))}
            className="flex gap-4"
          >
            {/* RadioGroupItem from radix wires its own internal label association — biome can't see it */}
            {/* biome-ignore lint/a11y/noLabelWithoutControl: radix RadioGroupItem provides the control */}
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="B2C" /> Individual (B2C)
            </label>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: radix RadioGroupItem provides the control */}
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="B2B" /> Company (B2B)
            </label>
          </RadioGroup>
        </div>

        {renderLeadContactPicker ? <div>{renderLeadContactPicker({ apply })}</div> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            id="bj-billing-firstName"
            label="First name"
            value={billing.contact.firstName}
            onChange={(v) =>
              setDraft(patchBilling(draft, { contact: { ...billing.contact, firstName: v } }))
            }
          />
          <Field
            id="bj-billing-lastName"
            label="Last name"
            value={billing.contact.lastName}
            onChange={(v) =>
              setDraft(patchBilling(draft, { contact: { ...billing.contact, lastName: v } }))
            }
          />
          <Field
            id="bj-billing-email"
            label="Email"
            type="email"
            value={billing.contact.email}
            onChange={(v) =>
              setDraft(patchBilling(draft, { contact: { ...billing.contact, email: v } }))
            }
          />
          <Field
            id="bj-billing-phone"
            label="Phone"
            value={billing.contact.phone ?? ""}
            onChange={(v) =>
              setDraft(patchBilling(draft, { contact: { ...billing.contact, phone: v } }))
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            id="bj-billing-line1"
            label="Address"
            value={billing.address.line1 ?? ""}
            onChange={(v) =>
              setDraft(patchBilling(draft, { address: { ...billing.address, line1: v } }))
            }
          />
          <Field
            id="bj-billing-city"
            label="City"
            value={billing.address.city ?? ""}
            onChange={(v) =>
              setDraft(patchBilling(draft, { address: { ...billing.address, city: v } }))
            }
          />
          <Field
            id="bj-billing-postal"
            label="Postal code"
            value={billing.address.postal ?? ""}
            onChange={(v) =>
              setDraft(patchBilling(draft, { address: { ...billing.address, postal: v } }))
            }
          />
          <Field
            id="bj-billing-country"
            label="Country"
            value={billing.address.country ?? ""}
            placeholder="ISO 3166-1 alpha-2 (e.g. RO)"
            onChange={(v) =>
              setDraft(patchBilling(draft, { address: { ...billing.address, country: v } }))
            }
          />
        </div>

        {billing.buyerType === "B2B" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id="bj-billing-companyName"
              label="Company name"
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
              label="VAT id"
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
        <CardTitle>Travelers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ensured.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Pick traveler counts in the Configure step to start adding details.
          </p>
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
          return (
            <div key={traveler.rowId ?? idx} className="rounded border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  Traveler {idx + 1} ({traveler.band})
                </div>
                {renderTravelerContactPicker
                  ? renderTravelerContactPicker({ rowIndex: idx, apply })
                  : null}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  id={`bj-trav-${idx}-first`}
                  label="First name"
                  value={traveler.firstName}
                  onChange={(v) => updateTraveler(draft, setDraft, idx, { firstName: v })}
                />
                <Field
                  id={`bj-trav-${idx}-last`}
                  label="Last name"
                  value={traveler.lastName}
                  onChange={(v) => updateTraveler(draft, setDraft, idx, { lastName: v })}
                />
                {shape.travelerFields.some((f) => f.key === "email") ? (
                  <Field
                    id={`bj-trav-${idx}-email`}
                    label="Email"
                    type="email"
                    value={traveler.email ?? ""}
                    onChange={(v) => updateTraveler(draft, setDraft, idx, { email: v })}
                  />
                ) : null}
                {shape.travelerFields.some((f) => f.key === "dateOfBirth") ? (
                  <Field
                    id={`bj-trav-${idx}-dob`}
                    label="Date of birth"
                    type="date"
                    value={traveler.dateOfBirth ?? ""}
                    onChange={(v) => updateTraveler(draft, setDraft, idx, { dateOfBirth: v })}
                  />
                ) : null}
                {shape.travelerFields
                  .filter((f) => !["firstName", "lastName", "email", "dateOfBirth"].includes(f.key))
                  .map((field) => (
                    <Field
                      key={field.key}
                      id={`bj-trav-${idx}-${field.key}`}
                      label={field.label + (field.required ? " *" : "")}
                      type={field.type === "date" ? "date" : "text"}
                      value={(traveler.documents?.[field.key] as string | undefined) ?? ""}
                      onChange={(v) =>
                        updateTraveler(draft, setDraft, idx, {
                          documents: { ...traveler.documents, [field.key]: v },
                        })
                      }
                    />
                  ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ensureTravelerRows(
  draft: Draft,
  total: number,
  shape: BookingDraftShape,
): Draft["travelers"] {
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
  const next = [...draft.travelers]
  if (!next[idx]) return
  next[idx] = { ...next[idx], ...patch }
  setDraft(setTravelers(draft, next))
}

// ─────────────────────────────────────────────────────────────────
// Accommodation
// ─────────────────────────────────────────────────────────────────

export function AccommodationStep({ draft, setDraft, shape }: StepCommonProps): React.ReactElement {
  const subSteps = shape.accommodation?.subSteps ?? []
  const rooms = shape.accommodation?.roomOptions ?? []
  const accommodation = draft.accommodation ?? { rooms: [], travelerAssignments: {} }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accommodation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rooms.length === 0 && subSteps.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No accommodation options for this product.
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
                  {sub.options.length} extension option{sub.options.length === 1 ? "" : "s"}{" "}
                  available — UI lands in Phase F.
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
  return (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor={`bj-rate-plan-${roomId}`}>Rate plan</Label>
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
                  Cancellation: {plan.cancellationPolicy}
                </div>
              ) : null}
              {plan.inclusions && plan.inclusions.length > 0 ? (
                <div className="text-muted-foreground text-xs">
                  Includes: {plan.inclusions.join(", ")}
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
  const flat = shape.addons?.catalog ?? []
  const groups = shape.addons?.groups ?? []
  const all = [...flat, ...groups.flatMap((g) => g.items)]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add-ons</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {all.length === 0 ? (
          <p className="text-muted-foreground text-sm">No add-ons available for this product.</p>
        ) : null}
        {groups.map((group) => {
          // Group by port/day when the descriptor asks — cruise
          // excursions arrive grouped by port name.
          const buckets =
            group.groupBy === "port" || group.groupBy === "day"
              ? bucketBy(group.items, (i) => i.groupKey ?? "Other")
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
  const intents = shape.paymentIntents
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Payment intent</Label>
          <RadioGroup
            value={draft.payment.intent}
            onValueChange={(v) =>
              setDraft(setPayment(draft, { ...draft.payment, intent: v as never }))
            }
            className="flex flex-col gap-2"
          >
            {intents.map((intent) => (
              // biome-ignore lint/a11y/noLabelWithoutControl: radix RadioGroupItem provides the control
              <label key={intent} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={intent} /> {labelForIntent(intent)}
              </label>
            ))}
          </RadioGroup>
        </div>
        {renderProviderStep ? (
          <div>
            {renderProviderStep({
              intent: draft.payment.intent,
              schedule: draft.payment.schedule,
              capabilities,
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Payment provider not configured — booking will be placed on hold and a payment link will
            be sent separately.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function labelForIntent(intent: "hold" | "card" | "ticket_on_credit"): string {
  switch (intent) {
    case "hold":
      return "Hold (no payment)"
    case "card":
      return "Pay by card now"
    case "ticket_on_credit":
      return "Charge agency credit account"
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
}: {
  draft: Draft
  setDraft: (next: Draft) => void
  isCommitting: boolean
  onConfirm: () => void
  renderExtras?: () => React.ReactNode
}): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & confirm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="font-medium">Lead contact</div>
          <div className="text-muted-foreground text-sm">
            {draft.billing.contact.firstName} {draft.billing.contact.lastName} —{" "}
            {draft.billing.contact.email}
          </div>
        </div>
        <div>
          <div className="font-medium">Travelers</div>
          <ul className="text-muted-foreground text-sm">
            {draft.travelers.map((t, i) => (
              <li key={t.rowId ?? i}>
                {t.firstName} {t.lastName} ({t.band})
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1">
          <Label htmlFor="bj-internal-notes">Internal notes (operator-only)</Label>
          <Textarea
            id="bj-internal-notes"
            value={draft.internalNotes ?? ""}
            onChange={(e) => setDraft({ ...draft, internalNotes: e.target.value })}
          />
        </div>
        {renderExtras ? <div>{renderExtras()}</div> : null}
        <Button onClick={onConfirm} disabled={isCommitting}>
          {isCommitting ? "Confirming…" : "Confirm booking"}
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

function ageHint(min?: number, max?: number): string {
  if (min != null && max != null) return `${min}–${max}y`
  if (min != null) return `${min}y+`
  if (max != null) return `up to ${max}y`
  return ""
}

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
