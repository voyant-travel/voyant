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
import { usePersonMutation } from "@voyantjs/crm-react"
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
import { useAdminMessages } from "@/lib/admin-i18n"

import {
  emptyPassengerListValue,
  type PassengerListValue,
  PassengersSection,
  type RoomUnitOption,
} from "./passengers-section"
import {
  emptyPaymentScheduleValue,
  PaymentScheduleSection,
  type PaymentScheduleValue,
} from "./payment-schedule-section"
import {
  emptyPersonPickerValue,
  PersonPickerSection,
  type PersonPickerValue,
} from "./person-picker-section"
import { PriceBreakdownSection } from "./price-breakdown-section"
import { ProductPickerSection, type ProductPickerValue } from "./product-picker-section"
import {
  emptyRoomsStepperValue,
  RoomsStepperSection,
  type RoomsStepperValue,
} from "./rooms-stepper-section"
import {
  emptySharedRoomValue,
  SharedRoomSection,
  type SharedRoomValue,
} from "./shared-room-section"
import {
  emptyVoucherPickerValue,
  VoucherPickerSection,
  type VoucherPickerValue,
} from "./voucher-picker-section"

function generateBookingNumber(): string {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `BK-${y}${m}-${seq}`
}

/**
 * Convert a PaymentScheduleValue (section's UI shape) to the rows the
 * `/quick-create` endpoint expects. Returns an empty array for `unpaid` —
 * the orchestrator treats a zero-length paymentSchedules as "operator will
 * invoice manually."
 */
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
    participantType: p.role === "lead" || p.role === "adult" ? "traveler" : "traveler",
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

export function BookingCreateDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProductId,
}: BookingCreateDialogProps) {
  const messages = useAdminMessages().bookings.create
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
  const [paymentSchedule, setPaymentSchedule] =
    React.useState<PaymentScheduleValue>(emptyPaymentScheduleValue)
  const [notes, setNotes] = React.useState("")
  // Post-create: confirm + fire auto-dispatch. The operator template wires
  // `autoConfirmAndDispatch` on the notifications module so a booking.confirmed
  // transition auto-sends the doc bundle — no separate notify call needed.
  const [confirmAfterCreate, setConfirmAfterCreate] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setProduct({ productId: defaultProductId ?? "", optionId: null })
      setSlotId(null)
      setRooms(emptyRoomsStepperValue)
      setPerson(emptyPersonPickerValue)
      setSharedRoom(emptySharedRoomValue)
      setPassengers(emptyPassengerListValue)
      setVoucher(emptyVoucherPickerValue)
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
  }, [open, defaultProductId])

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only resets when product/option changes
  React.useEffect(() => {
    setSlotId(null)
    setRooms(emptyRoomsStepperValue)
  }, [product.productId, product.optionId])

  const { data: slotsData } = useSlots({
    productId: product.productId || undefined,
    status: "open",
    limit: 100,
    enabled: open && Boolean(product.productId),
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

  const formatSlotLabel = React.useCallback((slot: (typeof slots)[number]) => {
    const date = new Date(slot.startsAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    const remaining =
      !slot.unlimited && typeof slot.remainingPax === "number" ? ` · ${slot.remainingPax} left` : ""
    return `${date}${remaining}`
  }, [])

  // Passenger room-assignment options. The capacity ceiling is
  // `rooms[unit] × occupancyMax` seats; we subtract the count of passengers
  // already assigned to each unit so the per-unit selector in the passenger
  // row can disable full rooms. occupancyMax defaults to 1 when the unit
  // definition doesn't carry it.
  const slotUnitAvailability = useSlotUnitAvailability({
    slotId: slotId ?? undefined,
    enabled: open && Boolean(slotId),
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

  // Currency for voucher + payment schedule display. Defaults to EUR for the
  // first-cut composition; follow-up wires it from the product's sell
  // currency (usePricingPreview snapshot already carries catalog.currencyCode).
  const currency = "EUR"

  const { create: createPerson } = usePersonMutation()
  const quickCreateMutation = useBookingQuickCreateMutation()
  const statusMutation = useBookingStatusByIdMutation()

  const handleSubmit = async () => {
    setError(null)

    if (!product.productId) {
      setError(messages.errorSelectProduct)
      return
    }

    let resolvedPersonId: string | null = null
    try {
      if (person.mode === "existing") {
        if (!person.personId) {
          setError(messages.errorSelectPerson)
          return
        }
        resolvedPersonId = person.personId
      } else {
        if (!person.newPerson.firstName.trim() || !person.newPerson.lastName.trim()) {
          setError(messages.errorNameRequired)
          return
        }
        const created = await createPerson.mutateAsync({
          firstName: person.newPerson.firstName.trim(),
          lastName: person.newPerson.lastName.trim(),
          email: person.newPerson.email.trim() || null,
          phone: person.newPerson.phone.trim() || null,
        })
        resolvedPersonId = created.id
      }

      // Validate shared-room selection before creating the booking so we don't
      // leave an orphan booking if the user picked "join" without a group.
      if (sharedRoom.enabled && sharedRoom.mode === "join" && !sharedRoom.groupId) {
        setError(messages.errorSelectSharedRoom)
        return
      }

      const bookingNumber = generateBookingNumber()

      // Total is unknown client-side for now — the price breakdown section
      // computes it but doesn't bubble it up. We pass null to paymentSchedule
      // rows so "full" and "advance+balance" only emit when the operator
      // typed amounts explicitly.
      const paymentSchedules = paymentScheduleToRows(paymentSchedule, currency, null)

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
              label: `Shared room — ${bookingNumber}`,
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
        organizationId: person.organizationId,
        internalNotes: notes.trim() || null,
        travelers: travelers.length > 0 ? travelers : undefined,
        paymentSchedules: paymentSchedules.length > 0 ? paymentSchedules : undefined,
        voucherRedemption,
        groupMembership,
      })

      // Optional post-create: transition to confirmed. In operator's app.ts
      // the notifications module has autoConfirmAndDispatch enabled, so this
      // status change automatically triggers the doc bundle + traveler email
      // via the booking.confirmed subscriber. If the status call fails we
      // don't roll back — the booking exists, the operator can confirm later.
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
              ? `Booking created but confirm failed: ${statusErr.message}`
              : messages.errorCreateFailed,
          )
          // Still fire onCreated so the parent closes & refreshes — the
          // booking did land, only the confirm step tripped.
          onCreated?.(booking)
          return
        }
      }

      onOpenChange(false)
      onCreated?.(finalBooking)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.errorCreateFailed)
    }
  }

  const isSubmitting =
    quickCreateMutation.isPending || createPerson.isPending || statusMutation.isPending

  const productLabels = {
    product: messages.productLabel,
    productSearchPlaceholder: messages.productSearchPlaceholder,
    productSelectPlaceholder: messages.productSelectPlaceholder,
    option: messages.optionLabel,
    optionNone: messages.optionNone,
  }

  const personLabels = {
    person: messages.personLabel,
    createNewPerson: messages.createNewPerson,
    selectExistingPerson: messages.selectExistingPerson,
    personSearchPlaceholder: messages.personSearchPlaceholder,
    personSelectPlaceholder: messages.personSelectPlaceholder,
    firstName: messages.firstNameLabel,
    firstNamePlaceholder: messages.firstNamePlaceholder,
    lastName: messages.lastNameLabel,
    lastNamePlaceholder: messages.lastNamePlaceholder,
    email: messages.emailLabel,
    emailPlaceholder: messages.emailPlaceholder,
    phone: messages.phoneLabel,
    phonePlaceholder: messages.phonePlaceholder,
    organization: messages.organizationLabel,
    organizationSearchPlaceholder: messages.organizationSearchPlaceholder,
    organizationNone: messages.organizationNone,
  }

  const sharedRoomLabels = {
    toggle: messages.sharedRoomLabel,
    createMode: messages.sharedRoomCreate,
    joinMode: messages.sharedRoomJoin,
    selectPlaceholder: messages.sharedRoomSelectPlaceholder,
    noGroups: messages.sharedRoomNoGroups,
    createHint: messages.sharedRoomCreateHint,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{messages.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <ProductPickerSection
            value={product}
            onChange={setProduct}
            enabled={open}
            lockProduct={Boolean(defaultProductId)}
            labels={productLabels}
          />

          {product.productId ? (
            <div className="flex flex-col gap-1">
              <Label>{messages.departureLabel}</Label>
              <Select
                value={slotId ?? "__none__"}
                onValueChange={(v) => setSlotId(v === "__none__" ? null : (v ?? null))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={messages.departureSelectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{messages.departureNone}</SelectItem>
                  {slots.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      {messages.departureEmpty}
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
            <RoomsStepperSection value={rooms} onChange={setRooms} slotId={slotId} enabled={open} />
          ) : null}

          <PersonPickerSection
            value={person}
            onChange={setPerson}
            enabled={open}
            labels={personLabels}
          />

          <SharedRoomSection
            value={sharedRoom}
            onChange={setSharedRoom}
            productId={product.productId || undefined}
            enabled={open}
            labels={sharedRoomLabels}
          />

          {product.productId ? (
            <PassengersSection
              value={passengers}
              onChange={setPassengers}
              roomUnits={roomUnitOptions.length > 0 ? roomUnitOptions : undefined}
            />
          ) : null}

          {product.productId ? (
            <PriceBreakdownSection
              productId={product.productId}
              optionId={product.optionId}
              unitQuantities={rooms.quantities}
            />
          ) : null}

          <VoucherPickerSection value={voucher} onChange={setVoucher} currency={currency} />

          <PaymentScheduleSection
            value={paymentSchedule}
            onChange={setPaymentSchedule}
            currency={currency}
          />

          <div className="flex flex-col gap-2">
            <Label>{messages.notesLabel}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={messages.notesPlaceholder}
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox
              id="quickbook-confirm-after-create"
              checked={confirmAfterCreate}
              onCheckedChange={(v) => setConfirmAfterCreate(v === true)}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="quickbook-confirm-after-create" className="cursor-pointer text-sm">
                {messages.confirmAfterCreateLabel}
              </Label>
              <p className="text-xs text-muted-foreground">{messages.confirmAfterCreateHint}</p>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {messages.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !product.productId}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {messages.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
