"use client"

import { useSlots, useSlotUnitAvailability } from "@voyantjs/availability-react"
import {
  type BookingCreateGroupMembershipInput,
  type BookingCreatePaymentScheduleInput,
  type BookingCreateTravelerInput,
  type BookingCreateVoucherRedemptionInput,
  type BookingRecord,
  useBookingCreateMutation,
  useBookingStatusByIdMutation,
} from "@voyantjs/bookings-react"
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import * as React from "react"

import {
  formatMessage,
  useBookingsUiI18nOrDefault,
  useBookingsUiMessagesOrDefault,
} from "../i18n/provider.js"
import {
  getBookableDepartureSlots,
  getSelectedSharedRoomUnitId,
  itemLinesToRows,
} from "./booking-create-utils.js"
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
  emptyRoomsStepperValue,
  RoomsStepperSection,
  type RoomsStepperUnit,
  type RoomsStepperValue,
} from "./rooms-stepper-section.js"
import {
  emptySharedRoomValue,
  SharedRoomSection,
  type SharedRoomValue,
} from "./shared-room-section.js"
import {
  emptyTravelerListValue,
  type RoomUnitOption,
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
  if (value.mode === "unpaid") return []

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

  if (value.mode === "advance") {
    if (!value.advanceDueDate || value.advanceAmountCents == null) return []
    const rows: BookingCreatePaymentScheduleInput[] = [
      {
        scheduleType: "deposit",
        status: value.advanceAlreadyPaid ? "paid" : "due",
        dueDate: value.advanceDueDate,
        currency,
        amountCents: value.advanceAmountCents,
        notes: paidScheduleNotes(
          value.advanceAlreadyPaid,
          value.advancePaymentDate,
          value.advancePaymentMethod,
          value.advancePaymentReference,
        ),
      },
    ]
    if (totalAmountCents !== null && totalAmountCents > value.advanceAmountCents) {
      rows.push({
        scheduleType: "balance",
        status: "pending",
        dueDate: value.advanceDueDate,
        currency,
        amountCents: totalAmountCents - value.advanceAmountCents,
      })
    }
    return rows
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

function travelersToRows(value: TravelerListValue): BookingCreateTravelerInput[] {
  return value.travelers.map((traveler) => ({
    personId: traveler.personId,
    firstName: traveler.firstName.trim(),
    lastName: traveler.lastName.trim(),
    email: traveler.email.trim() || null,
    participantType: "traveler",
    travelerCategory:
      traveler.role === "child"
        ? "child"
        : traveler.role === "infant"
          ? "infant"
          : traveler.role === "adult"
            ? "adult"
            : null,
    isPrimary: traveler.role === "lead",
    roomUnitId: traveler.roomUnitId,
  }))
}

function sameRoomUnits(left: RoomsStepperUnit[], right: RoomsStepperUnit[]): boolean {
  if (left.length !== right.length) return false
  return left.every((unit, index) => {
    const other = right[index]
    return (
      other !== undefined &&
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
  const [rooms, setRooms] = React.useState<RoomsStepperValue>(emptyRoomsStepperValue)
  const [roomUnits, setRoomUnits] = React.useState<RoomsStepperUnit[]>([])
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
   * Optional post-create transition: set status to `confirmed` right after
   * create succeeds. When the parent app has the notifications module's
   * `autoConfirmAndDispatch` enabled, this fires the doc bundle + traveler
   * email via the `booking.confirmed` subscriber. When it isn't, the
   * booking simply lands in `confirmed` instead of `draft`.
   */
  const [confirmAfterCreate, setConfirmAfterCreate] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const { formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  React.useEffect(() => {
    if (!enabled) {
      setProduct({ productId: defaultProductId ?? "", optionId: null })
      setSlotId(null)
      setRooms(emptyRoomsStepperValue)
      setRoomUnits([])
      setPerson(emptyPersonPickerValue)
      setSharedRoom(emptySharedRoomValue)
      setTravelers(emptyTravelerListValue)
      setVoucher(emptyVoucherPickerValue)
      setPricing(null)
      setPaymentSchedule(emptyPaymentScheduleValue)
      setGenerateContractDocument(false)
      setGenerateInvoiceDocument(false)
      setNotes("")
      setConfirmAfterCreate(false)
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
    setRooms(emptyRoomsStepperValue)
    setRoomUnits([])
    setSharedRoom(emptySharedRoomValue)
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
    setRooms(emptyRoomsStepperValue)
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
  const handleRoomUnitsChange = React.useCallback((units: RoomsStepperUnit[]) => {
    setRoomUnits((prev) => (sameRoomUnits(prev, units) ? prev : units))
  }, [])
  const roomUnitOptions: RoomUnitOption[] = React.useMemo(() => {
    const units = roomUnits.length > 0 ? roomUnits : (slotUnitAvailability.data?.data ?? [])
    if (units.length === 0) return []
    return units
      .filter((unit) => (rooms.quantities[unit.optionUnitId] ?? 0) > 0)
      .map((unit) => {
        const qty = rooms.quantities[unit.optionUnitId] ?? 0
        const occupancyMax = Math.max(1, unit.occupancyMax ?? 1)
        const seats = qty * occupancyMax
        const assigned = travelers.travelers.filter(
          (traveler) => traveler.roomUnitId === unit.optionUnitId,
        ).length
        return {
          unitId: unit.optionUnitId,
          unitName: unit.unitName,
          remainingCapacity: Math.max(0, seats - assigned),
        }
      })
  }, [roomUnits, slotUnitAvailability.data, rooms.quantities, travelers.travelers])

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
  const statusMutation = useBookingStatusByIdMutation()

  const handleSubmit = async () => {
    setError(null)

    if (!product.productId) {
      setError(messages.bookingCreateDialog.validation.selectProduct)
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
    } else {
      if (!person.organizationId) {
        setError(messages.bookingCreateDialog.validation.selectOrganization)
        return
      }
      resolvedOrganizationId = person.organizationId
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
      const itemLines = itemLinesToRows(
        rooms.quantities,
        roomUnits.length > 0 ? roomUnits : (slotUnitAvailability.data?.data ?? []),
        pricing,
      )

      const travelerRows = travelersToRows(travelers)

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
        travelers: travelerRows.length > 0 ? travelerRows : undefined,
        paymentSchedules: paymentSchedules.length > 0 ? paymentSchedules : undefined,
        voucherRedemption,
        groupMembership,
        documentGeneration: {
          contractDocument: generateContractDocument,
          invoiceDocument: generateInvoiceDocument,
        },
      })

      // Optional post-create confirm. If the app has autoConfirmAndDispatch
      // wired on the notifications module, the status transition triggers
      // the doc bundle + traveler email subscriber. A failed status change
      // doesn't roll back the booking — it exists, operator can confirm
      // manually later.
      let finalBooking = booking
      if (confirmAfterCreate) {
        try {
          finalBooking = await statusMutation.mutateAsync({
            bookingId: booking.id,
            currentStatus: booking.status,
            status: "confirmed",
          })
        } catch (statusErr) {
          setError(
            statusErr instanceof Error
              ? formatMessage(messages.bookingCreateDialog.validation.confirmFailedPrefix, {
                  message: statusErr.message,
                })
              : messages.bookingCreateDialog.validation.confirmFailed,
          )
          onCreated?.(booking)
          return
        }
      }

      onCreated?.(finalBooking)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : messages.bookingCreateDialog.validation.createFailed,
      )
    }
  }

  const isSubmitting = createBookingMutation.isPending || statusMutation.isPending

  return (
    <>
      <DialogBody className="grid gap-4">
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
            <Select
              value={slotId ?? "__none__"}
              onValueChange={(v) => setSelectedSlot(v === "__none__" ? null : (v ?? null))}
            >
              <SelectTrigger>
                <SelectValue placeholder={messages.bookingCreateDialog.placeholders.departure} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {messages.bookingCreateDialog.placeholders.departureNone}
                </SelectItem>
                {slots.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    {messages.bookingCreateDialog.placeholders.departureEmpty}
                  </SelectItem>
                ) : (
                  slots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {formatSlotLabel(slot)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {product.productId ? (
          <RoomsStepperSection
            value={rooms}
            onChange={setRooms}
            productId={product.productId}
            slotId={slotId ?? undefined}
            optionId={product.optionId}
            enabled={enabled}
            onUnitsChange={handleRoomUnitsChange}
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

        {product.productId ? (
          <TravelersSection
            value={travelers}
            onChange={setTravelers}
            roomUnits={roomUnitOptions.length > 0 ? roomUnitOptions : undefined}
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

        {product.productId ? (
          <PriceBreakdownSection
            productId={product.productId}
            optionId={product.optionId}
            unitQuantities={rooms.quantities}
            unitLabels={roomUnitLabels}
            labels={{
              heading: messages.bookingCreateDialog.labels.breakdownHeading,
              total: messages.bookingCreateDialog.labels.breakdownTotal,
              onRequest: messages.bookingCreateDialog.labels.breakdownOnRequest,
              groupRate: messages.bookingCreateDialog.labels.breakdownGroupRate,
              empty: messages.bookingCreateDialog.labels.breakdownEmpty,
              noPricing: messages.bookingCreateDialog.labels.breakdownNoPricing,
              confirmedTotal: messages.bookingCreateDialog.labels.breakdownConfirmedTotal,
              manualTotal: messages.bookingCreateDialog.labels.breakdownManualTotal,
              useCatalogTotal: messages.bookingCreateDialog.labels.breakdownUseCatalogTotal,
              overrideReason: messages.bookingCreateDialog.labels.breakdownOverrideReason,
              overrideReasonPlaceholder:
                messages.bookingCreateDialog.labels.breakdownOverrideReasonPlaceholder,
              overrideReasonRequired:
                messages.bookingCreateDialog.labels.breakdownOverrideReasonRequired,
            }}
            onChange={setPricing}
          />
        ) : null}

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

        <div className="flex flex-col gap-2 rounded-md border p-3">
          <Label>{messages.bookingCreateDialog.labels.documentGenerationHeading}</Label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="new-booking-generate-contract-document"
                checked={generateContractDocument}
                onCheckedChange={(value) => setGenerateContractDocument(value === true)}
              />
              <Label htmlFor="new-booking-generate-contract-document" className="cursor-pointer">
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
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{messages.bookingCreateDialog.fields.internalNotes}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={messages.bookingCreateDialog.placeholders.internalNotes}
          />
        </div>

        <div className="flex items-start gap-2 rounded-md border p-3">
          <Checkbox
            id="new-booking-confirm-after-create"
            checked={confirmAfterCreate}
            onCheckedChange={(v) => setConfirmAfterCreate(v === true)}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-booking-confirm-after-create" className="cursor-pointer text-sm">
              {messages.bookingCreateDialog.fields.confirmAfterCreate}
            </Label>
            <p className="text-xs text-muted-foreground">
              {messages.bookingCreateDialog.fields.confirmAfterCreateHint}
            </p>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          {messages.common.cancel}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || !product.productId}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {messages.bookingCreateDialog.actions.createDraftBooking}
        </Button>
      </DialogFooter>
    </>
  )
}
