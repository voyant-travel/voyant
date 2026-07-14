import { and, asc, desc, eq, gt, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { travelCreditRedemptions, travelCredits } from "./schema.js"
import type {
  insertTravelCreditSchema,
  redeemTravelCreditSchema,
  travelCreditListQuerySchema,
  updateTravelCreditSchema,
} from "./validation-travel-credits.js"

type CreateTravelCreditInput = z.infer<typeof insertTravelCreditSchema>
type UpdateTravelCreditInput = z.infer<typeof updateTravelCreditSchema>
type RedeemTravelCreditInput = z.infer<typeof redeemTravelCreditSchema>
type TravelCreditListQuery = z.infer<typeof travelCreditListQuerySchema>

/**
 * Raised by the travel credit service. Code + message; route handlers map to HTTP.
 * Reasons the route layer cares about:
 *  - `code_in_use`        — supplied code collides with an existing travel credit
 *  - `travel_credit_not_found`  — id-not-found / code-not-found read path
 *  - `travel_credit_inactive`   — redeem attempted against non-active status
 *  - `travel_credit_not_started`— validFrom is set and hasn't happened yet
 *  - `travel_credit_expired`    — expiresAt has passed
 *  - `travel_credit_insufficient_balance` — requested amount > remainingAmountCents
 */
export class TravelCreditServiceError extends Error {
  constructor(
    readonly code:
      | "code_in_use"
      | "travel_credit_not_found"
      | "travel_credit_inactive"
      | "travel_credit_not_started"
      | "travel_credit_expired"
      | "travel_credit_insufficient_balance"
      | "idempotency_conflict",
    message?: string,
  ) {
    super(message ?? code)
    this.name = "TravelCreditServiceError"
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/**
 * Generate a short, human-friendly travel credit code. Crockford-style alphabet
 * (no 0/O/1/I) so codes stay readable when typed from a receipt or email.
 * 12 chars from a 32-symbol alphabet ≈ 60 bits of entropy; unique-index on
 * `code` catches the astronomically-unlikely collision.
 */
function generateTravelCreditCode(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    const index = (bytes[i] ?? 0) % CODE_ALPHABET.length
    out += CODE_ALPHABET[index]
    if (i === 3 || i === 7) out += "-"
  }
  return out
}

function normalizeTravelCreditCode(code: string): string {
  return code.trim().toUpperCase()
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  if ("code" in error && error.code === "23505") return true
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("uidx_travel_credits_code") || message.includes("duplicate key")
}

export const travelCreditsService = {
  async list(db: PostgresJsDatabase, query: TravelCreditListQuery) {
    const conditions = []
    if (query.status) conditions.push(eq(travelCredits.status, query.status))
    if (query.seriesCode) conditions.push(eq(travelCredits.seriesCode, query.seriesCode))
    if (query.issuedToPersonId) {
      conditions.push(eq(travelCredits.issuedToPersonId, query.issuedToPersonId))
    }
    if (query.issuedToOrganizationId) {
      conditions.push(eq(travelCredits.issuedToOrganizationId, query.issuedToOrganizationId))
    }
    if (query.hasBalance) {
      conditions.push(gt(travelCredits.remainingAmountCents, 0))
    }
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(travelCredits.code, term), ilike(travelCredits.notes, term)))
    }

    const where = conditions.length ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(travelCredits)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(travelCredits.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(travelCredits).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(travelCredits).where(eq(travelCredits.id, id)).limit(1)
    if (!row) return null
    const redemptions = await db
      .select()
      .from(travelCreditRedemptions)
      .where(eq(travelCreditRedemptions.travelCreditId, id))
      .orderBy(asc(travelCreditRedemptions.createdAt))
    return { ...row, redemptions }
  },

  async create(db: PostgresJsDatabase, input: CreateTravelCreditInput, issuedByUserId?: string) {
    const code = input.code ? normalizeTravelCreditCode(input.code) : generateTravelCreditCode()
    const [existing] = await db
      .select({ id: travelCredits.id })
      .from(travelCredits)
      // agent-quality: raw-sql reviewed -- owner: finance; Drizzle binds the normalized code and owns the column identifier.
      .where(sql`lower(${travelCredits.code}) = ${code.toLowerCase()}`)
      .limit(1)
    if (existing) {
      throw new TravelCreditServiceError("code_in_use")
    }

    try {
      const [row] = await db
        .insert(travelCredits)
        .values({
          code,
          seriesCode: input.seriesCode ?? null,
          currency: input.currency,
          initialAmountCents: input.amountCents,
          remainingAmountCents: input.amountCents,
          issuedToPersonId: input.issuedToPersonId ?? null,
          issuedToOrganizationId: input.issuedToOrganizationId ?? null,
          sourceType: input.sourceType,
          sourceBookingId: input.sourceBookingId ?? null,
          sourcePaymentId: input.sourcePaymentId ?? null,
          validFrom: input.validFrom ? new Date(input.validFrom) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          notes: input.notes ?? null,
          issuedByUserId: issuedByUserId ?? null,
        })
        .returning()
      return row ?? null
    } catch (error) {
      if (isUniqueViolation(error)) throw new TravelCreditServiceError("code_in_use")
      throw error
    }
  },

  async update(db: PostgresJsDatabase, id: string, input: UpdateTravelCreditInput) {
    const [row] = await db
      .update(travelCredits)
      .set({
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.seriesCode !== undefined ? { seriesCode: input.seriesCode } : {}),
        ...(input.validFrom !== undefined
          ? { validFrom: input.validFrom ? new Date(input.validFrom) : null }
          : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.issuedToPersonId !== undefined
          ? { issuedToPersonId: input.issuedToPersonId }
          : {}),
        ...(input.issuedToOrganizationId !== undefined
          ? { issuedToOrganizationId: input.issuedToOrganizationId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(travelCredits.id, id))
      .returning()
    return row ?? null
  },

  /**
   * Apply a travel credit against a booking. Runs in a transaction so
   * `remainingAmountCents` and the redemption row either both land or neither.
   * The row lock serializes competing redemptions before either checks or
   * decrements the balance. Guards: the travel credit must exist, be active,
   * not expired, and have enough balance. When remaining hits zero it
   * flips to `status = 'redeemed'`.
   */
  async redeem(
    db: PostgresJsDatabase,
    travelCreditId: string,
    input: RedeemTravelCreditInput,
    userId?: string,
  ) {
    return db.transaction(async (tx) => {
      const [travelCredit] = await tx
        .select()
        .from(travelCredits)
        .where(eq(travelCredits.id, travelCreditId))
        .for("update")
        .limit(1)

      if (!travelCredit) throw new TravelCreditServiceError("travel_credit_not_found")

      const [existingRedemption] = await tx
        .select()
        .from(travelCreditRedemptions)
        .where(
          and(
            eq(travelCreditRedemptions.travelCreditId, travelCredit.id),
            eq(travelCreditRedemptions.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1)
      if (existingRedemption) {
        const sameRequest =
          existingRedemption.bookingId === input.bookingId &&
          existingRedemption.amountCents === input.amountCents &&
          existingRedemption.paymentId === (input.paymentId ?? null)
        if (!sameRequest) throw new TravelCreditServiceError("idempotency_conflict")
        return { travelCredit, redemption: existingRedemption }
      }

      if (travelCredit.status !== "active") {
        throw new TravelCreditServiceError("travel_credit_inactive")
      }
      if (travelCredit.validFrom && travelCredit.validFrom.getTime() > Date.now()) {
        throw new TravelCreditServiceError("travel_credit_not_started")
      }
      if (travelCredit.expiresAt && travelCredit.expiresAt.getTime() < Date.now()) {
        throw new TravelCreditServiceError("travel_credit_expired")
      }
      if (input.amountCents > travelCredit.remainingAmountCents) {
        throw new TravelCreditServiceError("travel_credit_insufficient_balance")
      }

      const [redemption] = await tx
        .insert(travelCreditRedemptions)
        .values({
          travelCreditId: travelCredit.id,
          bookingId: input.bookingId,
          paymentId: input.paymentId ?? null,
          idempotencyKey: input.idempotencyKey,
          amountCents: input.amountCents,
          createdByUserId: userId ?? null,
        })
        .returning()

      const newRemaining = travelCredit.remainingAmountCents - input.amountCents
      const [updated] = await tx
        .update(travelCredits)
        .set({
          remainingAmountCents: newRemaining,
          status: newRemaining === 0 ? "redeemed" : travelCredit.status,
          updatedAt: new Date(),
        })
        .where(eq(travelCredits.id, travelCredit.id))
        .returning()

      return { travelCredit: updated ?? travelCredit, redemption: redemption ?? null }
    })
  },
}
