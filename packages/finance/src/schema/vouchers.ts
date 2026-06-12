import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { voucherSourceTypeEnum, voucherStatusEnum } from "./enums.js"

export const vouchers = pgTable(
  "vouchers",
  {
    id: typeId("vouchers"),
    code: text("code").notNull(),
    /**
     * Batch / campaign identifier. Optional grouping used when a supplier or
     * promo issues many vouchers at once ("GIFT-2026-Q1") and wants to
     * aggregate/revoke them by series. Not indexed uniquely — multiple rows
     * can share the same seriesCode.
     *
     * Aligned with OpenTravel 2019A Finance.Voucher.seriesCode.
     */
    seriesCode: text("series_code"),
    status: voucherStatusEnum("status").notNull().default("active"),
    currency: text("currency").notNull(),
    initialAmountCents: integer("initial_amount_cents").notNull(),
    remainingAmountCents: integer("remaining_amount_cents").notNull(),
    issuedToPersonId: text("issued_to_person_id"),
    issuedToOrganizationId: text("issued_to_organization_id"),
    sourceType: voucherSourceTypeEnum("source_type").notNull(),
    sourceBookingId: text("source_booking_id"),
    sourcePaymentId: text("source_payment_id"),
    /**
     * Start-of-validity. Nullable — when set, a redemption attempt before
     * this timestamp returns `voucher_not_started`. Needed for gift
     * vouchers that are issued immediately but shouldn't be redeemable
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
    uniqueIndex("uidx_vouchers_code").on(table.code),
    index("idx_vouchers_series").on(table.seriesCode),
    index("idx_vouchers_status").on(table.status),
    index("idx_vouchers_person").on(table.issuedToPersonId),
    index("idx_vouchers_organization").on(table.issuedToOrganizationId),
    index("idx_vouchers_source_booking").on(table.sourceBookingId),
    index("idx_vouchers_valid_from").on(table.validFrom),
    index("idx_vouchers_expires_at").on(table.expiresAt),
    index("idx_vouchers_remaining").on(table.remainingAmountCents),
  ],
)

export type Voucher = typeof vouchers.$inferSelect
export type NewVoucher = typeof vouchers.$inferInsert

export const voucherRedemptions = pgTable(
  "voucher_redemptions",
  {
    id: typeId("voucher_redemptions"),
    voucherId: typeIdRef("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").notNull(),
    paymentId: text("payment_id"),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id"),
  },
  (table) => [
    index("idx_voucher_redemptions_voucher").on(table.voucherId),
    index("idx_voucher_redemptions_booking").on(table.bookingId),
    index("idx_voucher_redemptions_voucher_created").on(table.voucherId, table.createdAt),
  ],
)

export type VoucherRedemption = typeof voucherRedemptions.$inferSelect
export type NewVoucherRedemption = typeof voucherRedemptions.$inferInsert
