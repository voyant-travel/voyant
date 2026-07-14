import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { travelCreditSourceTypeEnum, travelCreditStatusEnum } from "./enums.js"

export const travelCredits = pgTable(
  "travel_credits",
  {
    id: typeId("travel_credits"),
    code: text("code").notNull(),
    /**
     * Batch / campaign identifier. Optional grouping used when a supplier or
     * goodwill campaign issues many travel credits at once ("GIFT-2026-Q1") and wants to
     * aggregate/revoke them by series. Not indexed uniquely — multiple rows
     * can share the same seriesCode.
     *
     * Aligned with OpenTravel 2019A Finance.Voucher.seriesCode.
     */
    seriesCode: text("series_code"),
    status: travelCreditStatusEnum("status").notNull().default("active"),
    currency: text("currency").notNull(),
    initialAmountCents: integer("initial_amount_cents").notNull(),
    remainingAmountCents: integer("remaining_amount_cents").notNull(),
    issuedToPersonId: text("issued_to_person_id"),
    issuedToOrganizationId: text("issued_to_organization_id"),
    sourceType: travelCreditSourceTypeEnum("source_type").notNull(),
    sourceBookingId: text("source_booking_id"),
    sourcePaymentId: text("source_payment_id"),
    /**
     * Start-of-validity. Nullable — when set, a redemption attempt before
     * this timestamp returns `travel_credit_not_started`. Needed for travel
     * credits that are issued immediately but shouldn't be redeemable
     * until the recipient's birthday, new year, etc.
     *
     * Aligned with OpenTravel 2019A Finance.Voucher.effectiveDate.
     */
    validFrom: timestamp("valid_from", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notes: text("notes"),
    issuedByUserId: text("issued_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // agent-quality: raw-sql reviewed -- owner: finance; the expression index is parameter-free and enforces case-insensitive code uniqueness.
    uniqueIndex("uidx_travel_credits_code").on(sql`lower(${table.code})`),
    index("idx_travel_credits_series").on(table.seriesCode),
    index("idx_travel_credits_status").on(table.status),
    index("idx_travel_credits_person").on(table.issuedToPersonId),
    index("idx_travel_credits_organization").on(table.issuedToOrganizationId),
    index("idx_travel_credits_source_booking").on(table.sourceBookingId),
    index("idx_travel_credits_valid_from").on(table.validFrom),
    index("idx_travel_credits_expires_at").on(table.expiresAt),
    index("idx_travel_credits_remaining").on(table.remainingAmountCents),
  ],
)

export type TravelCredit = typeof travelCredits.$inferSelect
export type NewTravelCredit = typeof travelCredits.$inferInsert

export const travelCreditRedemptions = pgTable(
  "travel_credit_redemptions",
  {
    id: typeId("travel_credit_redemptions"),
    travelCreditId: typeIdRef("travel_credit_id")
      .notNull()
      .references(() => travelCredits.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").notNull(),
    paymentId: text("payment_id"),
    idempotencyKey: text("idempotency_key"),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id"),
  },
  (table) => [
    index("idx_travel_credit_redemptions_credit").on(table.travelCreditId),
    index("idx_travel_credit_redemptions_booking").on(table.bookingId),
    index("idx_travel_credit_redemptions_credit_created").on(table.travelCreditId, table.createdAt),
    uniqueIndex("uidx_travel_credit_redemptions_idempotency").on(
      table.travelCreditId,
      table.idempotencyKey,
    ),
  ],
)

export type TravelCreditRedemption = typeof travelCreditRedemptions.$inferSelect
export type NewTravelCreditRedemption = typeof travelCreditRedemptions.$inferInsert
