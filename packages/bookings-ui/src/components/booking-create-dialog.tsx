"use client"

import { useSlots, useSlotUnitAvailability } from "@voyantjs/availability-react"
import {
  type BookingRecord,
  type QuickCreateGroupMembershipInput,
  type QuickCreatePaymentScheduleInput,
  type QuickCreateTravelerInput,
  type QuickCreateVoucherRedemptionInput,
  useBookingQuickCreateMutation,
  useBookingStatusByIdMutation,
} from "@voyantjs/bookings-react"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
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
  emptyPassengerListValue,
  type PassengerListValue,
  PassengersSection,
  type RoomUnitOption,
} from "./passengers-section.js"
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
  type RoomsStepperValue,
} from "./rooms-stepper-section.js"
import {
  emptySharedRoomValue,
  SharedRoomSection,
  type SharedRoomValue,
} from "./shared-room-section.js"
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
): QuickCreatePaymentScheduleInput[] {
  if (value.mode === "unpaid") return []

  if (value.mode === "full") {
    if (!value.fullDueDate || totalAmountCents === null) return []
    return [
      {
        scheduleType: "balance",
        status: "due",
        dueDate: value.fullDueDate,
        currency,
        amountCents: totalAmountCents,
      },
    ]
  }

  if (value.mode === "advance") {
    if (!value.advanceDueDate || value.advanceAmountCents == null) return []
    const rows: QuickCreatePaymentScheduleInput[] = [
      {
        scheduleType: "deposit",
        status: "due",
        dueDate: value.advanceDueDate,
        currency,
        amountCents: value.advanceAmountCents,
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
  const rows: QuickCreatePaymentScheduleInput[] = []
  if (value.splitFirstDueDate && value.splitFirstAmountCents != null) {
    rows.push({
      scheduleType: "installment",
      status: "due",
      dueDate: value.splitFirstDueDate,
      currency,
      amountCents: value.splitFirstAmountCents,
    })
  }
  if (value.splitSecondDueDate && value.splitSecondAmountCents != null) {
    rows.push({
      scheduleType: "installment",
      status: "pending",
      dueDate: value.splitSecondDueDate,
      currency,
      amountCents: value.splitSecondAmountCents,
    })
  }
  return rows
}

function passengersToRows(value: PassengerListValue): QuickCreateTravelerInput[] {
  return value.passengers.map((p) => ({
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    email: p.email.trim() || null,
    participantType: "traveler",
    travelerCategory:
      p.role === "child"
        ? "child"
        : p.role === "infant"
          ? "infant"
          : p.role === "adult"
            ? "adult"
            : null,
    isPrimary: p.role === "lead",
    roomUnitId: p.roomUnitId,
  }))
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
 * sections — product, departure, rooms, person, shared-room, passengers,
 * price breakdown, voucher, payment schedule — and submits via the atomic
 * `POST /v1/bookings/quick-create` endpoint so partial failures can't
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
  const [person, setPerson] = React.useState<PersonPickerValue>(emptyPersonPickerValue)
  const [sharedRoom, setSharedRoom] = React.useState<SharedRoomValue>(emptySharedRoomValue)
  const [passengers, setPassengers] = React.useState<PassengerListValue>(emptyPassengerListValue)
  const [voucher, setVoucher] = React.useState<VoucherPickerValue>(emptyVoucherPickerValue)
  const [pricing, setPricing] = React.useState<PriceBreakdownValue | null>(null)
  const [paymentSchedule, setPaymentSchedule] =
    React.useState<PaymentScheduleValue>(emptyPaymentScheduleValue)
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
      setPerson(emptyPersonPickerValue)
      setSharedRoom(emptySharedRoomValue)
      setPassengers(emptyPassengerListValue)
      setVoucher(emptyVoucherPickerValue)
      setPricing(null)
      setPaymentSchedule(emptyPaymentScheduleValue)
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only resets when product/option changes
  React.useEffect(() => {
    setSlotId(null)
    setRooms(emptyRoomsStepperValue)
  }, [product.productId, product.optionId])

  const { data: slotsData } = useSlots({
    productId: product.productId || undefined,
    status: "open",
    limit: 100,
    enabled: enabled && Boolean(product.productId),
  })
  const slots = React.useMemo(() => {
    const nowIso = new Date().toISOString()
    return (slotsData?.data ?? [])
      .filter((slot) => slot.startsAt >= nowIso)
      .filter((slot) => {
        if (!product.optionId) return true
        return slot.optionId === null || slot.optionId === product.optionId
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }, [slotsData, product.optionId])

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
  const roomUnitOptions: RoomUnitOption[] = React.useMemo(() => {
    const units = slotUnitAvailability.data?.data ?? []
    if (units.length === 0) return []
    return units
      .filter((unit) => (rooms.quantities[unit.optionUnitId] ?? 0) > 0)
      .map((unit) => {
        const qty = rooms.quantities[unit.optionUnitId] ?? 0
        const occupancyMax = 1
        const seats = qty * occupancyMax
        const assigned = passengers.passengers.filter(
          (p) => p.roomUnitId === unit.optionUnitId,
        ).length
        return {
          unitId: unit.optionUnitId,
          unitName: unit.unitName,
          remainingCapacity: Math.max(0, seats - assigned),
        }
      })
  }, [slotUnitAvailability.data, rooms.quantities, passengers.passengers])

  // Currency placeholder — used for voucher + payment schedule display.
  // Consumers hooking in real product data should override this by wrapping
  // the component or swapping in their own currency-aware hook.
  const currency = messages.bookingCreateDialog.labels.currency
  const pricingCurrency = pricing?.currency ?? currency
  const pricingTotalAmountCents = pricing?.confirmedAmountCents ?? undefined

  const quickCreateMutation = useBookingQuickCreateMutation()
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

      const travelers = passengersToRows(passengers)

      const voucherRedemption: QuickCreateVoucherRedemptionInput | undefined =
        voucher.picked && voucher.picked.remainingAmountCents != null
          ? {
              voucherId: voucher.picked.id,
              amountCents: voucher.picked.remainingAmountCents,
            }
          : undefined

      const groupMembership: QuickCreateGroupMembershipInput | undefined = sharedRoom.enabled
        ? sharedRoom.mode === "create"
          ? {
              action: "create",
              kind: "shared_room",
              label:
                sharedRoom.groupLabel?.trim() ||
                `${messages.bookingCreateDialog.labels.sharedRoomGeneratedLabelPrefix} - ${bookingNumber}`,
              optionUnitId: product.optionId,
              makeBookingPrimary: true,
            }
          : sharedRoom.groupId
            ? { action: "join", groupId: sharedRoom.groupId, role: "shared" }
            : undefined
        : undefined

      const { booking } = await quickCreateMutation.mutateAsync({
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
        travelers: travelers.length > 0 ? travelers : undefined,
        paymentSchedules: paymentSchedules.length > 0 ? paymentSchedules : undefined,
        voucherRedemption,
        groupMembership,
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

  const isSubmitting = quickCreateMutation.isPending || statusMutation.isPending

  return (
    <>
      <div className="grid gap-4">
        <ProductPickerSection
          value={product}
          onChange={setProduct}
          enabled={enabled}
          lockProduct={Boolean(defaultProductId)}
          labels={{
            optionNone: messages.bookingCreateDialog.labels.noSpecificOption,
          }}
        />

        {product.productId ? (
          <div className="flex flex-col gap-1">
            <Label>{messages.bookingCreateDialog.fields.departure}</Label>
            <Select
              value={slotId ?? "__none__"}
              onValueChange={(v) => setSlotId(v === "__none__" ? null : (v ?? null))}
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

        {slotId ? (
          <RoomsStepperSection
            value={rooms}
            onChange={setRooms}
            slotId={slotId}
            enabled={enabled}
            labels={{
              heading: messages.bookingCreateDialog.labels.roomsHeading,
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
          }}
        />

        {product.productId ? (
          <PassengersSection
            value={passengers}
            onChange={setPassengers}
            roomUnits={roomUnitOptions.length > 0 ? roomUnitOptions : undefined}
            labels={{
              heading: messages.bookingCreateDialog.labels.passengerHeading,
              addPassenger: messages.bookingCreateDialog.labels.addPassenger,
              role: messages.bookingCreateDialog.labels.passengerRole,
              roleLead: messages.bookingCreateDialog.labels.passengerLead,
              roleAdult: messages.bookingCreateDialog.labels.passengerAdult,
              roleChild: messages.bookingCreateDialog.labels.passengerChild,
              roleInfant: messages.bookingCreateDialog.labels.passengerInfant,
              room: messages.bookingCreateDialog.labels.passengerRoom,
              noRoom: messages.bookingCreateDialog.labels.passengerNoRoom,
              remove: messages.bookingCreateDialog.labels.passengerRemove,
              empty: messages.bookingCreateDialog.labels.passengerEmpty,
            }}
          />
        ) : null}

        {product.productId ? (
          <PriceBreakdownSection
            productId={product.productId}
            optionId={product.optionId}
            unitQuantities={rooms.quantities}
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
          }}
        />

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
      </div>
      <div className="mt-4 flex justify-end gap-2">
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
      </div>
    </>
  )
}
