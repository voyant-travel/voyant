import { bookingGroupsService } from "@voyantjs/bookings"
import type { BookingGroup, BookingGroupMember } from "@voyantjs/bookings/schema"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"

import type { FinanceServiceRuntime } from "./service.js"
import {
  type BookingCreateOutcome,
  type BookingCreateResult,
  bookingCreateSubSchema,
  createBooking,
} from "./service-booking-create.js"

// ---------- validation ----------

/**
 * Sub-booking input. Takes the full create payload minus `group
 * Membership` — dual-create owns the group lifecycle (one new group, both
 * bookings linked as members) so accepting a nested group override would
 * just be an opportunity for the caller to desync.
 */
const dualSubBookingSchema = bookingCreateSubSchema

const dualCreateGroupSchema = z.object({
  kind: z.enum(["shared_room", "other"]).default("shared_room"),
  label: z.string().max(255).optional().nullable(),
  optionUnitId: z.string().optional().nullable(),
})

export const dualCreateBookingSchema = z.object({
  primary: dualSubBookingSchema,
  secondary: dualSubBookingSchema,
  group: dualCreateGroupSchema.default({ kind: "shared_room" }),
})

export type DualCreateBookingInput = z.infer<typeof dualCreateBookingSchema>

// ---------- runtime ----------

export interface DualCreateBookingRuntime extends FinanceServiceRuntime {}

export interface BookingDualCreatedEvent {
  groupId: string
  primaryBookingId: string
  secondaryBookingId: string
  productId: string
  createdByUserId: string | null
  occurredAt: Date
}

// ---------- result shape ----------

export interface DualCreateBookingResult {
  primary: BookingCreateResult
  secondary: BookingCreateResult
  group: BookingGroup
  primaryMember: BookingGroupMember
  secondaryMember: BookingGroupMember
}

export type DualCreateBookingOutcome =
  | { status: "ok"; result: DualCreateBookingResult }
  | {
      status: "primary_failed" | "secondary_failed"
      reason: Exclude<BookingCreateOutcome, { status: "ok" }>
    }

/**
 * Thrown inside the outer tx to force drizzle to roll back both bookings +
 * the group when one of the inner create calls returns non-ok.
 * Drizzle doesn't abort on a non-throwing tx callback, so we convert the
 * discriminated outcome into a throw here.
 */
class DualCreateAbort extends Error {
  constructor(readonly outcome: DualCreateBookingOutcome) {
    super(
      outcome.status === "ok"
        ? "dual-create aborted: ok (unexpected)"
        : `dual-create aborted: ${outcome.status}:${outcome.reason.status}`,
    )
    this.name = "DualCreateAbort"
  }
}

// ---------- service ----------

/**
 * Create two bookings linked via a new `booking_group`, atomically. The
 * canonical operator flow: two travelers book a shared room ("partaj"), each
 * gets their own booking, and both are attached to a new shared_room group
 * so subsequent payment / cancellation decisions can fan out across the
 * pair.
 *
 * Transaction shape:
 *  - Outer tx opens via `db.transaction`.
 *  - Inner: two savepoint-scoped `createBooking(tx, ...)` calls — the
 *    nested transactions drizzle opens use SAVEPOINTs, so partial failures
 *    surface up to this layer as non-ok outcomes.
 *  - If either fails, the outer tx throws `DualCreateAbort` so the whole
 *    thing rolls back (no orphan booking, no orphan group).
 *  - Group creation + both memberships run last, inside the same outer tx.
 *
 * Event emission (`booking.dual-created`) is post-commit — subscribers only
 * hear about successful pairs.
 */
export async function dualCreateBooking(
  db: PostgresJsDatabase,
  rawInput: DualCreateBookingInput,
  options: {
    userId?: string
    runtime?: DualCreateBookingRuntime
  } = {},
): Promise<DualCreateBookingOutcome> {
  const { userId, runtime } = options
  const input = dualCreateBookingSchema.parse(rawInput)

  let result: DualCreateBookingResult
  try {
    result = await db.transaction(async (tx) => {
      const primaryOutcome = await createBooking(tx, input.primary, { userId, runtime })
      if (primaryOutcome.status !== "ok") {
        throw new DualCreateAbort({ status: "primary_failed", reason: primaryOutcome })
      }

      const secondaryOutcome = await createBooking(tx, input.secondary, { userId, runtime })
      if (secondaryOutcome.status !== "ok") {
        throw new DualCreateAbort({ status: "secondary_failed", reason: secondaryOutcome })
      }

      const primaryBooking = primaryOutcome.result.booking
      const secondaryBooking = secondaryOutcome.result.booking

      const group = await bookingGroupsService.createBookingGroup(tx, {
        kind: input.group.kind,
        label:
          input.group.label ??
          `Shared — ${primaryBooking.bookingNumber} + ${secondaryBooking.bookingNumber}`,
        productId: input.primary.productId,
        optionUnitId: input.group.optionUnitId ?? null,
        primaryBookingId: primaryBooking.id,
      })

      const primaryMemberResult = await bookingGroupsService.addGroupMember(tx, group.id, {
        bookingId: primaryBooking.id,
        role: "primary",
      })
      if (primaryMemberResult.status !== "ok") {
        // Shouldn't happen — we just created both rows in this tx — but bail
        // through the same abort path to unwind cleanly.
        throw new DualCreateAbort({
          status: "primary_failed",
          reason: { status: "group_not_found" },
        })
      }

      const secondaryMemberResult = await bookingGroupsService.addGroupMember(tx, group.id, {
        bookingId: secondaryBooking.id,
        role: "shared",
      })
      if (secondaryMemberResult.status !== "ok") {
        throw new DualCreateAbort({
          status: "secondary_failed",
          reason: { status: "group_not_found" },
        })
      }

      return {
        primary: primaryOutcome.result,
        secondary: secondaryOutcome.result,
        group,
        primaryMember: primaryMemberResult.member,
        secondaryMember: secondaryMemberResult.member,
      }
    })
  } catch (error) {
    if (error instanceof DualCreateAbort) {
      return error.outcome
    }
    throw error
  }

  if (runtime?.eventBus) {
    const event: BookingDualCreatedEvent = {
      groupId: result.group.id,
      primaryBookingId: result.primary.booking.id,
      secondaryBookingId: result.secondary.booking.id,
      productId: input.primary.productId,
      createdByUserId: userId ?? null,
      occurredAt: new Date(),
    }
    await runtime.eventBus.emit("booking.dual-created", event)
  }

  return { status: "ok", result }
}
