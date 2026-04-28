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
  /**
   * Optional post-create transition: set status to `confirmed` right after
   * create succeeds. When the parent app has the notifications module's
   * `autoConfirmAndDispatch` enabled, this fires the doc bundle + traveler
   * email via the `booking.confirmed` subscriber. When it isn't, the
   * booking simply lands in `confirmed` instead of `draft`.
   */
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

  // Currency placeholder — used for voucher + payment schedule display.
  // Consumers hooking in real product data should override this by wrapping
  // the component or swapping in their own currency-aware hook.
  const currency = "EUR"

  const { create: createPerson } = usePersonMutation()
  const quickCreateMutation = useBookingQuickCreateMutation()
  const statusMutation = useBookingStatusByIdMutation()

  const handleSubmit = async () => {
    setError(null)

    if (!product.productId) {
      setError("Select a product")
      return
    }

    let resolvedPersonId: string | null = null
    try {
      if (person.mode === "existing") {
        if (!person.personId) {
          setError("Select a person or switch to create mode")
          return
        }
        resolvedPersonId = person.personId
      } else {
        if (!person.newPerson.firstName.trim() || !person.newPerson.lastName.trim()) {
          setError("First and last name are required")
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

      if (sharedRoom.enabled && sharedRoom.mode === "join" && !sharedRoom.groupId) {
        setError("Select a shared-room group to join")
        return
      }

      const bookingNumber = generateBookingNumber()

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
              ? `Booking created but confirm failed: ${statusErr.message}`
              : "Booking created but confirm failed",
          )
          onCreated?.(booking)
          return
        }
      }

      onOpenChange(false)
      onCreated?.(finalBooking)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create booking")
    }
  }

  const isSubmitting =
    quickCreateMutation.isPending || createPerson.isPending || statusMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Quick Book</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <ProductPickerSection
            value={product}
            onChange={setProduct}
            enabled={open}
            lockProduct={Boolean(defaultProductId)}
          />

          {product.productId ? (
            <div className="flex flex-col gap-1">
              <Label>Departure</Label>
              <Select
                value={slotId ?? "__none__"}
                onValueChange={(v) => setSlotId(v === "__none__" ? null : (v ?? null))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a departure..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific departure</SelectItem>
                  {slots.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      No open departures for this product
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

          <PersonPickerSection value={person} onChange={setPerson} enabled={open} />

          <SharedRoomSection
            value={sharedRoom}
            onChange={setSharedRoom}
            productId={product.productId || undefined}
            enabled={open}
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
            <Label>Internal Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quick context for this booking..."
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
                Confirm & notify traveler after creating
              </Label>
              <p className="text-xs text-muted-foreground">
                Transitions to confirmed after create. When the notifications module's auto-dispatch
                is on, this fires the doc bundle + traveler email via the booking.confirmed
                subscriber.
              </p>
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
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !product.productId}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Draft Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
