"use client"

import { useQueries } from "@tanstack/react-query"
import { useSlots, useSlotUnitAvailability } from "@voyantjs/availability-react"
import {
  type BookingCreateExtraLineInput,
  type BookingCreateGroupMembershipInput,
  type BookingCreatePaymentScheduleInput,
  type BookingCreateTravelerInput,
  type BookingCreateVoucherRedemptionInput,
  type BookingRecord,
  useBookingCreateMutation,
  useBookingTaxPreview,
} from "@voyantjs/bookings-react"
import { useOrganization, usePerson } from "@voyantjs/crm-react"
import { type ProductExtraRecord, useProductExtras } from "@voyantjs/extras-react"
import { useAddresses } from "@voyantjs/identity-react"
import { getExtraPriceRulesQueryOptions, useVoyantPricingContext } from "@voyantjs/pricing-react"
import { useProduct, useProductMedia } from "@voyantjs/products-react"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@voyantjs/ui/components"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import { ImageIcon, Loader2 } from "lucide-react"
import * as React from "react"

import {
  formatMessage,
  useBookingsUiI18nOrDefault,
  useBookingsUiMessagesOrDefault,
} from "../i18n/provider.js"
import {
  getBookableDepartureSlots,
  getSelectedSharedRoomUnitId,
  isRealBookingEmail,
  itemLinesToRows,
  validateBillingPersonContact,
} from "./booking-create-utils.js"
import {
  emptyOptionUnitsStepperValue,
  OptionUnitsStepperSection,
  type OptionUnitsStepperUnit,
  type OptionUnitsStepperValue,
} from "./option-units-stepper-section.js"
import {
  emptyPaymentScheduleValue,
  PaymentScheduleSection,
  type PaymentScheduleValue,
} from "./payment-schedule-section.js"
import {
  emptyPersonPickerValue,
  PersonPickerSection,
  type PersonPickerValue,
} from "./person-picker-section.js"
import { PriceBreakdownSection, type PriceBreakdownValue } from "./price-breakdown-section.js"
import { ProductPickerSection, type ProductPickerValue } from "./product-picker-section.js"
import {
  emptySharedRoomValue,
  SharedRoomSection,
  type SharedRoomValue,
} from "./shared-room-section.js"
import {
  computeAgeYears,
  emptyTravelerListValue,
  type RoomGroup,
  type RoomUnitOption,
  type TravelerEntry,
  type TravelerListValue,
  TravelersSection,
} from "./travelers-section.js"
import {
  emptyVoucherPickerValue,
  VoucherPickerSection,
  type VoucherPickerValue,
} from "./voucher-picker-section.js"

function generateBookingNumber(): string {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `BK-${y}${m}-${seq}`
}

function paymentScheduleToRows(
  value: PaymentScheduleValue,
  currency: string,
  totalAmountCents: number | null,
): BookingCreatePaymentScheduleInput[] {
  if (value.mode === "full") {
    if (!value.fullDueDate || totalAmountCents === null) return []
    return [
      {
        scheduleType: "balance",
        status: value.fullAlreadyPaid ? "paid" : "due",
        dueDate: value.fullDueDate,
        currency,
        amountCents: totalAmountCents,
        notes: paidScheduleNotes(
          value.fullAlreadyPaid,
          value.fullPaymentDate,
          value.fullPaymentMethod,
          value.fullPaymentReference,
        ),
      },
    ]
  }

  // split
  const rows: BookingCreatePaymentScheduleInput[] = []
  if (value.splitFirstDueDate && value.splitFirstAmountCents != null) {
    rows.push({
      scheduleType: "installment",
      status: value.splitFirstAlreadyPaid ? "paid" : "due",
      dueDate: value.splitFirstDueDate,
      currency,
      amountCents: value.splitFirstAmountCents,
      notes: paidScheduleNotes(
        value.splitFirstAlreadyPaid,
        value.splitFirstPaymentDate,
        value.splitFirstPaymentMethod,
        value.splitFirstPaymentReference,
      ),
    })
  }
  if (value.splitSecondDueDate && value.splitSecondAmountCents != null) {
    rows.push({
      scheduleType: "installment",
      status: value.splitSecondAlreadyPaid ? "paid" : "pending",
      dueDate: value.splitSecondDueDate,
      currency,
      amountCents: value.splitSecondAmountCents,
      notes: paidScheduleNotes(
        value.splitSecondAlreadyPaid,
        value.splitSecondPaymentDate,
        value.splitSecondPaymentMethod,
        value.splitSecondPaymentReference,
      ),
    })
  }
  return rows
}

function paidScheduleNotes(
  alreadyPaid: boolean,
  paymentDate: string | null,
  paymentMethod: string,
  paymentReference: string,
) {
  if (!alreadyPaid) return null
  return JSON.stringify({
    alreadyPaid: true,
    paymentDate,
    paymentMethod,
    paymentReference: paymentReference.trim() || null,
  })
}

/**
 * Pick the option-unit that matches a given age. Falls back to an
 * ADULT-coded unit when no min/max window matches, then to the first
 * unit in the option. When `age` is null (no DOB), prefer ADULT.
 */
/**
 * The catalog stepper builds unit names like "Standard double - Adult"
 * when an option has multiple units. The Room dropdown wants the bare
 * option name ("Standard double"), so we trim off the trailing
 * "- <unit>" suffix for display.
 */
function stripUnitSuffix(name: string): string {
  const idx = name.lastIndexOf(" - ")
  return idx > 0 ? name.slice(0, idx) : name
}

function isRoomUnit(unit: {
  optionUnitId: string
  unitType?: OptionUnitsStepperUnit["unitType"]
}): boolean {
  return unit.unitType === "room"
}

/**
 * Any payment-schedule entry the operator has marked as already
 * paid. Drives the smart-default booking status on submit — if money
 * is in (deposit / full / split installment), the booking lands in
 * `confirmed`; otherwise it lands in `awaiting_payment`.
 */
function hasAnyPaidPayment(schedule: PaymentScheduleValue): boolean {
  switch (schedule.mode) {
    case "full":
      return schedule.fullAlreadyPaid
    case "split":
      return schedule.splitFirstAlreadyPaid || schedule.splitSecondAlreadyPaid
    default:
      return false
  }
}

/**
 * Inverse of stripUnitSuffix — strip the leading "Option name - " so
 * the per-unit label stands alone for category buttons.
 */
function stripOptionPrefix(name: string): string {
  const idx = name.indexOf(" - ")
  return idx > 0 ? name.slice(idx + 3) : name
}

/**
 * Pick the unit for a traveler. Priorities:
 *   1. If we have an age (from DOB) and it falls into a unit's
 *      `[minAge, maxAge]` window, use that unit.
 *   2. Otherwise honor an explicit role hint (Child / Infant / Adult
 *      buttons) by matching unit code or name.
 *   3. Fall back to the ADULT-coded unit, or the first unit when
 *      nothing else matches.
 *
 * `roleHint` covers the common case where the operator knows the
 * traveler is a child but doesn't have the exact DOB. Without it, a
 * roleless traveler would silently default to Adult pricing.
 */
function pickUnitForAge(
  units: OptionUnitsStepperUnit[],
  age: number | null,
  roleHint: "adult" | "child" | "infant" | null = null,
): OptionUnitsStepperUnit | undefined {
  if (units.length === 0) return undefined
  const findByCode = (code: string) =>
    units.find((u) => (u.unitCode ?? "").toUpperCase() === code) ??
    units.find((u) => new RegExp(`\\b${code}\\b`, "i").test(u.unitName))
  const adult = findByCode("ADULT")
  if (age != null) {
    const match = units.find(
      (u) => (u.minAge == null || age >= u.minAge) && (u.maxAge == null || age <= u.maxAge),
    )
    if (match) return match
  }
  if (roleHint === "child") return findByCode("CHILD") ?? adult ?? units[0]
  if (roleHint === "infant") return findByCode("INFANT") ?? adult ?? units[0]
  return adult ?? units[0]
}

/**
 * Take the operator-picked per-option quantities (which are tracked
 * against each option's primary "Adult" unit by the stepper) plus the
 * travelers list, and redistribute both so that:
 *   - each traveler's `roomUnitId` points at the age-banded unit
 *     matching their DOB (Adult / Child / Infant / etc.)
 *   - `quantities` reflects the per-unit counts after redistribution —
 *     a 3-pax "Standard double" with 2 adults + 1 child becomes
 *     `{ adultUnit: 2, childUnit: 1 }` instead of `{ adultUnit: 3 }`.
 *
 * Slots without a configured `dateOfBirth` keep the option's adult
 * default so partially-filled bookings still typecheck.
 */
/**
 * Rebuild stepper quantities from per-traveler unit assignments.
 *
 * Each traveler's `roomUnitId` is now the operator's explicit choice
 * (DOB-pre-picked at attach, overridable via the dynamic category
 * buttons), so we count assignments directly and add any per-option
 * residual on the adult/primary unit when the stepper qty exceeds the
 * number of travelers actually assigned. Unlike the older
 * DOB-driven rewrite, this never moves a traveler off their chosen
 * unit — operator selection always wins.
 */
function redistributeByAge(
  quantities: Record<string, number>,
  travelers: TravelerEntry[],
  units: OptionUnitsStepperUnit[],
): { quantities: Record<string, number>; travelers: TravelerEntry[] } {
  if (units.length === 0) return { quantities, travelers }

  const unitsByOption = new Map<string, OptionUnitsStepperUnit[]>()
  for (const unit of units) {
    if (!unit.optionId) continue
    const list = unitsByOption.get(unit.optionId)
    if (list) list.push(unit)
    else unitsByOption.set(unit.optionId, [unit])
  }

  const unitToOption = new Map(units.map((u) => [u.optionUnitId, u.optionId]))

  // Per-option total from the stepper. This is the count the operator
  // committed to when picking rooms.
  const totalByOption = new Map<string, number>()
  for (const [unitId, qty] of Object.entries(quantities)) {
    if (qty <= 0) continue
    const optionId = unitToOption.get(unitId)
    if (!optionId) continue
    totalByOption.set(optionId, (totalByOption.get(optionId) ?? 0) + qty)
  }

  // Count actual traveler assignments per unit + per option.
  const next: Record<string, number> = {}
  const assignedByOption = new Map<string, number>()
  for (const t of travelers) {
    if (!t.roomUnitId) continue
    const optionId = unitToOption.get(t.roomUnitId)
    if (!optionId) continue
    next[t.roomUnitId] = (next[t.roomUnitId] ?? 0) + 1
    assignedByOption.set(optionId, (assignedByOption.get(optionId) ?? 0) + 1)
  }

  // Residual = operator picked N rooms but only added M travelers; put
  // the leftover on the option's adult/primary unit so the price total
  // matches the stepper.
  for (const [optionId, total] of totalByOption) {
    const assigned = assignedByOption.get(optionId) ?? 0
    const residual = Math.max(0, total - assigned)
    if (residual === 0) continue
    const adult = pickUnitForAge(unitsByOption.get(optionId) ?? [], null)
    if (!adult) continue
    next[adult.optionUnitId] = (next[adult.optionUnitId] ?? 0) + residual
  }

  return { quantities: next, travelers }
}

function travelersToRows(value: TravelerListValue): BookingCreateTravelerInput[] {
  return value.travelers.map((traveler) => {
    // Age-derived category (DOB-driven). The `role` field still
    // carries the `lead` flag separately for the booking primary; the
    // demographic category comes from age, not from a manual select.
    const age = computeAgeYears(traveler.dateOfBirth)
    const ageCategory: "adult" | "child" | "infant" | null =
      age == null
        ? traveler.role === "child" || traveler.role === "infant" || traveler.role === "adult"
          ? traveler.role
          : null
        : age < 2
          ? "infant"
          : age < 18
            ? "child"
            : "adult"
    return {
      personId: traveler.personId,
      firstName: traveler.firstName.trim(),
      lastName: traveler.lastName.trim(),
      email: traveler.email.trim() || null,
      phone: traveler.phone.trim() || null,
      preferredLanguage: traveler.preferredLanguage.trim() || null,
      participantType: "traveler",
      travelerCategory: ageCategory,
      isPrimary: traveler.role === "lead",
      roomUnitId: traveler.roomUnitId,
    }
  })
}

function sameRoomUnits(left: OptionUnitsStepperUnit[], right: OptionUnitsStepperUnit[]): boolean {
  if (left.length !== right.length) return false
  return left.every((unit, index) => {
    const other = right[index]
    return (
      other !== undefined &&
      unit.optionId === other.optionId &&
      unit.optionUnitId === other.optionUnitId &&
      unit.unitName === other.unitName &&
      unit.occupancyMax === other.occupancyMax &&
      unit.remaining === other.remaining
    )
  })
}

export interface BookingCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (booking: BookingRecord) => void
  /** When provided, pre-selects this product and hides the product picker. */
  defaultProductId?: string
}

export interface BookingCreateFormProps {
  onCreated?: (booking: BookingRecord) => void
  /** When provided, pre-selects this product and hides the product picker. */
  defaultProductId?: string
  /** Gates data fetching and resets transient form state when false. */
  enabled?: boolean
  onCancel?: () => void
}

/**
 * Operator booking-create dialog. Composes the booking-create picker
 * sections — product, departure, rooms, person, shared-room, travelers,
 * price breakdown, voucher, payment schedule — and submits via the atomic
 * `POST /v1/bookings/create` endpoint so partial failures can't
 * leave orphan state.
 *
 * Normally consumed via `BookingDialog` which delegates here when no
 * `booking` prop is passed. Apps that need a bespoke flow can install the
 * sections individually and assemble their own dialog instead of forking.
 */
export function BookingCreateDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProductId,
}: BookingCreateDialogProps) {
  const messages = useBookingsUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{messages.bookingCreateDialog.title}</DialogTitle>
        </DialogHeader>
        <BookingCreateForm
          enabled={open}
          defaultProductId={defaultProductId}
          onCancel={() => onOpenChange(false)}
          onCreated={(booking) => {
            onOpenChange(false)
            onCreated?.(booking)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

export function BookingCreateForm({
  onCreated,
  defaultProductId,
  enabled = true,
  onCancel,
}: BookingCreateFormProps) {
  const [product, setProduct] = React.useState<ProductPickerValue>({
    productId: defaultProductId ?? "",
    optionId: null,
  })
  const [slotId, setSlotId] = React.useState<string | null>(null)
  const [rooms, setRooms] = React.useState<OptionUnitsStepperValue>(emptyOptionUnitsStepperValue)
  const [roomUnits, setRoomUnits] = React.useState<OptionUnitsStepperUnit[]>([])
  const [extraLines, setExtraLines] = React.useState<BookingCreateExtraLineInput[]>([])
  const [person, setPerson] = React.useState<PersonPickerValue>(emptyPersonPickerValue)
  const [sharedRoom, setSharedRoom] = React.useState<SharedRoomValue>(emptySharedRoomValue)
  const [travelers, setTravelers] = React.useState<TravelerListValue>(emptyTravelerListValue)
  const [voucher, setVoucher] = React.useState<VoucherPickerValue>(emptyVoucherPickerValue)
  const [pricing, setPricing] = React.useState<PriceBreakdownValue | null>(null)
  const [paymentSchedule, setPaymentSchedule] =
    React.useState<PaymentScheduleValue>(emptyPaymentScheduleValue)
  const [generateContractDocument, setGenerateContractDocument] = React.useState(false)
  const [generateInvoiceDocument, setGenerateInvoiceDocument] = React.useState(false)
  const [notes, setNotes] = React.useState("")
  /**
   * Operator override that forces the booking to land in `draft`
   * regardless of payment state. Off by default — the dialog
   * smart-defaults to `confirmed` (when any payment is marked paid)
   * or `awaiting_payment` (when nothing is paid yet). The override
   * exists so an operator can still capture a half-configured
   * booking without committing it to the lifecycle.
   */
  const [createAsDraft, setCreateAsDraft] = React.useState(false)
  // Only relevant when the derived status is `confirmed`: when off,
  // the status transition carries `suppressNotifications: true` so
  // the auto-dispatch subscriber skips the customer email + document
  // bundle. Defaults on so the operator opts out, not in.
  const [notifyTraveler, setNotifyTraveler] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const { formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  React.useEffect(() => {
    if (!enabled) {
      setProduct({ productId: defaultProductId ?? "", optionId: null })
      setSlotId(null)
      setRooms(emptyOptionUnitsStepperValue)
      setRoomUnits([])
      setExtraLines([])
      setPerson(emptyPersonPickerValue)
      setSharedRoom(emptySharedRoomValue)
      setTravelers(emptyTravelerListValue)
      setVoucher(emptyVoucherPickerValue)
      setPricing(null)
      setPaymentSchedule(emptyPaymentScheduleValue)
      setGenerateContractDocument(false)
      setGenerateInvoiceDocument(false)
      setNotes("")
      setCreateAsDraft(false)
      setNotifyTraveler(true)
      setError(null)
    } else if (defaultProductId) {
      setProduct((prev) =>
        prev.productId === defaultProductId
          ? prev
          : { productId: defaultProductId, optionId: null },
      )
    }
  }, [enabled, defaultProductId])

  // biome-ignore lint/correctness/useExhaustiveDependencies: booking-create intentionally resets transient departure state only when product id changes; option changes are reconciled against the selected departure below.
  React.useEffect(() => {
    setSlotId(null)
    setRooms(emptyOptionUnitsStepperValue)
    setRoomUnits([])
    setSharedRoom(emptySharedRoomValue)
    setExtraLines([])
  }, [product.productId])

  const [slotsFromIso, setSlotsFromIso] = React.useState(() => new Date().toISOString())
  React.useEffect(() => {
    if (enabled && product.productId) setSlotsFromIso(new Date().toISOString())
  }, [enabled, product.productId])

  const { data: slotsData } = useSlots({
    productId: product.productId || undefined,
    status: "open",
    startsAtFrom: slotsFromIso,
    limit: 100,
    enabled: enabled && Boolean(product.productId),
  })
  const allOpenSlots = React.useMemo(() => {
    return getBookableDepartureSlots(slotsData?.data ?? [], {
      nowIso: slotsFromIso,
      optionId: null,
    })
  }, [slotsData?.data, slotsFromIso])
  const slots = React.useMemo(() => {
    const optionSlots = getBookableDepartureSlots(slotsData?.data ?? [], {
      nowIso: slotsFromIso,
      optionId: product.optionId,
    })
    return optionSlots.length > 0 ? optionSlots : allOpenSlots
  }, [slotsData?.data, slotsFromIso, product.optionId, allOpenSlots])
  const selectedSlot = React.useMemo(
    () => slots.find((slot) => slot.id === slotId) ?? null,
    [slots, slotId],
  )
  const setSelectedSlot = React.useCallback(
    (nextSlotId: string | null) => {
      const selectedSlot = nextSlotId ? allOpenSlots.find((slot) => slot.id === nextSlotId) : null
      if (selectedSlot?.optionId && selectedSlot.optionId !== product.optionId) {
        setProduct((prev) => ({ ...prev, optionId: selectedSlot.optionId }))
      }
      setSlotId(nextSlotId)
    },
    [allOpenSlots, product.optionId],
  )
  React.useEffect(() => {
    setRooms(emptyOptionUnitsStepperValue)
    setRoomUnits([])
    if (!slotId || !product.optionId) return
    const selectedSlot = allOpenSlots.find((slot) => slot.id === slotId)
    if (selectedSlot?.optionId && selectedSlot.optionId !== product.optionId) {
      setSlotId(null)
    }
  }, [allOpenSlots, product.optionId, slotId])

  const formatSlotLabel = React.useCallback(
    (slot: (typeof slots)[number]) => {
      const date = formatDate(slot.startsAt, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
      const remaining =
        !slot.unlimited && typeof slot.remainingPax === "number"
          ? ` · ${slot.remainingPax} ${messages.bookingCreateDialog.labels.remainingCapacity}`
          : ""
      return `${date}${remaining}`
    },
    [formatDate, messages],
  )

  const slotUnitAvailability = useSlotUnitAvailability({
    slotId: slotId ?? undefined,
    enabled: enabled && Boolean(slotId),
  })
  const handleRoomUnitsChange = React.useCallback((units: OptionUnitsStepperUnit[]) => {
    setRoomUnits((prev) => (sameRoomUnits(prev, units) ? prev : units))
  }, [])
  // Room choices presented to the traveler row are *options* (e.g.
  // "Standard double", "Junior suite upgrade") — NOT option-units
  // (Adult / Child / Senior). The age-band lives separately on the
  // traveler and only affects pricing; both an adult and a child sit
  // in the same Standard double room. Each entry's `unitId` is set to
  // the option's primary unit so existing `roomUnitId`-keyed plumbing
  // (assignment, redistribution) keeps working — `redistributeByAge`
  // moves the traveler to the matching age-banded unit at submit.
  const roomUnitOptions: RoomUnitOption[] = React.useMemo(() => {
    type UnitLike = {
      optionId?: string | null
      optionUnitId: string
      unitName: string
      unitCode?: string | null
      unitType?: OptionUnitsStepperUnit["unitType"]
      occupancyMax: number | null
    }
    const units: UnitLike[] = (
      roomUnits.length > 0 ? roomUnits : (slotUnitAvailability.data?.data ?? [])
    ).filter(isRoomUnit)
    if (units.length === 0) return []
    const optionGroups = new Map<
      string,
      {
        primaryUnitId: string
        optionName: string
        units: UnitLike[]
      }
    >()
    for (const unit of units) {
      const key = unit.optionId ?? unit.optionUnitId
      // Prefer an ADULT-coded primary; the stepper routes per-option
      // qty through the same unit so seat math stays consistent.
      const isAdult = (unit.unitCode ?? "").toUpperCase() === "ADULT"
      const existing = optionGroups.get(key)
      if (existing) {
        existing.units.push(unit)
        if (isAdult) existing.primaryUnitId = unit.optionUnitId
      } else {
        optionGroups.set(key, {
          primaryUnitId: unit.optionUnitId,
          // Strip the trailing " - Adult" / " - Child" suffix the
          // upstream stepper appends when an option has multiple units.
          optionName: stripUnitSuffix(unit.unitName),
          units: [unit],
        })
      }
    }
    return Array.from(optionGroups.values())
      .filter((group) => {
        const totalQty = group.units.reduce(
          (sum, u) => sum + (rooms.quantities[u.optionUnitId] ?? 0),
          0,
        )
        return totalQty > 0
      })
      .map((group) => {
        const totalQty = group.units.reduce(
          (sum, u) => sum + (rooms.quantities[u.optionUnitId] ?? 0),
          0,
        )
        const occupancyMax = Math.max(1, ...group.units.map((u) => u.occupancyMax ?? 1))
        const seats = totalQty * occupancyMax
        const optionUnitIds = new Set(group.units.map((u) => u.optionUnitId))
        const assigned = travelers.travelers.filter(
          (traveler) => traveler.roomUnitId && optionUnitIds.has(traveler.roomUnitId),
        ).length
        return {
          unitId: group.primaryUnitId,
          unitName: group.optionName,
          remainingCapacity: Math.max(0, seats - assigned),
        }
      })
  }, [roomUnits, slotUnitAvailability.data, rooms.quantities, travelers.travelers])

  // Per-option breakdown of all configured units, with the
  // attributes the TravelersSection's dynamic category buttons need
  // (unitCode/min-max/unitType). Mirrors the grouping logic in
  // `roomUnitOptions` but exposes every unit instead of collapsing
  // to one primary.
  const roomGroups: RoomGroup[] = React.useMemo(() => {
    if (roomUnits.length === 0) return []
    const groups = new Map<string, RoomGroup>()
    for (const u of roomUnits) {
      if (!u.optionId) continue
      const groupKey = u.optionId
      const isAdultCoded = (u.unitCode ?? "").toUpperCase() === "ADULT"
      const unit = {
        unitId: u.optionUnitId,
        // Strip the "Option name - " prefix the stepper applies when
        // an option has multiple units; the per-unit label is enough
        // for a category button.
        unitName: stripOptionPrefix(u.unitName),
        unitCode: u.unitCode ?? null,
        minAge: u.minAge ?? null,
        maxAge: u.maxAge ?? null,
        unitType: (u.unitType ?? null) as RoomGroup["units"][number]["unitType"],
      }
      const existing = groups.get(groupKey)
      if (existing) {
        existing.units.push(unit)
        if (isAdultCoded) existing.primaryUnitId = u.optionUnitId
      } else {
        groups.set(groupKey, {
          optionId: groupKey,
          optionName: stripUnitSuffix(u.unitName),
          primaryUnitId: u.optionUnitId,
          units: [unit],
        })
      }
    }
    return Array.from(groups.values())
  }, [roomUnits])

  // Apply the same age-banded redistribution we use at submit so the
  // live price preview matches what the operator will actually be
  // billed. Without this, the breakdown sees only the option's primary
  // (Adult) unit qty from the stepper, missing the per-traveler split
  // between adult / child / infant tiers.
  const displayQuantities = React.useMemo(
    () => redistributeByAge(rooms.quantities, travelers.travelers, roomUnits).quantities,
    [rooms.quantities, travelers.travelers, roomUnits],
  )

  // Currency placeholder — used for voucher + payment schedule display.
  // Consumers hooking in real product data should override this by wrapping
  // the component or swapping in their own currency-aware hook.
  const currency = messages.bookingCreateDialog.labels.currency
  const pricingCurrency = pricing?.currency ?? currency
  const pricingTotalAmountCents = pricing?.confirmedAmountCents ?? undefined
  const roomUnitLabels = React.useMemo(
    () => Object.fromEntries(roomUnits.map((unit) => [unit.optionUnitId, unit.unitName])),
    [roomUnits],
  )

  const createBookingMutation = useBookingCreateMutation()

  // Resolve the billing person/org once at the dialog level so we can
  // snapshot their contact details into the booking row at create time.
  // The booking row's `contact_*` columns are the source of truth for
  // billing on the detail page — the linked CRM record can change (or
  // be deleted) later without retroactively rewriting history.
  const billingPersonRecord = usePerson(
    (person.billTo ?? "person") === "person" ? (person.personId ?? undefined) : undefined,
    { enabled: (person.billTo ?? "person") === "person" && Boolean(person.personId) },
  ).data
  const billingOrganizationRecord = useOrganization(
    person.billTo === "organization" ? (person.organizationId ?? undefined) : undefined,
    { enabled: person.billTo === "organization" && Boolean(person.organizationId) },
  ).data
  // Primary address for whichever billing record was picked. Filter by
  // `entityType` + `entityId` to keep the response small; the first
  // address with `isPrimary` wins (the server returns at most one).
  const billingPrimaryAddressKind: "person" | "organization" | null =
    (person.billTo ?? "person") === "person" && person.personId
      ? "person"
      : person.billTo === "organization" && person.organizationId
        ? "organization"
        : null
  const billingPrimaryAddressEntityId =
    billingPrimaryAddressKind === "person"
      ? (person.personId ?? undefined)
      : billingPrimaryAddressKind === "organization"
        ? (person.organizationId ?? undefined)
        : undefined
  const billingAddressQuery = useAddresses({
    entityType: billingPrimaryAddressKind ?? undefined,
    entityId: billingPrimaryAddressEntityId,
    isPrimary: true,
    limit: 1,
    enabled: Boolean(billingPrimaryAddressKind && billingPrimaryAddressEntityId),
  })
  const billingPrimaryAddress = billingAddressQuery.data?.data?.[0] ?? null
  const hasSelectedUnits = React.useMemo(
    () => Object.values(rooms.quantities).some((qty) => qty > 0),
    [rooms.quantities],
  )

  const handleSubmit = async () => {
    setError(null)

    if (!product.productId) {
      setError(messages.bookingCreateDialog.validation.selectProduct)
      return
    }

    if (!slotId) {
      setError(messages.bookingCreateDialog.validation.selectDeparture)
      return
    }

    if (!hasSelectedUnits) {
      setError(messages.bookingCreateDialog.validation.selectUnits)
      return
    }

    let resolvedPersonId: string | null = null
    let resolvedOrganizationId: string | null = null
    if ((person.billTo ?? "person") === "person") {
      if (!person.personId) {
        setError(messages.bookingCreateDialog.validation.selectPerson)
        return
      }
      resolvedPersonId = person.personId
      const billingContactValidation = validateBillingPersonContact(billingPersonRecord)
      if (billingContactValidation === "missing-contact") {
        setError(messages.bookingCreateDialog.validation.billingContactRequired)
        return
      }
      if (billingContactValidation === "invalid-email") {
        setError(messages.bookingCreateDialog.validation.billingEmailInvalid)
        return
      }
    } else {
      if (!person.organizationId) {
        setError(messages.bookingCreateDialog.validation.selectOrganization)
        return
      }
      resolvedOrganizationId = person.organizationId
    }

    if (travelers.travelers.length === 0) {
      setError(messages.bookingCreateDialog.validation.travelerRequired)
      return
    }

    const invalidTraveler = travelers.travelers.find(
      (traveler) =>
        (!traveler.personId && (!traveler.firstName.trim() || !traveler.lastName.trim())) ||
        (traveler.email.trim() ? !isRealBookingEmail(traveler.email) : false),
    )
    if (invalidTraveler) {
      setError(messages.bookingCreateDialog.validation.firstAndLastNameRequired)
      return
    }

    try {
      if (sharedRoom.enabled && sharedRoom.mode === "join" && !sharedRoom.groupId) {
        setError(messages.bookingCreateDialog.validation.selectSharedRoomGroup)
        return
      }

      const bookingNumber = generateBookingNumber()
      const confirmedSellAmountCents = pricing?.confirmedAmountCents ?? null
      const catalogSellAmountCents = pricing?.catalogAmountCents ?? null
      const priceOverrideReason = pricing?.priceOverrideReason.trim() ?? ""

      if (pricing?.requiresReason) {
        setError(messages.bookingCreateDialog.labels.breakdownOverrideReasonRequired)
        return
      }

      const paymentSchedules = paymentScheduleToRows(
        paymentSchedule,
        pricingCurrency,
        confirmedSellAmountCents,
      )
      // Age-banded redistribution: turn the operator's per-option
      // quantities + raw traveler list into per-unit quantities + each
      // traveler's matching unit assignment, driven by DOB.
      const submitUnits =
        roomUnits.length > 0
          ? roomUnits
          : (slotUnitAvailability.data?.data ?? []).map((unit) => ({
              ...unit,
              optionId: product.optionId,
            }))
      const redistributed = redistributeByAge(rooms.quantities, travelers.travelers, submitUnits)

      const itemLines = itemLinesToRows(redistributed.quantities, submitUnits, pricing)

      const travelerRows = travelersToRows({ travelers: redistributed.travelers })

      const voucherRedemption: BookingCreateVoucherRedemptionInput | undefined =
        voucher.picked && voucher.picked.remainingAmountCents != null
          ? {
              voucherId: voucher.picked.id,
              amountCents: voucher.picked.remainingAmountCents,
            }
          : undefined

      const selectedSharedRoomUnitId = getSelectedSharedRoomUnitId(rooms.quantities)
      const groupMembership: BookingCreateGroupMembershipInput | undefined = sharedRoom.enabled
        ? sharedRoom.mode === "create"
          ? {
              action: "create",
              kind: "shared_room",
              label:
                sharedRoom.groupLabel?.trim() ||
                `${messages.bookingCreateDialog.labels.sharedRoomGeneratedLabelPrefix} - ${bookingNumber}`,
              optionUnitId: selectedSharedRoomUnitId,
              makeBookingPrimary: true,
            }
          : sharedRoom.groupId
            ? { action: "join", groupId: sharedRoom.groupId, role: "shared" }
            : undefined
        : undefined

      // Smart-default status from payment state — any payment marked
      // "Already paid" implies the booking is effectively confirmed,
      // otherwise it lands in `awaiting_payment` so the operator can
      // dispatch a payment link. Override available via the explicit
      // "Create as draft" checkbox. The server commits this status in
      // the create transaction and emits `booking.confirmed`
      // post-commit when applicable — no second roundtrip.
      const initialStatus = createAsDraft
        ? undefined
        : hasAnyPaidPayment(paymentSchedule)
          ? ("confirmed" as const)
          : ("awaiting_payment" as const)

      // Build the billing-contact snapshot from whichever CRM record
      // the operator picked, plus the primary identity address when
      // present. Falls back to nulls when a record is missing — the
      // server stores nulls and the detail page hydrates from the live
      // CRM record at read time.
      const addressSnapshot = billingPrimaryAddress
        ? {
            contactAddressLine1: billingPrimaryAddress.line1,
            contactCity: billingPrimaryAddress.city,
            contactRegion: billingPrimaryAddress.region,
            contactPostalCode: billingPrimaryAddress.postalCode,
            contactCountry: billingPrimaryAddress.country,
          }
        : {}
      const contactSnapshot: Pick<
        Parameters<typeof createBookingMutation.mutateAsync>[0],
        | "contactFirstName"
        | "contactLastName"
        | "contactEmail"
        | "contactPhone"
        | "contactPreferredLanguage"
        | "contactAddressLine1"
        | "contactCity"
        | "contactRegion"
        | "contactPostalCode"
        | "contactCountry"
      > = billingPersonRecord
        ? {
            contactFirstName: billingPersonRecord.firstName,
            contactLastName: billingPersonRecord.lastName,
            contactEmail: billingPersonRecord.email,
            contactPhone: billingPersonRecord.phone,
            contactPreferredLanguage: billingPersonRecord.preferredLanguage,
            ...addressSnapshot,
          }
        : billingOrganizationRecord
          ? {
              contactFirstName: billingOrganizationRecord.name,
              contactLastName: null,
              contactEmail: null,
              contactPhone: null,
              contactPreferredLanguage: billingOrganizationRecord.preferredLanguage,
              ...addressSnapshot,
            }
          : {}

      const { booking } = await createBookingMutation.mutateAsync({
        productId: product.productId,
        bookingNumber,
        optionId: product.optionId,
        slotId,
        personId: resolvedPersonId,
        organizationId: resolvedOrganizationId,
        internalNotes: notes.trim() || null,
        catalogSellAmountCents,
        confirmedSellAmountCents,
        priceOverrideReason: priceOverrideReason || null,
        itemLines: itemLines.length > 0 ? itemLines : undefined,
        extraLines: extraLines.length > 0 ? extraLines : undefined,
        travelers: travelerRows.length > 0 ? travelerRows : undefined,
        paymentSchedules: paymentSchedules.length > 0 ? paymentSchedules : undefined,
        voucherRedemption,
        groupMembership,
        documentGeneration: {
          contractDocument: generateContractDocument,
          invoiceDocument: generateInvoiceDocument,
        },
        initialStatus,
        // Suppression only matters when transitioning to `confirmed` —
        // `awaiting_payment` doesn't trigger the auto-dispatch
        // subscriber today.
        suppressNotifications: initialStatus === "confirmed" && !notifyTraveler ? true : undefined,
        ...contactSnapshot,
      })

      onCreated?.(booking)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : messages.bookingCreateDialog.validation.createFailed,
      )
    }
  }

  const isSubmitting = createBookingMutation.isPending

  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-12">
      {/* Form column — form sections scroll above the inline footer buttons. */}
      <div className="flex min-h-0 min-w-0 flex-col lg:col-span-8">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-1 pb-2">
          <ProductPickerSection
            value={product}
            onChange={setProduct}
            enabled={enabled}
            lockProduct={Boolean(defaultProductId)}
            labels={{
              optionNone: messages.bookingCreateDialog.labels.noSpecificOption,
            }}
            showOptionPicker={false}
          />

          {product.productId ? (
            <div className="flex flex-col gap-1">
              <Label>{messages.bookingCreateDialog.fields.departure}</Label>
              <AsyncCombobox
                value={slotId}
                onChange={(v) => setSelectedSlot(v)}
                items={slots}
                selectedItem={slots.find((s) => s.id === slotId) ?? null}
                getKey={(slot) => slot.id}
                getLabel={(slot) => formatSlotLabel(slot)}
                placeholder={messages.bookingCreateDialog.placeholders.departure}
                emptyText={messages.bookingCreateDialog.placeholders.departureEmpty}
                triggerClassName="w-full"
                clearable
              />
            </div>
          ) : null}

          {product.productId && slotId ? (
            <OptionUnitsStepperSection
              value={rooms}
              onChange={setRooms}
              productId={product.productId}
              slotId={slotId}
              optionId={product.optionId}
              enabled={enabled}
              onUnitsChange={handleRoomUnitsChange}
              slotHasFiniteCapacity={
                Boolean(selectedSlot) &&
                !selectedSlot?.unlimited &&
                typeof selectedSlot?.remainingPax === "number"
              }
              labels={{
                heading: messages.bookingCreateDialog.labels.roomsHeading,
                noOption: messages.bookingCreateDialog.labels.roomsNoOption,
                noSlot: messages.bookingCreateDialog.labels.roomsNoSlot,
                noUnits: messages.bookingCreateDialog.labels.roomsNoUnits,
                remaining: messages.bookingCreateDialog.labels.roomsRemaining,
                unlimited: messages.bookingCreateDialog.labels.roomsUnlimited,
              }}
            />
          ) : null}

          {product.productId && slotId ? (
            <ProductExtrasPickerSection
              productId={product.productId}
              optionId={product.optionId}
              currency={pricingCurrency}
              travelerCount={travelers.travelers.length}
              value={extraLines}
              onChange={setExtraLines}
              enabled={enabled}
              labels={{
                heading: messages.bookingCreateDialog.labels.extrasHeading,
                empty: messages.bookingCreateDialog.labels.extrasEmpty,
                included: messages.bookingCreateDialog.labels.extrasIncluded,
                onRequest: messages.bookingCreateDialog.labels.extrasOnRequest,
                perPerson: messages.bookingCreateDialog.labels.extrasPerPerson,
              }}
            />
          ) : null}

          {product.productId && slotId ? (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <Label>{messages.bookingCreateDialog.labels.billingHeading}</Label>
              <PersonPickerSection
                value={person}
                onChange={setPerson}
                enabled={enabled}
                labels={{
                  createNewPerson: messages.bookingCreateDialog.labels.createNewPerson,
                  selectExistingPerson: messages.bookingCreateDialog.labels.selectExistingPerson,
                  organizationNone: messages.bookingCreateDialog.labels.organizationNone,
                }}
              />
            </div>
          ) : null}

          {product.productId && slotId ? (
            <SharedRoomSection
              value={sharedRoom}
              onChange={setSharedRoom}
              productId={product.productId || undefined}
              enabled={enabled}
              labels={{
                toggle: messages.bookingCreateDialog.labels.sharedRoomToggle,
                createMode: messages.bookingCreateDialog.labels.sharedRoomCreateMode,
                joinMode: messages.bookingCreateDialog.labels.sharedRoomJoinMode,
                selectPlaceholder: messages.bookingCreateDialog.labels.sharedRoomSelectPlaceholder,
                noGroups: messages.bookingCreateDialog.labels.sharedRoomNoGroups,
                createHint: messages.bookingCreateDialog.labels.sharedRoomCreateHint,
                remove: messages.bookingCreateDialog.labels.sharedRoomRemove,
              }}
            />
          ) : null}

          {product.productId && slotId ? (
            <TravelersSection
              value={travelers}
              onChange={setTravelers}
              roomUnits={roomUnitOptions.length > 0 ? roomUnitOptions : undefined}
              roomGroups={roomGroups.length > 0 ? roomGroups : undefined}
              billingPersonId={(person.billTo ?? "person") === "person" ? person.personId : null}
              labels={{
                heading: messages.bookingCreateDialog.labels.travelerHeading,
                addTraveler: messages.bookingCreateDialog.labels.addTraveler,
                person: messages.bookingCreateDialog.labels.travelerPerson,
                personSearchPlaceholder:
                  messages.bookingCreateDialog.labels.travelerPersonSearchPlaceholder,
                personEmpty: messages.bookingCreateDialog.labels.travelerPersonEmpty,
                createNewPerson: messages.bookingCreateDialog.labels.createNewPerson,
                createPersonSheetTitle: messages.bookingCreateDialog.labels.createPersonSheetTitle,
                addBillingPerson: messages.bookingCreateDialog.labels.addBillingPersonAsTraveler,
                role: messages.bookingCreateDialog.labels.travelerRole,
                roleLead: messages.bookingCreateDialog.labels.travelerLead,
                roleAdult: messages.bookingCreateDialog.labels.travelerAdult,
                roleChild: messages.bookingCreateDialog.labels.travelerChild,
                roleInfant: messages.bookingCreateDialog.labels.travelerInfant,
                room: messages.bookingCreateDialog.labels.travelerRoom,
                noRoom: messages.bookingCreateDialog.labels.travelerNoRoom,
                remove: messages.bookingCreateDialog.labels.travelerRemove,
                empty: messages.bookingCreateDialog.labels.travelerEmpty,
              }}
            />
          ) : null}

          {product.productId && slotId ? (
            <div className="flex flex-col gap-2">
              <Label>{messages.bookingCreateDialog.fields.internalNotes}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={messages.bookingCreateDialog.placeholders.internalNotes}
              />
            </div>
          ) : null}

          {/* On-create actions — document generation and confirm-and-notify
            live in one card since both control what happens immediately
            after the booking is created. */}
          {product.productId && slotId ? (
            <div className="flex flex-col gap-3 rounded-md border p-3">
              <Label>{messages.bookingCreateDialog.labels.documentGenerationHeading}</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="new-booking-generate-contract-document"
                    checked={generateContractDocument}
                    onCheckedChange={(value) => setGenerateContractDocument(value === true)}
                  />
                  <Label
                    htmlFor="new-booking-generate-contract-document"
                    className="cursor-pointer"
                  >
                    {messages.bookingCreateDialog.labels.generateContractDocument}
                  </Label>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="new-booking-generate-invoice-document"
                    checked={generateInvoiceDocument}
                    onCheckedChange={(value) => setGenerateInvoiceDocument(value === true)}
                  />
                  <Label htmlFor="new-booking-generate-invoice-document" className="cursor-pointer">
                    {messages.bookingCreateDialog.labels.generateInvoiceDocument}
                  </Label>
                </div>
                <div className="flex flex-col gap-2 border-t pt-2 text-sm">
                  {(() => {
                    const wouldBeConfirmed = hasAnyPaidPayment(paymentSchedule)
                    const derivedStatusLabel = createAsDraft
                      ? messages.common.bookingStatusLabels.draft
                      : wouldBeConfirmed
                        ? messages.common.bookingStatusLabels.confirmed
                        : messages.common.bookingStatusLabels.awaiting_payment
                    return (
                      <>
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="new-booking-create-as-draft"
                            checked={createAsDraft}
                            onCheckedChange={(v) => setCreateAsDraft(v === true)}
                            className="mt-0.5"
                          />
                          <div className="flex flex-col gap-1">
                            <Label
                              htmlFor="new-booking-create-as-draft"
                              className="cursor-pointer text-sm"
                            >
                              {messages.bookingCreateDialog.fields.createAsDraft}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {formatMessage(
                                messages.bookingCreateDialog.fields.createAsDraftHint,
                                { status: derivedStatusLabel },
                              )}
                            </p>
                          </div>
                        </div>
                        {!createAsDraft && wouldBeConfirmed ? (
                          <div className="flex items-start gap-2 pl-6">
                            <Checkbox
                              id="new-booking-notify-traveler"
                              checked={notifyTraveler}
                              onCheckedChange={(v) => setNotifyTraveler(v === true)}
                              className="mt-0.5"
                            />
                            <div className="flex flex-col gap-1">
                              <Label
                                htmlFor="new-booking-notify-traveler"
                                className="cursor-pointer text-sm"
                              >
                                {messages.bookingCreateDialog.fields.notifyTraveler}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {messages.bookingCreateDialog.fields.notifyTravelerHint}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {/* Footer buttons live INSIDE the form column so they don't span the preview column. */}
        {error ? (
          <div
            role="alert"
            className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-2 border-t px-1 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {messages.common.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !product.productId || !slotId || !hasSelectedUnits}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {createAsDraft
              ? messages.bookingCreateDialog.actions.createDraftBooking
              : hasAnyPaidPayment(paymentSchedule)
                ? messages.bookingCreateDialog.actions.createConfirmedBooking
                : messages.bookingCreateDialog.actions.createAwaitingPaymentBooking}
          </Button>
        </div>
      </div>
      {/* Right column — preview, pricing, voucher. Stays out of the
          form column so the footer buttons don't sit beneath it. */}
      <div className="flex flex-col gap-4 lg:col-span-4">
        <BookingPreviewCard
          productId={product.productId}
          optionId={product.optionId}
          slotId={slotId}
          slotLabel={(() => {
            const slot = slots.find((s) => s.id === slotId)
            return slot ? formatSlotLabel(slot) : null
          })()}
          unitQuantities={displayQuantities}
          unitLabels={roomUnitLabels}
          extraLines={extraLines}
          travelers={travelers.travelers}
          messages={messages}
          onPricingChange={setPricing}
        />
        {product.productId && slotId ? (
          <VoucherPickerSection
            value={voucher}
            onChange={setVoucher}
            currency={currency}
            labels={{
              heading: messages.bookingCreateDialog.labels.voucherHeading,
              codePlaceholder: messages.bookingCreateDialog.labels.voucherCodePlaceholder,
              apply: messages.bookingCreateDialog.labels.voucherApply,
              clear: messages.bookingCreateDialog.labels.voucherClear,
              remainingLabel: messages.bookingCreateDialog.labels.voucherRemainingLabel,
              invalidLabel: messages.bookingCreateDialog.labels.voucherInvalidLabel,
            }}
          />
        ) : null}
        {product.productId && slotId ? (
          <PaymentScheduleSection
            value={paymentSchedule}
            onChange={setPaymentSchedule}
            currency={pricingCurrency}
            totalAmountCents={pricingTotalAmountCents}
            labels={{
              heading: messages.bookingCreateDialog.labels.paymentHeading,
              modeUnpaid: messages.bookingCreateDialog.labels.paymentModeUnpaid,
              modeFull: messages.bookingCreateDialog.labels.paymentModeFull,
              modeAdvance: messages.bookingCreateDialog.labels.paymentModeAdvance,
              modeSplit: messages.bookingCreateDialog.labels.paymentModeSplit,
              dueDate: messages.bookingCreateDialog.labels.paymentDueDate,
              amount: messages.bookingCreateDialog.labels.paymentAmount,
              firstInstallment: messages.bookingCreateDialog.labels.paymentFirstInstallment,
              secondInstallment: messages.bookingCreateDialog.labels.paymentSecondInstallment,
              preset5050: messages.bookingCreateDialog.labels.paymentPreset5050,
              unpaidHint: messages.bookingCreateDialog.labels.paymentUnpaidHint,
              totalDue: messages.bookingCreateDialog.labels.paymentTotalDue,
              scheduledTotal: messages.bookingCreateDialog.labels.paymentScheduledTotal,
              remaining: messages.bookingCreateDialog.labels.paymentRemaining,
              alreadyPaid: messages.bookingCreateDialog.labels.paymentAlreadyPaid,
              paymentDate: messages.bookingCreateDialog.labels.paymentDate,
              paymentMethod: messages.bookingCreateDialog.labels.paymentMethod,
              paymentReference: messages.bookingCreateDialog.labels.paymentReference,
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function ProductExtrasPickerSection({
  productId,
  optionId,
  currency,
  travelerCount,
  value,
  onChange,
  enabled,
  labels,
}: {
  productId: string
  optionId: string | null
  currency: string
  travelerCount: number
  value: BookingCreateExtraLineInput[]
  onChange: (value: BookingCreateExtraLineInput[]) => void
  enabled: boolean
  labels: {
    heading: string
    empty: string
    included: string
    onRequest: string
    perPerson: string
  }
}) {
  const { formatCurrency } = useBookingsUiI18nOrDefault()
  const pricingClient = useVoyantPricingContext()
  const extrasQuery = useProductExtras({
    productId,
    active: true,
    limit: 100,
    enabled: enabled && Boolean(productId),
  })
  const extras = extrasQuery.data?.data ?? []
  const priceQueries = useQueries({
    queries: extras.map((extra) => ({
      ...getExtraPriceRulesQueryOptions(pricingClient, {
        productExtraId: extra.id,
        ...(optionId ? { optionId } : {}),
        active: true,
        limit: 10,
      }),
      enabled,
    })),
  })
  const priceByExtraId = new Map(
    extras.flatMap((extra, index) => {
      const row = priceQueries[index]?.data?.data?.[0]
      return row ? ([[extra.id, row]] as const) : []
    }),
  )
  const selectedByExtraId = new Map(value.map((line) => [line.productExtraId, line]))

  const setQuantity = (extra: ProductExtraRecord, quantity: number) => {
    const next = value.filter((line) => line.productExtraId !== extra.id)
    if (quantity > 0) {
      const price = priceByExtraId.get(extra.id)
      const pricingMode =
        price?.pricingMode ?? (extra.pricedPerPerson ? "per_person" : extra.pricingMode)
      const unitSellAmountCents = price?.sellAmountCents ?? null
      const chargedQuantity =
        pricingMode === "per_person" || extra.pricedPerPerson
          ? Math.max(1, travelerCount) * quantity
          : quantity
      const totalSellAmountCents =
        unitSellAmountCents == null ? null : unitSellAmountCents * chargedQuantity
      next.push({
        productExtraId: extra.id,
        name: extra.name,
        description: extra.description,
        pricingMode,
        pricedPerPerson: extra.pricedPerPerson,
        quantity,
        sellCurrency: currency,
        unitSellAmountCents,
        totalSellAmountCents,
      })
    }
    onChange(next)
  }

  if (extras.length === 0 && extrasQuery.isSuccess) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Label>{labels.heading}</Label>
        <p className="text-xs text-muted-foreground">{labels.empty}</p>
      </div>
    )
  }

  if (extras.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <Label>{labels.heading}</Label>
      <div className="flex flex-col gap-2">
        {extras.map((extra) => {
          const selected = selectedByExtraId.get(extra.id)
          const quantity = selected?.quantity ?? 0
          const price = priceByExtraId.get(extra.id)
          const pricingMode =
            price?.pricingMode ?? (extra.pricedPerPerson ? "per_person" : extra.pricingMode)
          const unitAmount = price?.sellAmountCents ?? null
          const priceLabel =
            pricingMode === "included" || pricingMode === "free"
              ? labels.included
              : unitAmount == null
                ? labels.onRequest
                : `${formatCurrency(unitAmount / 100, currency)}${
                    pricingMode === "per_person" || extra.pricedPerPerson
                      ? ` ${labels.perPerson}`
                      : ""
                  }`
          const maxQuantity = extra.maxQuantity ?? undefined
          return (
            <div key={extra.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{extra.name}</div>
                <div className="text-xs text-muted-foreground">{priceLabel}</div>
              </div>
              <QuantityButtons
                value={quantity}
                max={maxQuantity}
                onChange={(next) => setQuantity(extra, next)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuantityButtons({
  value,
  max,
  onChange,
}: {
  value: number
  max?: number
  onChange(value: number): void
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        -
      </Button>
      <span className="min-w-6 text-center text-sm tabular-nums">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={max != null && value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </Button>
    </div>
  )
}

/**
 * Right-rail live preview for the booking-create dialog. Mirrors the
 * operator's in-progress selections — product (with thumbnail),
 * departure, options + quantities, travelers, and the current
 * confirmed price — so the operator gets a "what am I about to book"
 * summary without scrolling back through the form.
 */
function BookingPreviewCard({
  productId,
  optionId,
  slotId,
  slotLabel,
  unitQuantities,
  unitLabels,
  extraLines,
  travelers,
  messages,
  onPricingChange,
}: {
  productId: string
  optionId: string | null
  slotId: string | null
  slotLabel: string | null
  unitQuantities: Record<string, number>
  unitLabels: Record<string, string>
  extraLines: BookingCreateExtraLineInput[]
  travelers: TravelerEntry[]
  messages: ReturnType<typeof useBookingsUiMessagesOrDefault>
  onPricingChange: (value: PriceBreakdownValue) => void
}) {
  const { formatCurrency, formatNumber } = useBookingsUiI18nOrDefault()
  const productQuery = useProduct(productId || undefined, { enabled: Boolean(productId) })
  const mediaQuery = useProductMedia(productId, { limit: 1, enabled: Boolean(productId) })
  const product = productQuery.data ?? null
  const cover = (mediaQuery.data?.data ?? []).find((m) => m.isCover) ?? mediaQuery.data?.data?.[0]
  const labels = messages.bookingCreateDialog.labels
  // Mirror the breakdown locally so we can drive the tax preview hook
  // off the same `confirmedAmountCents` the parent receives via
  // onPricingChange. Manual overrides flow through the same field, so
  // the tax line follows whatever the operator decides to charge.
  const [breakdown, setBreakdown] = React.useState<PriceBreakdownValue | null>(null)
  const handlePricingChange = React.useCallback(
    (value: PriceBreakdownValue) => {
      const extraTotal = extraLines.reduce((sum, line) => sum + (line.totalSellAmountCents ?? 0), 0)
      const next =
        extraTotal > 0
          ? {
              ...value,
              catalogAmountCents:
                value.catalogAmountCents == null ? null : value.catalogAmountCents + extraTotal,
              confirmedAmountCents:
                value.confirmedAmountCents == null ? null : value.confirmedAmountCents + extraTotal,
              lines: [
                ...value.lines,
                ...extraLines.map((line) => ({
                  unitId: `extra:${line.productExtraId}`,
                  label: line.name,
                  quantity: line.quantity,
                  unitAmountCents: line.unitSellAmountCents ?? null,
                  totalAmountCents: line.totalSellAmountCents ?? null,
                  tierLabel: null,
                  isGroupRate: false,
                })),
              ],
            }
          : value
      setBreakdown(next)
      onPricingChange(next)
    },
    [extraLines, onPricingChange],
  )
  const taxSubtotalCents = breakdown?.confirmedAmountCents ?? breakdown?.catalogAmountCents ?? 0
  const taxCurrency = breakdown?.currency ?? "EUR"
  const taxPreview = useBookingTaxPreview({
    productId,
    subtotalCents: taxSubtotalCents,
    currency: taxCurrency,
    enabled: Boolean(productId) && taxSubtotalCents > 0,
  })
  const previewMessages = {
    heading: labels.previewHeading,
    empty: labels.previewEmpty,
    product: labels.previewProduct,
    departure: labels.previewDeparture,
    travelers: labels.previewTravelers,
    loading: labels.previewLoading,
    travelerUnnamed: labels.previewTravelerUnnamed,
  }

  const showPriceBreakdown = Boolean(productId && slotId)
  const hasContent =
    Boolean(productId) || slotLabel != null || travelers.length > 0 || showPriceBreakdown

  return (
    <aside>
      <div className="flex flex-col gap-4 rounded-md border bg-muted/10 p-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {previewMessages.heading}
        </div>

        {!hasContent ? (
          <p className="text-xs text-muted-foreground">{previewMessages.empty}</p>
        ) : null}

        {productId ? (
          <div className="flex gap-3">
            {cover?.url ? (
              <img
                src={cover.url}
                alt={product?.name ?? ""}
                className="h-14 w-14 shrink-0 rounded-md object-cover ring-1 ring-border"
                loading="lazy"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {previewMessages.product}
              </span>
              <span className="truncate text-sm font-medium">
                {product?.name ?? previewMessages.loading}
              </span>
            </div>
          </div>
        ) : null}

        {slotLabel ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {previewMessages.departure}
            </span>
            <span className="text-sm">{slotLabel}</span>
          </div>
        ) : null}

        {travelers.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {previewMessages.travelers}
            </span>
            <ul className="flex flex-col gap-0.5 text-sm">
              {travelers.map((traveler, idx) => {
                const name = [traveler.firstName, traveler.lastName]
                  .filter((part) => part.trim().length > 0)
                  .join(" ")
                  .trim()
                return (
                  <li
                    key={traveler.personId ?? `traveler-${idx}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate text-muted-foreground">
                      {name || previewMessages.travelerUnnamed}
                    </span>
                    <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
                      {traveler.role}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {/* Priced lines + totals + manual override live inside the same
            summary card now — the standalone price-breakdown card was
            duplicating the option/total rows shown above. */}
        {showPriceBreakdown ? (
          <div className="border-t pt-3">
            <PriceBreakdownSection
              flat
              productId={productId}
              optionId={optionId}
              unitQuantities={unitQuantities}
              unitLabels={unitLabels}
              labels={{
                heading: labels.breakdownHeading,
                total: labels.breakdownTotal,
                onRequest: labels.breakdownOnRequest,
                groupRate: labels.breakdownGroupRate,
                empty: labels.breakdownEmpty,
                noPricing: labels.breakdownNoPricing,
                confirmedTotal: labels.breakdownConfirmedTotal,
                manualTotal: labels.breakdownManualTotal,
                useCatalogTotal: labels.breakdownUseCatalogTotal,
                overrideReason: labels.breakdownOverrideReason,
                overrideReasonPlaceholder: labels.breakdownOverrideReasonPlaceholder,
                overrideReasonRequired: labels.breakdownOverrideReasonRequired,
              }}
              onChange={handlePricingChange}
            />
            {extraLines.length > 0 ? (
              <div className="mt-2 flex flex-col gap-1.5 border-t pt-2 text-sm">
                {extraLines.map((line) => (
                  <div
                    key={line.productExtraId}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="tabular-nums">{formatNumber(line.quantity)}x</span>
                      <span>{line.name}</span>
                    </div>
                    <div className="tabular-nums">
                      {line.totalSellAmountCents == null || !line.sellCurrency
                        ? labels.breakdownOnRequest
                        : formatCurrency(line.totalSellAmountCents / 100, line.sellCurrency)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {taxPreview.data?.data && taxPreview.data.data.taxCents > 0 ? (
              <TaxPreviewRows
                snapshot={taxPreview.data.data}
                labels={{
                  subtotal: labels.breakdownSubtotal,
                  tax: labels.breakdownTax,
                  taxIncluded: labels.breakdownTaxIncluded,
                  total: labels.breakdownTotal,
                }}
                formatAmount={(cents, currency) => formatCurrency(cents / 100, currency)}
                formatRate={(basisPoints) =>
                  formatNumber(basisPoints / 100, {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 0,
                  })
                }
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function TaxPreviewRows({
  snapshot,
  labels,
  formatAmount,
  formatRate,
}: {
  snapshot: {
    subtotalCents: number
    taxCents: number
    totalCents: number
    currency: string
    taxRate: { code: string; label: string; rateBasisPoints: number; priceMode: string } | null
  }
  labels: { subtotal: string; tax: string; taxIncluded: string; total: string }
  formatAmount: (cents: number, currency: string) => string
  formatRate: (basisPoints: number) => string
}) {
  const inclusive = snapshot.taxRate?.priceMode === "inclusive"
  const ratePart = snapshot.taxRate ? ` (${formatRate(snapshot.taxRate.rateBasisPoints)}%)` : ""
  const inclTag = inclusive ? ` · ${labels.taxIncluded}` : ""
  return (
    <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span>{labels.subtotal}</span>
        <span>{formatAmount(snapshot.subtotalCents, snapshot.currency)}</span>
      </div>
      <div className="flex items-center justify-between text-muted-foreground">
        <span>
          {snapshot.taxRate?.label ?? labels.tax}
          {ratePart}
          {inclTag}
        </span>
        <span>{formatAmount(snapshot.taxCents, snapshot.currency)}</span>
      </div>
      <div className="flex items-center justify-between font-medium">
        <span>{labels.total}</span>
        <span>{formatAmount(snapshot.totalCents, snapshot.currency)}</span>
      </div>
    </div>
  )
}
