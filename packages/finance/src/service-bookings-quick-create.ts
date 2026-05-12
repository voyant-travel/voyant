import { bookingGroupsService, bookingsService } from "@voyantjs/bookings"
import type { Booking, BookingGroupMember, BookingTraveler } from "@voyantjs/bookings/schema"
import { bookingTravelers } from "@voyantjs/bookings/schema"
import type { EventBus } from "@voyantjs/core"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"

import type { BookingPaymentSchedule, Voucher, VoucherRedemption } from "./schema.js"
import { bookingPaymentSchedules, vouchers } from "./schema.js"
import { VoucherServiceError, vouchersService } from "./service-vouchers.js"
import { paymentScheduleStatusSchema, paymentScheduleTypeSchema } from "./validation-shared.js"

// ---------- validation ----------

const travelerInputSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  personId: z.string().optional().nullable(),
  participantType: z.enum(["traveler", "occupant", "other"]).default("traveler"),
  travelerCategory: z.enum(["adult", "child", "infant", "senior", "other"]).optional().nullable(),
  preferredLanguage: z.string().max(35).optional().nullable(),
  specialRequests: z.string().optional().nullable(),
  /**
   * option_unit_id the passenger is assigned to. Accepted by the input
   * schema so the UI's PassengerListValue can round-trip, but not yet
   * persisted — bookingTravelers has no room-assignment column and the
   * allocation flow is owned by the items slice. Follow-up: add a traveler
   * metadata JSONB or wire into booking_allocations.
   */
  roomUnitId: z.string().optional().nullable(),
  isPrimary: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
})

const paymentScheduleInputSchema = z.object({
  scheduleType: paymentScheduleTypeSchema.default("balance"),
  status: paymentScheduleStatusSchema.default("pending"),
  dueDate: z.string().min(1),
  currency: z.string().min(3).max(3),
  amountCents: z.number().int().min(0),
  notes: z.string().optional().nullable(),
})

const voucherRedemptionInputSchema = z.object({
  voucherId: z.string().min(1),
  amountCents: z.number().int().min(1),
})

const groupJoinSchema = z.object({
  action: z.literal("join"),
  groupId: z.string().min(1),
  role: z.enum(["primary", "shared"]).default("shared"),
})

const groupCreateSchema = z.object({
  action: z.literal("create"),
  kind: z.enum(["shared_room", "other"]).default("shared_room"),
  label: z.string().max(255).optional().nullable(),
  optionUnitId: z.string().optional().nullable(),
  /**
   * When true (the default), the freshly-created booking becomes the group's
   * primary booking. Operators creating a dual-booking can set this false and
   * supply a different primaryBookingId — not wired in this slice, but the
   * field is reserved.
   */
  makeBookingPrimary: z.boolean().default(true),
})

const groupMembershipInputSchema = z.discriminatedUnion("action", [
  groupJoinSchema,
  groupCreateSchema,
])

function requirePriceOverrideReason(
  value: {
    catalogSellAmountCents?: number | null
    confirmedSellAmountCents?: number | null
    priceOverrideReason?: string | null
  },
  ctx: z.RefinementCtx,
) {
  if (value.confirmedSellAmountCents == null) return
  if (value.catalogSellAmountCents === value.confirmedSellAmountCents) return
  if (value.priceOverrideReason) return

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["priceOverrideReason"],
    message:
      "A price override reason is required when the confirmed total differs from catalog pricing",
  })
}

const quickCreateBookingBaseSchema = z.object({
  // Convert-product fields (mirrors convertProductSchema in bookings)
  productId: z.string().min(1),
  optionId: z.string().optional().nullable(),
  slotId: z.string().optional().nullable(),
  bookingNumber: z.string().min(1),
  personId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  /**
   * Override the seed `sellAmountCents` on the new booking + line item.
   * Threads through to `convertProductToBooking` so promotion-discounted
   * quotes land at the discounted amount instead of the product's list
   * price. Per docs/architecture/promotions-architecture.md §7.1.
   */
  sellAmountCentsOverride: z.number().int().min(0).optional().nullable(),
  catalogSellAmountCents: z.number().int().min(0).optional().nullable(),
  confirmedSellAmountCents: z.number().int().min(0).optional().nullable(),
  priceOverrideReason: z.string().trim().min(1).max(1000).optional().nullable(),

  // Orchestration fields
  travelers: z.array(travelerInputSchema).optional(),
  paymentSchedules: z.array(paymentScheduleInputSchema).optional(),
  voucherRedemption: voucherRedemptionInputSchema.optional(),
  groupMembership: groupMembershipInputSchema.optional(),
})

export const quickCreateBookingSchema = quickCreateBookingBaseSchema.superRefine(
  requirePriceOverrideReason,
)

export const quickCreateBookingSubSchema = quickCreateBookingBaseSchema
  .omit({ groupMembership: true })
  .superRefine(requirePriceOverrideReason)

export type QuickCreateBookingInput = z.infer<typeof quickCreateBookingSchema>
export type QuickCreateTravelerInput = z.infer<typeof travelerInputSchema>

// ---------- runtime ----------

/**
 * Fire-and-forget post-commit events. The orchestrator only knows about
 * `booking.quick-created` — downstream confirm/cancel lifecycle events stay
 * with the booking service itself (the booking lands in `draft` status so no
 * `booking.confirmed` should fire here).
 */
export interface BookingQuickCreateRuntime {
  eventBus?: EventBus
}

export interface BookingQuickCreatedEvent {
  bookingId: string
  bookingNumber: string
  productId: string
  travelerCount: number
  paymentScheduleCount: number
  voucherRedeemedCents: number | null
  groupId: string | null
  createdByUserId: string | null
  occurredAt: Date
}

// ---------- result shape ----------

export interface QuickCreateBookingResult {
  booking: Booking
  travelers: BookingTraveler[]
  paymentSchedules: BookingPaymentSchedule[]
  voucherRedemption: {
    voucher: Voucher
    redemption: VoucherRedemption
  } | null
  groupMembership: {
    groupId: string
    member: BookingGroupMember
  } | null
}

export type QuickCreateBookingOutcome =
  | { status: "ok"; result: QuickCreateBookingResult }
  | { status: "product_not_found" }
  | { status: "voucher_not_found" }
  | { status: "voucher_inactive" }
  | { status: "voucher_not_started" }
  | { status: "voucher_expired" }
  | { status: "voucher_insufficient_balance" }
  | { status: "group_not_found" }
  | { status: "booking_already_in_group"; currentGroupId: string }

// ---------- service ----------

/**
 * Atomic booking-create orchestrator. Runs product conversion + travelers +
 * payment schedules + voucher redemption + group membership inside a single
 * transaction so partial failures (e.g. voucher insufficient-balance after
 * schedules have been written) roll the whole thing back.
 *
 * Event emission is post-commit — if the tx rolls back, subscribers never
 * hear about it.
 *
 * Why the orchestrator lives in `@voyantjs/finance`: finance already imports
 * from `@voyantjs/bookings` (invoices-from-bookings, voucher service, payment
 * schedules all sit here), so this is the one place that can compose the
 * three packages without creating a new workspace dep cycle. The route wires
 * it under `/v1/admin/bookings/quick-create` via a HonoExtension whose
 * `module` targets `"bookings"`.
 */
/**
 * Sentinel thrown inside the tx to force drizzle to roll back. Returning a
 * non-ok result from the tx callback doesn't abort the tx — only a thrown
 * error does — so the orchestrator uses this to unwind cleanly when a
 * downstream step discovers a precondition failure.
 */
class QuickCreateAbort extends Error {
  constructor(readonly outcome: Exclude<QuickCreateBookingOutcome, { status: "ok" }>) {
    super(`quick-create aborted: ${outcome.status}`)
    this.name = "QuickCreateAbort"
  }
}

export async function quickCreateBooking(
  db: PostgresJsDatabase,
  rawInput: QuickCreateBookingInput,
  options: {
    userId?: string
    runtime?: BookingQuickCreateRuntime
  } = {},
): Promise<QuickCreateBookingOutcome> {
  const { userId, runtime } = options
  // Parse through the schema so defaults (makeBookingPrimary, role,
  // participantType, etc.) are applied even when callers bypass validation —
  // unit tests and hand-written integrations commonly do.
  const input = quickCreateBookingSchema.parse(rawInput)

  // Validate voucher up-front so we can short-circuit before the tx starts.
  // This is a cheap read — the authoritative balance check still happens
  // inside the redeem savepoint so two concurrent redemptions can't double-
  // spend.
  if (input.voucherRedemption) {
    const [voucher] = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.id, input.voucherRedemption.voucherId))
      .limit(1)
    if (!voucher) return { status: "voucher_not_found" }
    if (voucher.status !== "active") return { status: "voucher_inactive" }
    if (voucher.validFrom && voucher.validFrom.getTime() > Date.now()) {
      return { status: "voucher_not_started" }
    }
    if (voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()) {
      return { status: "voucher_expired" }
    }
    if (input.voucherRedemption.amountCents > voucher.remainingAmountCents) {
      return { status: "voucher_insufficient_balance" }
    }
  }

  let result: QuickCreateBookingResult
  try {
    result = await db.transaction(async (tx) => {
      // 1. Booking from product
      const booking = await bookingsService.createBookingFromProduct(tx, {
        productId: input.productId,
        optionId: input.optionId ?? null,
        slotId: input.slotId ?? null,
        bookingNumber: input.bookingNumber,
        personId: input.personId ?? null,
        organizationId: input.organizationId ?? null,
        internalNotes: input.internalNotes ?? null,
        sellAmountCentsOverride: input.sellAmountCentsOverride ?? null,
        catalogSellAmountCents: input.catalogSellAmountCents ?? null,
        confirmedSellAmountCents: input.confirmedSellAmountCents ?? null,
        priceOverrideReason: input.priceOverrideReason ?? null,
      })
      if (!booking) {
        // Caller gave us a product that doesn't resolve. Throw so drizzle
        // rolls back any writes the convert helper may have made.
        throw new QuickCreateAbort({ status: "product_not_found" })
      }

      // 2. Travelers. roomUnitId is accepted on the input but not persisted
      // yet — see travelerInputSchema for the follow-up note.
      const travelers: BookingTraveler[] = []
      for (const traveler of input.travelers ?? []) {
        const [row] = await tx
          .insert(bookingTravelers)
          .values({
            bookingId: booking.id,
            personId: traveler.personId ?? null,
            participantType: traveler.participantType,
            travelerCategory: traveler.travelerCategory ?? null,
            firstName: traveler.firstName,
            lastName: traveler.lastName,
            email: traveler.email ?? null,
            phone: traveler.phone ?? null,
            preferredLanguage: traveler.preferredLanguage ?? null,
            specialRequests: traveler.specialRequests ?? null,
            isPrimary: traveler.isPrimary ?? false,
            notes: traveler.notes ?? null,
          })
          .returning()
        if (row) travelers.push(row)
      }

      // 3. Payment schedules
      const paymentSchedules: BookingPaymentSchedule[] = []
      for (const schedule of input.paymentSchedules ?? []) {
        const [row] = await tx
          .insert(bookingPaymentSchedules)
          .values({
            bookingId: booking.id,
            scheduleType: schedule.scheduleType,
            status: schedule.status,
            dueDate: schedule.dueDate,
            currency: schedule.currency,
            amountCents: schedule.amountCents,
            notes: schedule.notes ?? null,
          })
          .returning()
        if (row) paymentSchedules.push(row)
      }

      // 4. Voucher redemption. Delegates to vouchersService so the balance
      // decrement + redemption-log insert share the savepoint. If anything
      // goes wrong (race with a concurrent redemption, mostly), the thrown
      // VoucherServiceError surfaces as the outcome below.
      let voucherRedemption: QuickCreateBookingResult["voucherRedemption"] = null
      if (input.voucherRedemption) {
        const { voucher, redemption } = await vouchersService.redeem(
          tx,
          input.voucherRedemption.voucherId,
          {
            bookingId: booking.id,
            amountCents: input.voucherRedemption.amountCents,
          },
          userId,
        )
        if (redemption) {
          voucherRedemption = { voucher, redemption }
        }
      }

      // 5. Group membership (partaj). Either attach to an existing group or
      // spin up a new one with this booking as the primary.
      let groupMembership: QuickCreateBookingResult["groupMembership"] = null
      if (input.groupMembership) {
        if (input.groupMembership.action === "create") {
          const group = await bookingGroupsService.createBookingGroup(tx, {
            kind: input.groupMembership.kind,
            label: input.groupMembership.label ?? `Shared — ${booking.bookingNumber}`,
            productId: input.productId,
            optionUnitId: input.groupMembership.optionUnitId ?? null,
            primaryBookingId: input.groupMembership.makeBookingPrimary ? booking.id : null,
          })
          const memberResult = await bookingGroupsService.addGroupMember(tx, group.id, {
            bookingId: booking.id,
            role: input.groupMembership.makeBookingPrimary ? "primary" : "shared",
          })
          if (memberResult.status !== "ok") {
            // Shouldn't happen — we just created both rows — but throw so
            // the tx rolls back instead of leaving a half-created group.
            throw new QuickCreateAbort({ status: "group_not_found" })
          }
          groupMembership = { groupId: group.id, member: memberResult.member }
        } else {
          const memberResult = await bookingGroupsService.addGroupMember(
            tx,
            input.groupMembership.groupId,
            {
              bookingId: booking.id,
              role: input.groupMembership.role,
            },
          )
          if (memberResult.status === "group_not_found") {
            throw new QuickCreateAbort({ status: "group_not_found" })
          }
          if (memberResult.status === "booking_not_found") {
            // Same booking we just inserted. Pg transaction visibility should
            // prevent this; surface as group_not_found for the caller — we
            // can't tell them the booking we created doesn't exist.
            throw new QuickCreateAbort({ status: "group_not_found" })
          }
          if (memberResult.status === "already_in_group") {
            throw new QuickCreateAbort({
              status: "booking_already_in_group",
              currentGroupId: memberResult.currentGroupId,
            })
          }
          groupMembership = {
            groupId: input.groupMembership.groupId,
            member: memberResult.member,
          }
        }
      }

      return {
        booking,
        travelers,
        paymentSchedules,
        voucherRedemption,
        groupMembership,
      }
    })
  } catch (error) {
    if (error instanceof QuickCreateAbort) {
      return error.outcome
    }
    if (error instanceof VoucherServiceError) {
      if (error.code === "voucher_not_found") return { status: "voucher_not_found" }
      if (error.code === "voucher_inactive") return { status: "voucher_inactive" }
      if (error.code === "voucher_not_started") return { status: "voucher_not_started" }
      if (error.code === "voucher_expired") return { status: "voucher_expired" }
      if (error.code === "insufficient_balance") return { status: "voucher_insufficient_balance" }
    }
    throw error
  }

  // Post-commit event emission. Fire-and-forget (the eventBus contract
  // handles subscriber errors); callers that need strict delivery can
  // re-emit from their own subscriber chain.
  if (runtime?.eventBus) {
    const event: BookingQuickCreatedEvent = {
      bookingId: result.booking.id,
      bookingNumber: result.booking.bookingNumber,
      productId: input.productId,
      travelerCount: result.travelers.length,
      paymentScheduleCount: result.paymentSchedules.length,
      voucherRedeemedCents: result.voucherRedemption
        ? result.voucherRedemption.redemption.amountCents
        : null,
      groupId: result.groupMembership?.groupId ?? null,
      createdByUserId: userId ?? null,
      occurredAt: new Date(),
    }
    await runtime.eventBus.emit("booking.quick-created", event)
  }

  return { status: "ok", result }
}
